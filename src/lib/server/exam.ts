import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { ExamQuestion, ExamRequest, ExamSet } from "@/lib/exam/types";
import type { SourcePayload } from "@/lib/types";
import { FALLBACK_BETA, MODEL, UserFacingError, type Provider } from "./anthropic";
import { GROQ_CONTEXT_CHARS, groqJson } from "./groq";
import { formatPassages, selectPassages, type Passage } from "./retrieval";

// Exam Coach: exam-style questions where every explanation is backed by a quote that is
// checked against the source text on the server. Questions whose quote cannot be found are dropped.

const Generated = z.object({
  title: z.string().describe("short title for this practice set"),
  questions: z.array(
    z.object({
      topic: z.string().describe("2-4 word topic name; reuse the source's section headings and keep names consistent"),
      question: z.string().describe("an exam-style question, ideally a short realistic scenario"),
      options: z.array(z.string()).describe("exactly 4 options, all plausible"),
      answerIndex: z.number().int().describe("0-based index of the correct option"),
      explanation: z.string().describe("1-2 sentences on why the correct option is right"),
      whyWrong: z.array(z.string()).describe("exactly 4 entries, one per option in the same order: one short sentence on why that option is wrong; empty string for the correct option"),
      passageId: z.string().describe('the passage marker the quote comes from, e.g. "1:3"'),
      quote: z.string().describe("one or two consecutive sentences copied EXACTLY, word for word, from that passage, that prove the correct answer"),
    }),
  ),
});
type Generated = z.infer<typeof Generated>;

const SYSTEM =
  "You are an expert certification exam writer. You write fair, unambiguous multiple-choice questions that test understanding, not trivia, using only the study material provided.";

function instructions(req: ExamRequest) {
  return [
    `Write ${req.count} multiple-choice exam questions from the study material above.`,
    "Rules:",
    "- Prefer short real-world scenarios (a technician, a user, a symptom) over plain definitions.",
    "- Every scenario must be realistic and internally consistent: never describe a setup that contradicts the correct answer.",
    "- Exactly 4 options per question. Exactly one option may be defensible; if an expert could argue for a second option (for example a newer standard that would also work), rewrite the question or the options.",
    "- Wrong options must be plausible mistakes a learner might make, never jokes or made-up terms.",
    "- The quote alone must be enough to confirm the correct answer.",
    "- Cover different topics across the material; do not ask two questions about the same fact.",
    "- For every question, copy a quote EXACTLY as written in one passage (same words, same order, no paraphrasing, no ellipses) that proves the answer, and give that passage's marker.",
    "- whyWrong has one entry per option in the same order; use an empty string for the correct option.",
    req.focus?.length ? `- Focus only on these topics, which the learner got wrong: ${req.focus.join(", ")}.` : "",
    req.avoid?.length ? `- Do not repeat or closely rephrase these questions the learner has already seen:\n${req.avoid.map((q) => `  * ${q}`).join("\n")}` : "",
    "- Write in English.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Quote verification

/** Lower-cases, straightens quotes and dashes and collapses whitespace, keeping a map back to the original indexes. */
function normalize(text: string) {
  let out = "";
  const map: number[] = [];
  let space = false;
  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    if (/\s/.test(c)) {
      if (!space && out.length) {
        out += " ";
        map.push(i);
      }
      space = true;
      continue;
    }
    space = false;
    c = c.replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/[‐-―−]/g, "-").toLowerCase();
    out += c;
    map.push(i);
  }
  return { out, map };
}

const cleanQuote = (q: string) =>
  normalize(q.trim().replace(/^["'“‘]+|["'”’]+$/g, "")).out.replace(/[.,;:]+$/, "").trim();

/** Finds the quote in a passage; returns its [start, end) range in the original text, or null. */
export function locate(passage: string, quote: string): [number, number] | null {
  const q = cleanQuote(quote);
  if (q.length < 20) return null;
  const { out, map } = normalize(passage);
  const at = out.indexOf(q);
  if (at < 0) return null;
  return [map[at], map[at + q.length - 1] + 1];
}

// ---------------------------------------------------------------------------

/** Shuffles the options (and their whyWrong lines) so the answer position carries no pattern. */
function shuffle(q: Generated["questions"][number]) {
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  return {
    options: order.map((k) => q.options[k].trim()),
    whyWrong: order.map((k) => (k === q.answerIndex ? "" : (q.whyWrong[k] ?? "").trim())),
    answerIndex: order.indexOf(q.answerIndex),
  };
}

function verify(data: Generated, passages: Passage[], provider: ExamSet["provider"]): ExamSet {
  const byId = new Map(passages.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const questions: ExamQuestion[] = [];

  for (const q of data.questions) {
    const wellFormed =
      q.options.length === 4 &&
      q.answerIndex >= 0 &&
      q.answerIndex < 4 &&
      new Set(q.options.map((o) => o.trim().toLowerCase())).size === 4 &&
      !seen.has(q.question.trim().toLowerCase());
    if (!wellFormed) continue;

    // Look in the passage the model named first, then in every passage it was shown.
    const named = byId.get(q.passageId.replace(/[[\]\s]/g, ""));
    const candidates = named ? [named, ...passages.filter((p) => p !== named)] : passages;
    let found: { p: Passage; range: [number, number] } | null = null;
    for (const p of candidates) {
      const range = locate(p.text, q.quote);
      if (range) {
        found = { p, range };
        break;
      }
    }
    if (!found) continue;

    seen.add(q.question.trim().toLowerCase());
    questions.push({
      id: crypto.randomUUID(),
      topic: q.topic.trim(),
      question: q.question.trim(),
      explanation: q.explanation.trim(),
      ...shuffle(q),
      evidence: { sourceTitle: found.p.title, passage: found.p.text, highlight: found.range },
    });
  }

  return { title: data.title.trim(), questions, checked: data.questions.length, dropped: data.questions.length - questions.length, provider };
}

export async function generateExam(provider: Provider, req: ExamRequest): Promise<ExamSet> {
  const source: SourcePayload = { id: "exam", title: req.title, content: req.content };
  const passages = selectPassages([source], GROQ_CONTEXT_CHARS * 0.8, req.focus?.join(" ") || undefined);
  if (!passages.length) throw new UserFacingError("The study material is empty.");

  const material = `Study material, split into passages. Each passage starts with its marker in square brackets.\n\n${formatPassages([source], passages)}`;
  const task = instructions(req);
  let data: Generated;

  if (provider.kind === "groq") {
    data = await groqJson(provider.client, Generated, SYSTEM, `${material}\n\n---\n\n${task}\nKeep each explanation and whyWrong line short.`, 5000);
  } else {
    const res = await provider.client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(Generated) },
      system: SYSTEM,
      messages: [{ role: "user", content: `${material}\n\n---\n\n${task}` }],
    });
    if (!res.parsed_output) throw new UserFacingError("The model returned an unexpected format. Please try again.", 502);
    data = res.parsed_output;
  }

  const set = verify(data, passages, provider.kind);
  if (!set.questions.length) throw new UserFacingError("None of the generated questions could be backed by a quote from the material, so none are shown. Please try again.", 502);
  return set;
}
