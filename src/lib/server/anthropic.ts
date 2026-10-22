import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type Groq from "groq-sdk";
import type { SourcePayload } from "@/lib/types";
import { describeGroqError, newGroq } from "./groq";

export const MODEL = "claude-opus-5-5";
// Server-side refusal fallback: Anthropic picks the substitute model by refusal category.
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

// ~4 chars per token; keeps a request comfortably under the 1M-token context window.
const MAX_SOURCE_CHARS = 3_000_000;

export class UserFacingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type Provider = { kind: "claude"; client: Anthropic } | { kind: "groq"; client: Groq };

/**
 * Picks the AI provider for a request. A key the visitor pasted in Settings wins (gsk_… = Groq,
 * anything else = Claude); otherwise the server's ANTHROPIC_API_KEY, then GROQ_API_KEY.
 */
export function getProvider(req: Request): Provider {
  const userKey = req.headers.get("x-notara-key")?.trim();
  if (userKey) return userKey.startsWith("gsk_") ? { kind: "groq", client: newGroq(userKey) } : { kind: "claude", client: new Anthropic({ apiKey: userKey }) };
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return { kind: "claude", client: new Anthropic() };
  if (process.env.GROQ_API_KEY) return { kind: "groq", client: newGroq(process.env.GROQ_API_KEY) };
  throw new UserFacingError(
    "No AI key configured. Add ANTHROPIC_API_KEY or GROQ_API_KEY to the server environment, or paste your own key in Settings.",
    401,
  );
}

export function checkSourceSize(sources: SourcePayload[]) {
  const total = sources.reduce((n, s) => n + s.content.length, 0);
  if (total > MAX_SOURCE_CHARS) {
    throw new UserFacingError(
      `The selected sources are too large to read at once (${Math.round(total / 1000)}k characters). Deselect a few sources and try again.`,
      413,
    );
  }
}

/** Plain-text document blocks, one per source, with the cache breakpoint on the last one. */
export function sourceDocuments(
  sources: SourcePayload[],
  citations: boolean,
): Anthropic.Beta.BetaRequestDocumentBlock[] {
  const docs = sources
    .filter((s) => s.content.trim())
    .map<Anthropic.Beta.BetaRequestDocumentBlock>((s) => ({
      type: "document",
      source: { type: "text", media_type: "text/plain", data: s.content },
      title: s.title.slice(0, 500),
      ...(citations ? { citations: { enabled: true } } : {}),
    }));
  if (docs.length) docs[docs.length - 1].cache_control = { type: "ephemeral" };
  return docs;
}

export function errorResponse(err: unknown) {
  const { message, status } = describeError(err);
  return Response.json({ error: message }, { status });
}

export function describeError(err: unknown): { message: string; status: number } {
  if (err instanceof UserFacingError) return { message: err.message, status: err.status };
  const groq = describeGroqError(err);
  if (groq) return groq;
  if (err instanceof Anthropic.AuthenticationError)
    return { message: "The Claude API key was rejected. Check the key in Settings or your server environment.", status: 401 };
  if (err instanceof Anthropic.RateLimitError)
    return { message: "Claude is rate-limited right now. Wait a moment and try again.", status: 429 };
  if (err instanceof Anthropic.BadRequestError)
    return { message: `Claude could not process this request: ${err.message}`, status: 400 };
  if (err instanceof Anthropic.APIError)
    return { message: `Claude API error (${err.status ?? "network"}). Please try again.`, status: err.status ?? 502 };
  console.error(err);
  return { message: err instanceof Error ? err.message : "Something went wrong.", status: 500 };
}

export function languageRule(language?: string) {
  return language && language !== "English"
    ? `Write your entire response in ${language}${language === "Roman Urdu" ? " (Urdu written in the Latin alphabet)" : ""}.`
    : "Write in English unless the user writes in another language.";
}
