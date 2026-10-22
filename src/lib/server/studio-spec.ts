import "server-only";
import { z } from "zod";
import type { StudioOptions, StudioType } from "@/lib/types";

// Output schemas and instructions for each Studio type, shared by the Claude and Groq paths.

export const Report = z.object({ title: z.string(), markdown: z.string() });
const MindMap = z.object({
  title: z.string(),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string().describe("2-6 words"),
      parent: z.string().nullable().describe("id of the parent node; null only for the single root"),
      detail: z.string().describe("one or two sentences explaining this idea, grounded in the sources"),
    }),
  ),
});
const Flashcards = z.object({
  title: z.string(),
  cards: z.array(z.object({ front: z.string(), back: z.string() })),
});
const Quiz = z.object({
  title: z.string(),
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()).describe("exactly 4 options"),
      answerIndex: z.number().int().describe("0-based index of the correct option"),
      explanation: z.string(),
    }),
  ),
});
const Audio = z.object({
  title: z.string(),
  hosts: z.array(z.object({ name: z.string(), persona: z.string() })).describe("exactly 2 hosts"),
  lines: z.array(z.object({ speaker: z.number().int().describe("0 or 1"), text: z.string() })),
});
const Slides = z.object({
  title: z.string(),
  slides: z.array(z.object({ title: z.string(), bullets: z.array(z.string()), notes: z.string() })),
});
const Table = z.object({
  title: z.string(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

const LENGTH: Record<string, string> = {
  Short: "Keep it short: roughly 300-500 words.",
  Standard: "Aim for roughly 800-1,200 words.",
  Long: "Be comprehensive: roughly 1,800-2,500 words.",
};

export function brief(type: StudioType, o: StudioOptions) {
  switch (type) {
    case "study_guide":
      return { schema: Report, task: `Create a study guide in Markdown with: an overview, key concepts explained, a glossary of important terms, 8-10 short-answer review questions, and an answer key. ${LENGTH[o.level] ?? ""}` };
    case "briefing":
      return { schema: Report, task: `Write a briefing document in Markdown for a busy decision-maker: executive summary, main themes, the most important facts and figures, notable direct quotes (with which source they come from), and implications or open questions. ${LENGTH[o.level] ?? ""}` };
    case "faq":
      return { schema: Report, task: `Write an FAQ in Markdown with ${o.count || 12} questions a newcomer would ask, each as a "### " heading followed by a clear answer drawn from the sources.` };
    case "timeline":
      return { schema: Report, task: "Build a timeline in Markdown: a chronological list of the main events (date or period in bold, then what happened), followed by a 'Cast of characters' section with a one-line bio for each important person or organisation. If the sources have no dates, order events logically and say so." };
    case "blog":
      return { schema: Report, task: `Write an engaging blog post in Markdown with a catchy headline, an intro hook, sub-headings and a conclusion. Tone: ${o.level || "Professional"}.` };
    case "custom":
      return { schema: Report, task: `${o.customPrompt || "Write a useful report about these sources."} Format the result in Markdown. ${LENGTH[o.level] ?? ""}` };
    case "mindmap": {
      const size = o.level === "Compact" ? "15-25" : o.level === "Detailed" ? "50-80" : "30-45";
      return { schema: MindMap, task: `Build a mind map of the sources with ${size} nodes: one root node (the central topic, parent null), 4-7 main branches, and sub-branches beneath them up to 4 levels deep. Use short ids like "n1".` };
    }
    case "flashcards":
      return { schema: Flashcards, task: `Create ${o.count || 15} flashcards at ${o.level || "Medium"} difficulty. The front is a question or term; the back is a concise, complete answer.` };
    case "quiz":
      return { schema: Quiz, task: `Write a ${o.count || 10}-question multiple-choice quiz at ${o.level || "Medium"} difficulty. Each question has exactly 4 plausible options, one correct answer, and an explanation that cites what the sources say. Vary the position of the correct answer.` };
    case "audio": {
      const fmt: Record<string, string> = {
        "Deep dive": "a lively, in-depth deep-dive conversation of about 40-60 exchanges that unpacks the ideas and connects them",
        Brief: "a quick, punchy overview of about 14-20 exchanges covering only the core ideas",
        Debate: "a respectful debate of about 30-40 exchanges where the hosts take opposing views drawn from the sources",
        Critique: "a constructive critique of about 30-40 exchanges that weighs strengths, weaknesses and gaps in the material",
      };
      return { schema: Audio, task: `Write a podcast script with two hosts: ${fmt[o.level] ?? fmt["Deep dive"]}. Make it sound natural and spoken (contractions, reactions like "right" and "wait, so...", questions back and forth), but never invent facts. Speaker 0 opens the show. Give the hosts friendly first names that suit the language.` };
    }
    case "slides":
      return { schema: Slides, task: `Create a ${o.count || 10}-slide presentation. The first slide is a title slide; the last is a summary or key takeaways. Each slide has a short title, 3-5 concise bullets (no more than 15 words each) and speaker notes of 2-4 sentences.` };
    case "table":
      return { schema: Table, task: "Extract the most important structured facts from the sources into one table (for example entities, dates, figures, comparisons or definitions). Choose 3-7 meaningful columns and include every relevant row. Every row must have exactly one value per column; use '—' when unknown." };
  }
}
