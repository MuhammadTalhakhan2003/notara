import { getProvider } from "@/lib/server/anthropic";
import { GROQ_MODEL } from "@/lib/server/groq";

export const runtime = "nodejs";

/** Which AI provider requests from this browser would use (no secrets returned). */
export async function GET(req: Request) {
  try {
    const p = getProvider(req);
    return Response.json(p.kind === "claude" ? { provider: "claude", label: "Claude Opus 5.5" } : { provider: "groq", label: `Groq · ${GROQ_MODEL}` });
  } catch {
    return Response.json({ provider: null, label: "No AI key configured" });
  }
}
