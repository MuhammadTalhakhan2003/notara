import "server-only";
import Groq from "groq-sdk";
import { z } from "zod";
import { UserFacingError } from "./anthropic";

export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
export const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b";
// Sized for the free tier's 8k tokens/minute; raise both on a paid Groq plan.
export const GROQ_CONTEXT_CHARS = Number(process.env.GROQ_CONTEXT_CHARS) || 12_000;
export const GROQ_MAX_OUTPUT = Number(process.env.GROQ_MAX_OUTPUT) || 3_000;

export const newGroq = (apiKey: string) => new Groq({ apiKey, maxRetries: 3, timeout: 120_000 });

export function describeGroqError(err: unknown): { message: string; status: number } | null {
  if (!(err instanceof Groq.APIError)) return null;
  if (err.status === 401) return { message: "The Groq API key was rejected. Check the key in Settings or your server environment.", status: 401 };
  if (err.status === 429 || err.status === 413)
    return {
      message: "Groq's free plan allows about 8,000 tokens per minute and this request needs more. Wait a minute and retry, select fewer sources, or add a Claude key for large notebooks.",
      status: 429,
    };
  return { message: `Groq API error (${err.status ?? "network"}). Please try again.`, status: err.status ?? 502 };
}

/** Asks for JSON matching a Zod schema and validates the result. */
export async function groqJson<T>(groq: Groq, schema: z.ZodType<T>, system: string, user: string, maxTokens = GROQ_MAX_OUTPUT): Promise<T> {
  const jsonSchema = z.toJSONSchema(schema);
  const res = await groq.chat.completions.create({
    model: GROQ_MODEL,
    max_completion_tokens: maxTokens,
    reasoning_effort: "low",
    response_format: { type: "json_schema", json_schema: { name: "output", schema: jsonSchema as Record<string, unknown> } },
    messages: [
      { role: "system", content: `${system}\nReply with JSON only, matching this JSON schema:\n${JSON.stringify(jsonSchema)}` },
      { role: "user", content: user },
    ],
  });
  const choice = res.choices[0];
  if (choice?.finish_reason === "length") throw new UserFacingError("The output was too long for Groq's free limits. Try a shorter length or fewer items.", 422);
  let parsed: unknown;
  try {
    parsed = JSON.parse(choice?.message?.content ?? "");
  } catch {
    throw new UserFacingError("The model returned an unexpected format. Please try again.", 502);
  }
  const result = schema.safeParse(parsed);
  if (!result.success) throw new UserFacingError("The model returned incomplete data. Please try again.", 502);
  return result.data;
}
