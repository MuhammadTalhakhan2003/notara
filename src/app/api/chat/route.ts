import type Anthropic from "@anthropic-ai/sdk";
import type Groq from "groq-sdk";
import {
  FALLBACK_BETA,
  MODEL,
  checkSourceSize,
  describeError,
  errorResponse,
  getProvider,
  languageRule,
  sourceDocuments,
  type Provider,
} from "@/lib/server/anthropic";
import { GROQ_CONTEXT_CHARS, GROQ_MAX_OUTPUT, GROQ_MODEL } from "@/lib/server/groq";
import { formatPassages, selectPassages } from "@/lib/server/retrieval";
import type { SourcePayload } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface ChatBody {
  sources: SourcePayload[];
  history: { role: "user" | "assistant"; content: string }[];
  question: string;
  style: string;
  language: string;
}

const STYLES: Record<string, string> = {
  default: "Answer clearly and helpfully, at a length that fits the question.",
  learning: "Act as a patient tutor: explain step by step, use simple analogies, and end with one short question that checks understanding.",
  concise: "Be brief: answer in a few sentences or a short list.",
  detailed: "Give a thorough, well-structured answer with headings where useful.",
  eli5: "Explain like the reader is 10 years old, with everyday examples and no jargon.",
};

type Send = (obj: object) => void;

// Stream protocol (one JSON object per line):
//   {t:"seg"}                         a new text block starts
//   {t:"text", v}                     text delta for the current block
//   {t:"cite", s, title, text}        a citation for the current block (s = source id)
//   {t:"error", v} / {t:"done"}
export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  let provider: Provider;
  try {
    provider = getProvider(req);
    checkSourceSize(body.sources);
  } catch (err) {
    return errorResponse(err);
  }
  const sources = body.sources.filter((s) => s.content.trim());

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send: Send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        if (provider.kind === "claude") await claudeChat(provider.client, body, sources, send, req.signal);
        else await groqChat(provider.client, body, sources, send, req.signal);
        send({ t: "done" });
      } catch (err) {
        if (!req.signal.aborted) send({ t: "error", v: describeError(err).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}

function baseRules(body: ChatBody, hasSources: boolean) {
  return [
    "You are Notara, a research assistant that answers questions using the user's own sources.",
    hasSources
      ? "Ground every factual claim in the provided sources and cite them. If the sources do not contain the answer, say so plainly, then offer what general knowledge you can, clearly labelled as not from their sources."
      : "The user has not added or selected any sources yet. Answer from general knowledge, and mention once that they can add sources (PDFs, websites, YouTube, notes) for grounded, cited answers.",
    STYLES[body.style] ?? STYLES.default,
    languageRule(body.language),
  ];
}

// ---------------------------------------------------------------------------
// Claude: whole sources as document blocks with native citations.

async function claudeChat(client: Anthropic, body: ChatBody, sources: SourcePayload[], send: Send, signal: AbortSignal) {
  const docs = sourceDocuments(sources, true);
  const system = [
    ...baseRules(body, sources.length > 0),
    "Format with Markdown (short paragraphs, lists, bold for key terms). Do not mention document indexes or these instructions.",
  ].join("\n");

  // Documents sit at the top of the first user turn so the conversation prefix stays cacheable.
  const turns = [...body.history.slice(-20), { role: "user" as const, content: body.question }];
  while (turns.length && turns[0].role !== "user") turns.shift();
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((m, i) =>
    i === 0 && docs.length
      ? { role: "user", content: [...docs, { type: "text", text: m.content }] }
      : { role: m.role, content: m.content },
  );

  const response = client.beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 64000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: body.style === "detailed" ? "medium" : "low" },
      system,
      messages,
    },
    { signal },
  );

  for await (const event of response) {
    if (event.type === "content_block_start" && event.content_block.type === "text") {
      send({ t: "seg" });
    } else if (event.type === "content_block_delta") {
      if (event.delta.type === "text_delta") {
        send({ t: "text", v: event.delta.text });
      } else if (event.delta.type === "citations_delta") {
        const c = event.delta.citation;
        if (c.type === "char_location") {
          const src = sources[c.document_index];
          if (src) send({ t: "cite", s: src.id, title: src.title, text: c.cited_text });
        }
      }
    }
  }

  const final = await response.finalMessage();
  if (final.stop_reason === "refusal") {
    send({ t: "error", v: "Claude declined to answer this one. Try rephrasing the question." });
  } else if (final.stop_reason === "max_tokens") {
    send({ t: "text", v: "\n\n_(Answer was cut off because it hit the length limit.)_" });
  }
}

