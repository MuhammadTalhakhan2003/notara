"use client";

import { useSyncExternalStore } from "react";
import { prefs } from "./client";
import type { StudioType } from "./types";

export const PLUS_PRICE = "Rs 999";
export const WHATSAPP_NUMBER = "923044292975";
export const WHATSAPP_DISPLAY = "+92 304 4292975";
export const whatsappPlusLink = () =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi Talha! I'd like to get Notara Plus (${PLUS_PRICE}/month). How do I pay?`)}`;

/** Daily allowances on the free plan; Plus has none. */
export const FREE_LIMITS = { chat: 25, studio: 3, sources: 10 } as const;
/** Kept in sync with PLUS_ONLY in the studio API route. */
export const PLUS_TOOLS = new Set<StudioType>(["slides", "custom"]);

// ---------------------------------------------------------------------------
// Plus status lives in this browser; the server re-checks the code's signature on every request.

interface PlusState {
  code: string;
  expires: string;
}

const listeners = new Set<() => void>();
let cached: PlusState | null | undefined;

function read(): PlusState | null {
  const code = prefs.get("plusCode");
  const expires = prefs.get("plusExpires");
  if (!code || !expires) return null;
  if (expires < new Date().toISOString().slice(0, 10)) return null;
  return { code, expires };
}

export function getPlus(): PlusState | null {
  if (cached === undefined) cached = read();
  return cached;
}

export function setPlus(state: PlusState | null) {
  prefs.set("plusCode", state?.code ?? "");
  prefs.set("plusExpires", state?.expires ?? "");
  cached = read();
  listeners.forEach((l) => l());
}

export function usePlus(): PlusState | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getPlus,
    () => null,
  );
}

// ---------------------------------------------------------------------------
// Daily free-plan counters (per browser, reset at midnight).

type Counter = "chat" | "studio";
const today = () => new Date().toISOString().slice(0, 10);

export function usedToday(kind: Counter): number {
  const [day, n] = prefs.get(`use:${kind}`).split("|");
  return day === today() ? Number(n) || 0 : 0;
}

/** Records one use. Returns false (and records nothing) when a free user is out of uses for today. */
export function consume(kind: Counter): boolean {
  if (getPlus()) return true;
  const n = usedToday(kind);
  if (n >= FREE_LIMITS[kind]) return false;
  prefs.set(`use:${kind}`, `${today()}|${n + 1}`);
  return true;
}

// ---------------------------------------------------------------------------
// Opening the upgrade dialog from anywhere.

type UpgradeReason = { title: string; text: string } | null;
let reason: UpgradeReason = null;
const upgradeListeners = new Set<() => void>();

export function askUpgrade(title: string, text: string) {
  reason = { title, text };
  upgradeListeners.forEach((l) => l());
}
export function closeUpgrade() {
  reason = null;
  upgradeListeners.forEach((l) => l());
}
export function useUpgradeReason(): UpgradeReason {
  return useSyncExternalStore(
    (l) => {
      upgradeListeners.add(l);
      return () => upgradeListeners.delete(l);
    },
    () => reason,
    () => null,
  );
}
