// Notebook card emoji and colour choices.

export const EMOJIS = ["📘", "🧠", "🔬", "📈", "🌍", "🎓", "💡", "🧪", "📜", "🎧", "🗂️", "🚀", "🌿", "⚖️", "🩺", "🏛️"];
export const COLORS = ["cerulean", "rose", "emerald", "amber", "sky", "violet", "teal", "orange"];

/** Tinted square behind a notebook's emoji, plus the thin accent line on its card. */
export const COLOR_TILE: Record<string, { tile: string; line: string }> = {
  cerulean: { tile: "bg-[#007ba7]/15", line: "bg-[#007ba7]" },
  rose: { tile: "bg-[#ff2d95]/15", line: "bg-[#ff2d95]" },
  emerald: { tile: "bg-emerald-500/15", line: "bg-emerald-500" },
  amber: { tile: "bg-amber-500/15", line: "bg-amber-500" },
  sky: { tile: "bg-sky-500/15", line: "bg-sky-500" },
  violet: { tile: "bg-violet-500/15", line: "bg-violet-500" },
  teal: { tile: "bg-teal-500/15", line: "bg-teal-500" },
  orange: { tile: "bg-orange-500/15", line: "bg-orange-500" },
};
export const tileFor = (color: string) => COLOR_TILE[color] ?? COLOR_TILE.cerulean;
