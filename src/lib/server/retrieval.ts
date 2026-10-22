import "server-only";
import type { SourcePayload } from "@/lib/types";

// Groq's free tier allows ~8k tokens per minute, so instead of sending whole sources we send
// a budget of passages: the most relevant ones for a question, or an even spread for summaries.

export interface Passage {
  id: string; // "<source#>:<passage#>", the marker the model cites
  sourceIndex: number;
  sourceId: string;
  title: string;
  text: string;
}

const TARGET = 700;

function split(source: SourcePayload, sourceIndex: number): Passage[] {
  const paras = source.content.split(/\n\s*\n|(?<=\.)\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
  const out: Passage[] = [];
  let buf = "";
  const push = () => {
    if (!buf) return;
    out.push({ id: `${sourceIndex + 1}:${out.length + 1}`, sourceIndex, sourceId: source.id, title: source.title, text: buf });
    buf = "";
  };
  for (const p of paras) {
    // Very long paragraphs (PDF pages without blank lines) are cut at sentence ends.
    const pieces = p.length > TARGET * 1.6 ? p.match(new RegExp(`.{1,${TARGET}}(?:[.!?]\\s|$)|.{1,${TARGET}}`, "g")) ?? [p] : [p];
    for (const piece of pieces) {
      if (buf && buf.length + piece.length > TARGET) push();
      buf = buf ? `${buf} ${piece.trim()}` : piece.trim();
    }
  }
  push();
  return out;
}

const STOP = new Set(
  "a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those what which who whom how why when where do does did can could should would will may might about into over than then so not no yes you your i me my we our they their he she his her them there here".split(" "),
);
const terms = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)?.filter((w) => !STOP.has(w)) ?? [];

export function selectPassages(sources: SourcePayload[], budgetChars: number, query?: string): Passage[] {
  const all = sources.flatMap((s, i) => split(s, i));
  let picked: Passage[];

  if (query && terms(query).length) {
    const q = [...new Set(terms(query))];
    const df = new Map<string, number>();
    const docs = all.map((p) => {
      const t = terms(p.text);
      new Set(t).forEach((w) => df.set(w, (df.get(w) ?? 0) + 1));
      return t;
    });
    const titleHit = (p: Passage) => q.some((w) => p.title.toLowerCase().includes(w));
    const scored = all.map((p, i) => {
      const tf = new Map<string, number>();
      docs[i].forEach((w) => tf.set(w, (tf.get(w) ?? 0) + 1));
      let score = 0;
      for (const w of q) {
        const f = tf.get(w) ?? 0;
        if (f) score += (1 + Math.log(f)) * Math.log(1 + all.length / (df.get(w) ?? 1));
      }
      if (titleHit(p)) score += 0.5;
      // Opening passages usually carry the overview, so they get a small boost.
      if (p.id.endsWith(":1")) score += 0.3;
      return { p, score };
    });
    picked = [];
    let used = 0;
    for (const { p } of scored.sort((a, b) => b.score - a.score)) {
      if (used + p.text.length > budgetChars) continue;
      picked.push(p);
      used += p.text.length;
    }
  } else {
    // Spread evenly: walk every source in step, taking passages at a regular stride.
    const per = sources.map((_, i) => all.filter((p) => p.sourceIndex === i));
    const total = all.reduce((n, p) => n + p.text.length, 0);
    const stride = Math.max(1, Math.ceil(total / budgetChars));
    const candidates = per.flatMap((list) => list.filter((_, k) => k % stride === 0));
    picked = [];
    let used = 0;
    for (const p of candidates) {
      if (used + p.text.length > budgetChars) break;
      picked.push(p);
      used += p.text.length;
    }
  }

  return picked.sort((a, b) => a.sourceIndex - b.sourceIndex || Number(a.id.split(":")[1]) - Number(b.id.split(":")[1]));
}

export function formatPassages(sources: SourcePayload[], passages: Passage[]) {
  return sources
    .map((s, i) => {
      const ps = passages.filter((p) => p.sourceIndex === i);
      if (!ps.length) return "";
      return `<source n="${i + 1}" title="${s.title.replace(/"/g, "'")}">\n${ps.map((p) => `[${p.id}] ${p.text}`).join("\n")}\n</source>`;
    })
    .filter(Boolean)
    .join("\n\n");
}
