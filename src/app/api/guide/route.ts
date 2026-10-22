import { z } from "zod";
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
import { groqJson } from "@/lib/server/groq";
import { formatPassages, selectPassages } from "@/lib/server/retrieval";
import type { SourcePayload } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const Guide = z.object({
  summary: z.string().describe("2-4 sentence summary; wrap the 3-5 most important key terms in **bold**"),
  topics: z.array(z.string()).describe("4-7 key topics, each 1-4 words"),
  questions: z.array(z.string()).describe("3 interesting questions the reader could ask about this material"),
});

// Summarises one source (source guide) or the whole notebook (overview shown above the chat).
export async function POST(req: Request) {
  try {
    const { sources, scope, language } = (await req.json()) as {
      sources: SourcePayload[];
      scope: "source" | "notebook";
      language?: string;
    };
    if (!sources?.some((s) => s.content.trim())) throw new UserFacingError("Nothing to summarise yet.");
    checkSourceSize(sources);
    const provider = getProvider(req);
    const task = `${scope === "notebook" ? "Summarise this whole collection of sources as one notebook, highlighting how they connect." : "Summarise this source."} ${languageRule(language)}`;

    if (provider.kind === "groq") {
      // Kept small: summaries run automatically after every upload and share the per-minute token budget.
      const passages = selectPassages(sources, 6_000);
      const guide = await groqJson(provider.client, Guide, "You summarise documents for a research notebook.", `${formatPassages(sources, passages)}\n\n---\n\n${task}`, 1_500);
      return Response.json({ guide });
    }

    const response = await provider.client.beta.messages.parse(
      {
        model: MODEL,
        max_tokens: 4000,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: betaZodOutputFormat(Guide) },
        messages: [{ role: "user", content: [...sourceDocuments(sources, false), { type: "text", text: task }] }],
      },
      { signal: req.signal },
    );

    if (!response.parsed_output) throw new UserFacingError("Could not summarise this source.", 502);
    return Response.json({ guide: response.parsed_output });
  } catch (err) {
    return errorResponse(err);
  }
}
