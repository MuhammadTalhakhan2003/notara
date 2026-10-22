#!/usr/bin/env node
// Makes a Notara Plus activation code to send a customer after they pay.
//
//   node scripts/plus-code.mjs          -> code valid for 31 days
//   node scripts/plus-code.mjs 365      -> code valid for a year
//
// Reads NOTARA_PLUS_SECRET from the environment or .env.local; it must match the secret on Vercel.

import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

let secret = process.env.NOTARA_PLUS_SECRET;
if (!secret && existsSync(".env.local")) {
  secret = readFileSync(".env.local", "utf8").match(/^NOTARA_PLUS_SECRET=(.+)$/m)?.[1]?.trim();
}
if (!secret) {
  console.error("NOTARA_PLUS_SECRET not found. Run this from the project folder (it reads .env.local).");
  process.exit(1);
}

const days = Number(process.argv[2] ?? 31);
if (!Number.isFinite(days) || days < 1) {
  console.error("Usage: node scripts/plus-code.mjs [days]");
  process.exit(1);
}

const expiry = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const tag = [...randomBytes(4)].map((b) => alphabet[b % alphabet.length]).join("");
const sig = createHmac("sha256", secret).update(`${expiry}-${tag}`).digest("hex").slice(0, 12).toUpperCase();

console.log(`NPLUS-${expiry}-${tag}-${sig}`);
console.log(`Valid until ${expiry.slice(0, 4)}-${expiry.slice(4, 6)}-${expiry.slice(6)} (${days} days)`);
