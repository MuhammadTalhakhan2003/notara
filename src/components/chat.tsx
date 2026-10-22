"use client";

import {
  ArrowUp,
  Check,
  Copy,
  Eraser,
  Mic,
  MicOff,
  NotebookPen,
  RefreshCw,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, apiHeaders, prefs, toPayload } from "@/lib/client";
import { db, touchNotebook, uid } from "@/lib/db";
import { chatToMarkdown, exportMarkdown, markdownToText } from "@/lib/exporters";
import { FREE_LIMITS, askUpgrade, consume } from "@/lib/plus";
import { LANGUAGES } from "@/lib/studio";
import type { ChatMessage, ChatSegment, Citation, Notebook, Source, SourceGuide } from "@/lib/types";
import { PanelHeader } from "./sources";
import { DownloadMenu, IconButton, Spinner, cx, toast } from "./ui";

const STYLES = [
  { id: "default", label: "Balanced" },
  { id: "learning", label: "Learning guide" },
  { id: "concise", label: "Concise" },
  { id: "detailed", label: "Detailed" },
  { id: "eli5", label: "Explain like I'm 10" },
];

const messageText = (m: ChatMessage) => m.segments.map((s) => s.text).join("");

/** Answer text as Markdown, with citations turned into links the renderer shows as chips. */
const withCiteLinks = (m: ChatMessage) =>
  m.segments
    .map((s) => s.text + [...new Set(s.citations.map((c) => c.n))].map((n) => ` [${n}](#cite-${n})`).join(""))
    .join("");

const answerMarkdown = (m: ChatMessage) => {
  const cites = new Map<number, Citation>();
  m.segments.forEach((s) => s.citations.forEach((c) => cites.set(c.n, c)));
  const body = m.segments.map((s) => s.text + [...new Set(s.citations.map((c) => c.n))].map((n) => ` [${n}]`).join("")).join("");
  return cites.size
    ? `${body}\n\n**Sources**\n\n${[...cites.values()].map((c) => `- [${c.n}] ${c.sourceTitle}: “${c.text.trim().slice(0, 220)}”`).join("\n")}`
    : body;
};

function speak(text: string, onEnd: () => void) {
  if (!("speechSynthesis" in window)) return toast("Read-aloud isn't supported in this browser", "error");
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(markdownToText(text).slice(0, 12000));
  u.rate = 1.03;
  u.onend = onEnd;
  u.onerror = onEnd;
  speechSynthesis.speak(u);
}

