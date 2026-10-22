import { FALLBACK_BETA, MODEL, UserFacingError, errorResponse, getProvider } from "@/lib/server/anthropic";
import { GROQ_VISION_MODEL } from "@/lib/server/groq";

export const runtime = "nodejs";
export const maxDuration = 120;

const MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type Media = (typeof MEDIA)[number];

const PROMPT =
  "Transcribe all text in this image exactly, preserving structure with Markdown (headings, lists, tables). Then add a section '## Visual description' describing any charts, diagrams or photos and what they show. Output only the transcription and description.";

// Turns an image (photo of notes, screenshot, diagram, scanned page) into a text source.
export async function POST(req: Request) {
  try {
    const { data, mediaType } = (await req.json()) as { data: string; mediaType: string };
    if (!data || !MEDIA.includes(mediaType as Media)) throw new UserFacingError("Unsupported image type.");
    const provider = getProvider(req);
    let text = "";

    if (provider.kind === "groq") {
      const res = await provider.client.chat.completions.create(
        {
          model: GROQ_VISION_MODEL,
          max_completion_tokens: 3000,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: PROMPT },
                { type: "image_url", image_url: { url: `data:${mediaType};base64,${data}` } },
              ],
            },
          ],
        },
        { signal: req.signal },
      );
      // Some models wrap their reasoning in <think> tags; keep only the answer.
      text = (res.choices[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    } else {
      const response = await provider.client.beta.messages.create(
        {
          model: MODEL,
          max_tokens: 16000,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          output_config: { effort: "low" },
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mediaType as Media, data } },
                { type: "text", text: PROMPT },
              ],
            },
          ],
        },
        { signal: req.signal },
      );
      text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    }

    if (!text) throw new UserFacingError("No text could be read from this image.", 422);
    return Response.json({ text });
  } catch (err) {
    return errorResponse(err);
  }
}
