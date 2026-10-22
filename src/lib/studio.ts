import type { StudioOptions, StudioType } from "./types";

// Data shapes returned by /api/studio for each output type.
export interface ReportData { title: string; markdown: string }
export interface MindMapNode { id: string; label: string; parent: string | null; detail: string }
export interface MindMapData { title: string; nodes: MindMapNode[] }
export interface FlashcardsData { title: string; cards: { front: string; back: string }[] }
export interface QuizData {
  title: string;
  questions: { question: string; options: string[]; answerIndex: number; explanation: string }[];
}
export interface AudioData {
  title: string;
  hosts: { name: string; persona: string }[];
  lines: { speaker: number; text: string }[];
}
export interface SlidesData { title: string; slides: { title: string; bullets: string[]; notes: string }[] }
export interface TableData { title: string; columns: string[]; rows: string[][] }

export type StudioKind = "report" | "mindmap" | "flashcards" | "quiz" | "audio" | "slides" | "table";

export interface StudioToolMeta {
  type: StudioType;
  label: string;
  blurb: string;
  kind: StudioKind;
  /** Tailwind classes for the tile accent */
  tint: string;
  levelLabel?: string;
  levels?: string[];
  countLabel?: string;
  defaultCount?: number;
}

export const STUDIO_TOOLS: StudioToolMeta[] = [
  { type: "audio", label: "Audio Overview", blurb: "Two hosts talk through your sources", kind: "audio", tint: "from-violet-500/15 to-fuchsia-500/10 text-violet-600 dark:text-violet-300", levelLabel: "Format", levels: ["Deep dive", "Brief", "Debate", "Critique"] },
  { type: "mindmap", label: "Mind Map", blurb: "Explore ideas as a branching map", kind: "mindmap", tint: "from-emerald-500/15 to-teal-500/10 text-emerald-600 dark:text-emerald-300", levelLabel: "Depth", levels: ["Compact", "Standard", "Detailed"] },
  { type: "study_guide", label: "Study Guide", blurb: "Key concepts, glossary and review questions", kind: "report", tint: "from-sky-500/15 to-blue-500/10 text-sky-600 dark:text-sky-300", levelLabel: "Length", levels: ["Short", "Standard", "Long"] },
  { type: "briefing", label: "Briefing Doc", blurb: "Executive briefing with key quotes", kind: "report", tint: "from-amber-500/15 to-orange-500/10 text-amber-600 dark:text-amber-300", levelLabel: "Length", levels: ["Short", "Standard", "Long"] },
  { type: "flashcards", label: "Flashcards", blurb: "Flip cards to memorise the essentials", kind: "flashcards", tint: "from-rose-500/15 to-pink-500/10 text-rose-600 dark:text-rose-300", levelLabel: "Difficulty", levels: ["Easy", "Medium", "Hard"], countLabel: "Cards", defaultCount: 15 },
  { type: "quiz", label: "Quiz", blurb: "Test yourself with instant feedback", kind: "quiz", tint: "from-indigo-500/15 to-blue-500/10 text-indigo-600 dark:text-indigo-300", levelLabel: "Difficulty", levels: ["Easy", "Medium", "Hard"], countLabel: "Questions", defaultCount: 10 },
  { type: "slides", label: "Slide Deck", blurb: "Presentation you can download as PowerPoint", kind: "slides", tint: "from-orange-500/15 to-red-500/10 text-orange-600 dark:text-orange-300", countLabel: "Slides", defaultCount: 10 },
  { type: "faq", label: "FAQ", blurb: "Questions people will ask, answered", kind: "report", tint: "from-cyan-500/15 to-sky-500/10 text-cyan-600 dark:text-cyan-300", countLabel: "Questions", defaultCount: 12 },
  { type: "timeline", label: "Timeline", blurb: "Events in order, plus a cast of characters", kind: "report", tint: "from-lime-500/15 to-green-500/10 text-lime-700 dark:text-lime-300" },
  { type: "table", label: "Data Table", blurb: "Facts pulled into a sortable table", kind: "table", tint: "from-teal-500/15 to-emerald-500/10 text-teal-600 dark:text-teal-300" },
  { type: "blog", label: "Blog Post", blurb: "A readable article from your sources", kind: "report", tint: "from-fuchsia-500/15 to-purple-500/10 text-fuchsia-600 dark:text-fuchsia-300", levelLabel: "Tone", levels: ["Casual", "Professional", "Academic"] },
  { type: "custom", label: "Custom Report", blurb: "Describe exactly what you want", kind: "report", tint: "from-slate-500/15 to-zinc-500/10 text-slate-600 dark:text-slate-300", levelLabel: "Length", levels: ["Short", "Standard", "Long"] },
];

export const toolMeta = (type: StudioType) => STUDIO_TOOLS.find((t) => t.type === type)!;

export const LANGUAGES = [
  "English", "Urdu", "Roman Urdu", "Hindi", "Arabic", "Spanish", "French", "German",
  "Portuguese", "Turkish", "Chinese", "Japanese", "Korean", "Indonesian", "Bengali", "Russian",
];

export function defaultOptions(type: StudioType, language = "English"): StudioOptions {
  const meta = toolMeta(type);
  return {
    language,
    focus: "",
    level: meta.levels ? meta.levels[type === "audio" ? 0 : 1] : "",
    count: meta.defaultCount ?? 0,
    customPrompt: "",
  };
}
