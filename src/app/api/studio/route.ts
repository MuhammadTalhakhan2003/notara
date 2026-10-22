import type { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  FALLBACK_BETA,
  MODEL,
  UserFacingError,
  checkSourceSize,
  errorResponse,
  getProvider,
  languageRule,
  sourceDocuments,
} from "@/lib/server/anthropic";
import { GROQ_CONTEXT_CHARS, groqJson } from "@/lib/server/groq";
import { formatPassages, selectPassages } from "@/lib/server/retrieval";
import { isPlus } from "@/lib/server/plus";
import { brief } from "@/lib/server/studio-spec";
import type { SourcePayload, StudioOptions, StudioType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Kept in sync with PLUS_TOOLS in src/lib/plus.ts. */
const PLUS_ONLY = new Set<StudioType>(["slides", "custom"]);

const SYSTEM = "You are Notara Studio. You turn a user's source documents into polished learning and research materials.";

export async function POST(req: Request) {
  try {
    const { type, options, sources } = (await req.json()) as {
      type: StudioType;
      options: StudioOptions;
      sources: SourcePayload[];
    };
    const spec = brief(type, options);
    if (!spec) throw new UserFacingError("Unknown output type.");
    if (PLUS_ONLY.has(type) && !isPlus(req)) throw new UserFacingError("This Studio tool is part of Notara Plus.", 402);
    if (!sources?.some((s) => s.content.trim())) throw new UserFacingError("Select at least one source first.");
    checkSourceSize(sources);
    const provider = getProvider(req);

    const instructions = [
      spec.task,
      options.focus ? `Focus especially on: ${options.focus}` : "",
      "Use only information from the documents above. Give the output a short, specific title.",
      languageRule(options.language),
    ]
      .filter(Boolean)
      .join("\n\n");

    if (provider.kind === "groq") {
      // Smaller context on Groq's free tier: an even spread of passages (or the ones matching the focus).
      const passages = selectPassages(sources, GROQ_CONTEXT_CHARS * 0.85, options.focus || undefined);
      const data = await groqJson(
        provider.client,
        spec.schema as z.ZodType<unknown>,
        SYSTEM,
        `Excerpts from the user's sources:\n\n${formatPassages(sources, passages)}\n\n---\n\n${instructions}\nKeep the whole output compact (well under 2,000 words) so it fits the response limit. Never write passage IDs like [1:3] in the output; name the source by its title if needed.`,
      );
      return Response.json({ data });
    }

    const response = await provider.client.beta.messages.parse(
      {
        model: MODEL,
        max_tokens: 32000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: betaZodOutputFormat(spec.schema) },
        system: SYSTEM,
        messages: [{ role: "user", content: [...sourceDocuments(sources, false), { type: "text", text: instructions }] }],
      },
      { timeout: 295_000, signal: req.signal },
    );

    if (response.stop_reason === "refusal") throw new UserFacingError("Claude declined to create this output from these sources.", 422);
    if (response.stop_reason === "max_tokens") throw new UserFacingError("The output was too long and got cut off. Try a shorter length or fewer items.", 422);
    if (!response.parsed_output) throw new UserFacingError("Claude returned an unexpected format. Please try again.", 502);

    return Response.json({ data: response.parsed_output });
  } catch (err) {
    return errorResponse(err);
  }
}
