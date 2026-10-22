import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Notara Plus codes look like NPLUS-20261122-K7QX-3F9A1C0B7E2D: an expiry date, a random tag,
// and an HMAC of both signed with NOTARA_PLUS_SECRET. Codes are made with scripts/plus-code.mjs,
// so nothing is stored server-side and a new code never needs a redeploy.

const CODE = /^NPLUS-(\d{8})-([A-Z0-9]{4})-([A-F0-9]{12})$/;

export function signPlus(expiry: string, tag: string, secret: string) {
  return createHmac("sha256", secret).update(`${expiry}-${tag}`).digest("hex").slice(0, 12).toUpperCase();
}

/** Returns the expiry (YYYY-MM-DD) for a valid, unexpired code, otherwise null. */
export function verifyPlusCode(raw: string | null | undefined): string | null {
  const secret = process.env.NOTARA_PLUS_SECRET;
  const m = raw?.trim().toUpperCase().match(CODE);
  if (!secret || !m) return null;
  const [, expiry, tag, sig] = m;
  const expected = Buffer.from(signPlus(expiry, tag, secret));
  if (expected.length !== sig.length || !timingSafeEqual(expected, Buffer.from(sig))) return null;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  if (expiry < today) return null;
  return `${expiry.slice(0, 4)}-${expiry.slice(4, 6)}-${expiry.slice(6)}`;
}

export const isPlus = (req: Request) => verifyPlusCode(req.headers.get("x-notara-plus")) !== null;