export function ChatPanel({
  notebook,
  sources,
  messages,
  onOpenSource,
  pendingQuestion,
  clearPending,
}: {
  notebook: Notebook;
  sources: Source[];
  messages: ChatMessage[];
  onOpenSource: (id: string, highlight?: string) => void;
  pendingQuestion: string | null;
  clearPending: () => void;
}) {
  const [input, setInput] = useState("");
  const [style, setStyle] = useState("default");
  const [language, setLanguage] = useState("English");
  const [streaming, setStreaming] = useState<ChatMessage | null>(null);
  const [listening, setListening] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    setStyle(prefs.get("chatStyle", "default"));
    setLanguage(prefs.get("language", "English") || "English");
  }, []);

  const selected = useMemo(() => sources.filter((s) => s.selected), [sources]);

  // Auto-scroll as the answer streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: streaming ? "auto" : "smooth" });
  }, [messages.length, streaming]);

  const send = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || abortRef.current) return;
      if (!consume("chat")) {
        askUpgrade(
          "Your brain earned a break 🧠",
          `Free notebooks get ${FREE_LIMITS.chat} questions a day and you've used them all. Come back tomorrow, or get Plus and ask as much as you like.`,
        );
        return;
      }
      setInput("");
      const userMsg: ChatMessage = { id: uid(), notebookId: notebook.id, role: "user", segments: [{ text: q, citations: [] }], createdAt: Date.now() };
      await db.messages.add(userMsg);
      touchNotebook(notebook.id);

      const reply: ChatMessage = { id: uid(), notebookId: notebook.id, role: "assistant", segments: [], createdAt: Date.now() + 1 };
      setStreaming({ ...reply });
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const citeNums = new Map<string, number>();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: apiHeaders(),
          signal: ctrl.signal,
          body: JSON.stringify({
            sources: toPayload(selected),
            history: messages.slice(-20).map((m) => ({ role: m.role, content: messageText(m) })).filter((m) => m.content.trim()),
            question: q,
            style,
            language,
          }),
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Request failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let segs: ChatSegment[] = [];
        let lastPaint = 0;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line);
            if (ev.t === "seg") segs = [...segs, { text: "", citations: [] }];
            else if (ev.t === "text") {
              if (!segs.length) segs = [{ text: "", citations: [] }];
              const last = segs[segs.length - 1];
              segs = [...segs.slice(0, -1), { ...last, text: last.text + ev.v }];
            } else if (ev.t === "cite") {
              const key = `${ev.s}|${ev.text}`;
              if (!citeNums.has(key)) citeNums.set(key, citeNums.size + 1);
              const c: Citation = { n: citeNums.get(key)!, sourceId: ev.s, sourceTitle: ev.title, text: ev.text };
              if (!segs.length) segs = [{ text: "", citations: [] }];
              const last = segs[segs.length - 1];
              segs = [...segs.slice(0, -1), { ...last, citations: [...last.citations, c] }];
            } else if (ev.t === "error") reply.error = ev.v;
          }
          reply.segments = segs;
          const now = performance.now();
          if (now - lastPaint > 40) {
            lastPaint = now;
            setStreaming({ ...reply });
          }
        }
        reply.segments = segs;
      } catch (e) {
        if (!ctrl.signal.aborted) reply.error = e instanceof Error ? e.message : "Something went wrong.";
      } finally {
        abortRef.current = null;
        if (reply.segments.some((s) => s.text.trim()) || reply.error) await db.messages.add({ ...reply });
        setStreaming(null);
      }
    },
    [messages, notebook.id, selected, style, language],
  );

  // Questions sent from elsewhere (topic chips, Studio, source guide).
  useEffect(() => {
    if (pendingQuestion && !abortRef.current) {
      send(pendingQuestion);
      clearPending();
    }
  }, [pendingQuestion, send, clearPending]);

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Rec) return toast("Voice input isn't supported in this browser (try Chrome or Edge)", "error");
    const rec = new Rec();
    const LANG_CODES: Record<string, string> = { Urdu: "ur-PK", "Roman Urdu": "en-PK", Hindi: "hi-IN", Arabic: "ar-SA", Spanish: "es-ES", French: "fr-FR", German: "de-DE", Turkish: "tr-TR" };
    rec.lang = LANG_CODES[language] ?? "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    const base = input ? input + " " : "";
    rec.onresult = (e) => setInput(base + Array.from(e.results).map((r) => r[0].transcript).join(""));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const all = streaming ? [...messages, streaming] : messages;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Chat">
        <select
          aria-label="Answer style"
          value={style}
          onChange={(e) => {
            setStyle(e.target.value);
            prefs.set("chatStyle", e.target.value);
          }}
          className="h-8 rounded-full border border-line bg-panel px-2.5 text-xs outline-none"
        >
          {STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Answer language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="hidden h-8 rounded-full border border-line bg-panel px-2.5 text-xs outline-none sm:block"
        >
          {LANGUAGES.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        {messages.length > 0 && (
          <>
            <DownloadMenu
              compact
              label="Download chat"
              formats={["pdf", "docx", "md", "txt", "html"]}
              onPick={(f) => exportMarkdown(`${notebook.title} chat`, chatToMarkdown(notebook.title, messages), f)}
            />
            <IconButton
              label="Clear chat"
              onClick={async () => {
                if (confirm("Delete the whole chat history for this notebook?")) await db.messages.where("notebookId").equals(notebook.id).delete();
              }}
            >
              <Eraser className="size-4" />
            </IconButton>
          </>
        )}
      </PanelHeader>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <Overview notebook={notebook} sources={sources} selected={selected} onAsk={send} busy={!!streaming} />
          {all.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="animate-rise flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-accent px-4 py-2.5 text-[14.5px] text-accent-ink">{messageText(m)}</div>
              </div>
            ) : (
              <AssistantMessage key={m.id} m={m} live={m === streaming} onOpenSource={onOpenSource} notebookId={notebook.id} />
            ),
          )}
        </div>
      </div>

      <div className="shrink-0 px-3 pb-3 sm:px-6 sm:pb-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-1.5 rounded-[26px] border border-line bg-panel p-1.5 shadow-sm transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
            <IconButton label={listening ? "Stop voice input" : "Voice input"} onClick={toggleMic} className={cx("size-10", listening && "animate-pulse bg-danger/10 text-danger")}>
              {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </IconButton>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                  (e.target as HTMLTextAreaElement).style.height = "auto";
                }
              }}
              placeholder={selected.length ? `Ask about ${selected.length} source${selected.length === 1 ? "" : "s"}...` : "Add a source to get cited answers, or just ask..."}
              className="max-h-44 min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-[14.5px] outline-none placeholder:text-muted"
            />
            {streaming ? (
              <button aria-label="Stop" onClick={() => abortRef.current?.abort()} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-bg">
                <Square className="size-3.5 fill-current" />
              </button>
            ) : (
              <button
                aria-label="Send"
                disabled={!input.trim()}
                onClick={() => send(input)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition disabled:opacity-30"
              >
                <ArrowUp className="size-5" />
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted">Notara can make mistakes. Check important facts against the cited sources.</p>
        </div>
      </div>
    </div>
  );
}

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
}

