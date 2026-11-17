import { z } from "zod";
import { UserFacingError, errorResponse, getProvider } from "@/lib/server/anthropic";
import { generateExam } from "@/lib/server/exam";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(200_000),
  count: z.number().int().min(3).max(10),
  focus: z.array(z.string().max(80)).max(6).optional(),
  avoid: z.array(z.string().max(400)).max(40).optional(),
});

/** Generates a practice set of exam questions whose explanations are backed by verified quotes. */
export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new UserFacingError("Invalid request.");
    if (parsed.data.content.trim().length < 300) throw new UserFacingError("Add a bit more study material (at least a few paragraphs) to generate questions from.");
    const set = await generateExam(getProvider(req), parsed.data);
    return Response.json(set);
  } catch (err) {
    return errorResponse(err);
  }
}
