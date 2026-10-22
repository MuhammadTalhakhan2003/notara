import { verifyPlusCode } from "@/lib/server/plus";

export const runtime = "nodejs";

/** Checks a Notara Plus activation code. */
export async function POST(req: Request) {
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const expires = verifyPlusCode(code);
  return expires
    ? Response.json({ valid: true, expires })
    : Response.json({ valid: false, error: "That code isn't valid or has expired. Check it on WhatsApp with Talha." }, { status: 400 });
}