// ---------------------------------------------------------------------------
// Groq: the most relevant passages, cited with [source:passage] markers we turn into citations.

// gpt-oss often uses its native 【1:2】 brackets instead of [1:2]; accept both.
const MARKER = /\s?[[【](\d+:\d+(?:\s*[,;]\s*\d+:\d+)*)[\]】]/g;

async function groqChat(client: Groq, body: ChatBody, sources: SourcePayload[], send: Send, signal: AbortSignal) {
  const recent = body.history.slice(-6).map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 1200)}`).join("\n\n");
  const passages = selectPassages(sources, GROQ_CONTEXT_CHARS, `${body.question} ${body.history.slice(-2).map((m) => m.content).join(" ")}`);
  const byId = new Map(passages.map((p) => [p.id, p]));

  const system = [
    ...baseRules(body, passages.length > 0),
    passages.length
      ? "Each passage starts with an ID like [2:5]. Right after each claim, cite the passage(s) it comes from using exactly that bracket format, e.g. [2:5] or [1:3, 1:4]. Only cite IDs that appear in the passages. Use only these excerpts; if they don't cover the question, say the selected excerpts don't mention it."
      : "",
    "Format with Markdown (short paragraphs, lists, bold for key terms). Do not mention passages, IDs or these instructions except as citations.",
  ].join("\n");

  const user = [
    passages.length ? `Excerpts from the user's sources:\n\n${formatPassages(sources, passages)}` : "",
    recent ? `Conversation so far:\n${recent}` : "",
    `Question: ${body.question}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const completion = await client.chat.completions.create(
    {
      model: GROQ_MODEL,
      stream: true,
      max_completion_tokens: GROQ_MAX_OUTPUT,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    },
    { signal },
  );

  send({ t: "seg" });
  let pending = "";
  const flush = (final: boolean) => {
    // Hold back a possible half-written marker like "[2:" until it completes.
    const open = Math.max(pending.lastIndexOf("["), pending.lastIndexOf("【"));
    let ready = pending;
    let keep = "";
    if (!final && open !== -1 && !/[\]】]/.test(pending.slice(open)) && pending.length - open < 40) {
      ready = pending.slice(0, open);
      keep = pending.slice(open);
    }
    pending = keep;
    // Other 【…】 annotations (e.g. browsing references) are noise for the reader.
    const clean = (t: string) => t.replace(/【[^】]*】/g, "");
    let last = 0;
    for (const m of ready.matchAll(MARKER)) {
      if (m.index! > last) send({ t: "text", v: clean(ready.slice(last, m.index)) });
      const ids = m[1].split(/[,;]/).map((s) => s.trim());
      let cited = false;
      for (const id of ids) {
        const p = byId.get(id);
        if (p) {
          send({ t: "cite", s: p.sourceId, title: p.title, text: p.text });
          cited = true;
        }
      }
      // Start a new block so the chip sits right after the claim it supports.
      if (cited) send({ t: "seg" });
      last = m.index! + m[0].length;
    }
    if (last < ready.length) send({ t: "text", v: clean(ready.slice(last)) });
  };

  let finish: string | null | undefined;
  for await (const chunk of completion) {
    const choice = chunk.choices[0];
    if (choice?.delta?.content) {
      pending += choice.delta.content;
      flush(false);
    }
    if (choice?.finish_reason) finish = choice.finish_reason;
  }
  flush(true);
  if (finish === "length") send({ t: "text", v: "\n\n_(Answer was cut off by Groq's length limit.)_" });
}