// Something to read while the model reads.
const THINKING = [
  "Reading your sources faster than you did the night before the exam…",
  "Underlining the important bits so you don't have to…",
  "Asking the footnotes politely…",
  "Putting the kettle on for the neurons ☕",
  "Cross-checking, because citations matter…",
  "Skimming like a professional…",
];

function ThinkingLine() {
  const [i, setI] = useState(() => Math.floor(Math.random() * THINKING.length));
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % THINKING.length), 2600);
    return () => clearInterval(t);
  }, []);
  return <span className="animate-rise" key={i}>{THINKING[i]}</span>;
}

// ---------------------------------------------------------------------------

function Overview({
  notebook,
  sources,
  selected,
  onAsk,
  busy,
}: {
  notebook: Notebook;
  sources: Source[];
  selected: Source[];
  onAsk: (q: string) => void;
  busy: boolean;
}) {
  const key = selected.map((s) => s.id).sort().join(",");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const stale = !!key && notebook.overview?.sourceKey !== key;
  useEffect(() => setFailed(false), [key]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const { guide } = await api<{ guide: SourceGuide }>("/api/guide", {
        sources: toPayload(selected),
        scope: "notebook",
        language: prefs.get("language") || undefined,
      });
      await db.notebooks.update(notebook.id, { overview: { ...guide, sourceKey: key } });
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [selected, notebook.id, key]);

  // Regenerate automatically when the selected sources change (debounced while uploads land).
  useEffect(() => {
    if (!stale || loading || failed) return;
    const t = setTimeout(refresh, 1500);
    return () => clearTimeout(t);
  }, [stale, loading, failed, refresh]);

  const ov = notebook.overview;
  return (
    <div className="pt-4">
      <div className="text-5xl">{notebook.emoji}</div>
      <h1 className="mt-3 font-brand text-4xl font-semibold leading-tight tracking-tight">{notebook.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {sources.length} source{sources.length === 1 ? "" : "s"}
        {sources.length !== selected.length && ` · ${selected.length} selected`}
      </p>
      {selected.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
          {sources.length ? "Select at least one source on the left to ground answers." : "Add a source to get started. Notara is ready to read; it just needs something to read."}
        </p>
      ) : ov && !stale ? (
        <>
          <div className="prose-ink mt-4 text-[15px]">
            <ReactMarkdown>{ov.summary}</ReactMarkdown>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {ov.questions.map((q) => (
              <button
                key={q}
                disabled={busy}
                onClick={() => onAsk(q)}
                className="rounded-2xl border border-line bg-panel px-3.5 py-2 text-left text-[13px] transition hover:border-accent hover:bg-accent-soft disabled:opacity-50"
              >
                {q}
              </button>
            ))}
            <IconButton label="Refresh overview" onClick={refresh}>
              <RefreshCw className="size-3.5" />
            </IconButton>
          </div>
        </>
      ) : failed ? (
        <p className="mt-4 text-sm text-muted">
          Couldn&apos;t create the overview.{" "}
          <button className="text-accent hover:underline" onClick={refresh}>
            Try again
          </button>
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Sparkles className="size-4 text-accent" /> Reading your sources...
          </div>
          <div className="shimmer h-20 rounded-2xl border border-line" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function AssistantMessage({
  m,
  live,
  onOpenSource,
  notebookId,
}: {
  m: ChatMessage;
  live: boolean;
  onOpenSource: (id: string, highlight?: string) => void;
  notebookId: string;
}) {
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const cites = useMemo(() => {
    const map = new Map<number, Citation>();
    m.segments.forEach((s) => s.citations.forEach((c) => map.set(c.n, c)));
    return map;
  }, [m.segments]);
  const md = withCiteLinks(m);
  const empty = !m.segments.some((s) => s.text.trim());

  return (
    <div className="animate-rise group">
      {empty && live ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted">
          <Spinner className="text-accent" /> <ThinkingLine />
        </div>
      ) : (
        <div className="prose-ink text-[15px]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => {
                const n = href?.startsWith("#cite-") ? Number(href.slice(6)) : NaN;
                const c = cites.get(n);
                if (c)
                  return (
                    <span className="group/cite relative inline-block align-baseline">
                      <button
                        onClick={() => onOpenSource(c.sourceId, c.text)}
                        className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-soft px-1.5 text-[11px] font-semibold text-accent no-underline transition hover:bg-accent hover:text-accent-ink"
                      >
                        {n}
                      </button>
                      <span className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-2 w-72 -translate-x-1/2 rounded-2xl border border-line bg-panel p-3 text-left text-xs not-italic leading-snug text-ink opacity-0 shadow-xl transition group-hover/cite:visible group-hover/cite:opacity-100">
                        <span className="mb-1 block font-semibold text-accent">{c.sourceTitle}</span>
                        <span className="line-clamp-6 block text-muted">“{c.text.trim()}”</span>
                      </span>
                    </span>
                  );
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                );
              },
            }}
          >
            {md}
          </ReactMarkdown>
          {live && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-full bg-accent align-middle" />}
        </div>
      )}
      {m.error && <div className="mt-2 rounded-2xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">{m.error}</div>}
      {!live && !empty && (
        <div className="mt-1.5 flex items-center gap-0.5 opacity-60 transition group-hover:opacity-100">
          <IconButton
            label="Save to note"
            onClick={async () => {
              const now = Date.now();
              const firstLine = markdownToText(messageText(m)).split("\n").find((l) => l.trim()) ?? "Saved answer";
              await db.notes.add({ id: uid(), notebookId, title: firstLine.slice(0, 70), content: answerMarkdown(m), createdAt: now, updatedAt: now });
              toast("Saved to notes");
            }}
          >
            <NotebookPen className="size-4" />
          </IconButton>
          <IconButton
            label="Copy"
            onClick={() => {
              navigator.clipboard.writeText(answerMarkdown(m));
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
          </IconButton>
          <IconButton
            label={speaking ? "Stop reading" : "Read aloud"}
            onClick={() => {
              if (speaking) {
                speechSynthesis.cancel();
                setSpeaking(false);
              } else {
                setSpeaking(true);
                speak(messageText(m), () => setSpeaking(false));
              }
            }}
          >
            {speaking ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </IconButton>
          <DownloadMenu compact formats={["pdf", "docx", "md", "txt"]} onPick={(f) => exportMarkdown("Notara answer", answerMarkdown(m), f)} />
          {cites.size > 0 && <span className="ml-2 text-xs text-muted">{cites.size} citation{cites.size === 1 ? "" : "s"}</span>}
        </div>
      )}
    </div>
  );
}
