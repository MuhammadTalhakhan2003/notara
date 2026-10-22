"use client";

import type { Source, SourcePayload } from "./types";

// Per-browser preferences. Wrapped in try/catch because storage can be blocked (private mode).
export const prefs = {
  get(key: string, fallback = ""): string {
    try {
      return localStorage.getItem(`notara:${key}`) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: string) {
    try {
      if (value) localStorage.setItem(`notara:${key}`, value);
      else localStorage.removeItem(`notara:${key}`);
    } catch {}
  },
};

export function apiHeaders(): HeadersInit {
  const key = prefs.get("apiKey");
  const plus = prefs.get("plusCode");
  return {
    "Content-Type": "application/json",
    ...(key ? { "x-notara-key": key } : {}),
    ...(plus ? { "x-notara-plus": plus } : {}),
  };
}

export async function api<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: apiHeaders(), body: JSON.stringify(body), signal });
  let json: { error?: string } & T;
  try {
    json = await res.json();
  } catch {
    throw new Error(res.status === 504 ? "The request timed out. Try fewer sources or a shorter output." : `Request failed (${res.status}).`);
  }
  // 402 = a Plus-only feature; the upgrade dialog listens for this event.
  if (res.status === 402) window.dispatchEvent(new CustomEvent("notara:upgrade", { detail: json.error }));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`);
  return json;
}

export const toPayload = (sources: Source[]): SourcePayload[] =>
  sources.map((s) => ({ id: s.id, title: s.title, content: s.content }));

export function timeAgo(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(ts).toLocaleDateString();
}

export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
