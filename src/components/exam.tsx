"use client";

import { ArrowRight, BookOpen, Check, ChevronDown, FileText, RotateCcw, ShieldCheck, Sparkles, Target, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { SAMPLE_CONTENT, SAMPLE_TITLE } from "@/lib/exam/sample";
import sampleSet from "@/lib/exam/sample-set.json";
import type { ExamQuestion, ExamRequest, ExamSet } from "@/lib/exam/types";
import { Button, Logo, ThemeToggle, cx } from "./ui";

// Exam Coach: a mobile-first practice flow. Every explanation is backed by a quote that the
// server found in the study material; questions whose quote could not be found never reach here.

const SAMPLE = sampleSet as ExamSet;
const LETTERS = ["A", "B", "C", "D"];

interface Material {
  title: string;
  content: string;
}

type Stage =
  | { kind: "home" }
  | { kind: "loading"; label: string }
  | { kind: "practice"; set: ExamSet; answers: (number | null)[]; i: number }
  | { kind: "results"; set: ExamSet; answers: number[] };

export function ExamCoach() {
  const [stage, setStage] = useState<Stage>({ kind: "home" });
  const [material, setMaterial] = useState<Material>({ title: SAMPLE_TITLE, content: SAMPLE_CONTENT });
  const [seen, setSeen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stage.kind]);

  const start = (set: ExamSet) => {
    setSeen((s) => [...s, ...set.questions.map((q) => q.question)].slice(-40));
    setStage({ kind: "practice", set, answers: set.questions.map(() => null), i: 0 });
  };

  async function generate(m: Material, opts: { count: number; focus?: string[]; label: string }) {
    setError(null);
    setMaterial(m);
    setStage({ kind: "loading", label: opts.label });
    try {
      const body: ExamRequest = { title: m.title, content: m.content, count: opts.count, focus: opts.focus, avoid: seen };
      start(await api<ExamSet>("/api/exam", body));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage({ kind: "home" });
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
          <Link href="/" aria-label="Notara home">
            <Logo />
          </Link>
          <span className="mx-1 h-5 w-px bg-line" />
          <button onClick={() => setStage({ kind: "home" })} className="text-sm font-semibold">
            Exam Coach
          </button>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">Demo</span>
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-6">
        {stage.kind === "home" && (
          <Home
            error={error}
            onSample={() => start(SAMPLE)}
            onGenerate={(m, count) => generate(m, { count, label: "Writing your questions" })}
          />
        )}
        {stage.kind === "loading" && <Loading label={stage.label} />}
        {stage.kind === "practice" && (
          <Practice
            key={stage.set.questions[0]?.id}
            stage={stage}
            onAnswer={(answers) => setStage({ ...stage, answers })}
            onNext={() =>
              stage.i + 1 < stage.set.questions.length
                ? setStage({ ...stage, i: stage.i + 1 })
                : setStage({ kind: "results", set: stage.set, answers: stage.answers as number[] })
            }
          />
        )}
        {stage.kind === "results" && (
          <Results
            set={stage.set}
            answers={stage.answers}
            onRetry={() => start({ ...stage.set, questions: stage.set.questions })}
            onDrill={(focus) => generate(material, { count: 5, focus, label: `Drilling ${focus.join(", ")}` })}
            onNewSet={() => generate(material, { count: 8, label: "Writing a fresh set" })}
          />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Home({ error, onSample, onGenerate }: { error: string | null; onSample: () => void; onGenerate: (m: Material, count: number) => void }) {
  const [own, setOwn] = useState({ title: "", content: "" });
  const [count, setCount] = useState(6);
  const [notes, setNotes] = useState(false);
  const ready = own.content.trim().length >= 300;
  const topics = useMemo(() => [...new Set(SAMPLE.questions.map((q) => q.topic))], []);

  return (
    <div className="animate-rise">
      <p className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-medium text-muted">
        <ShieldCheck className="size-3.5 text-emerald-500" /> Every explanation is verified against the source
      </p>
      <h1 className="mt-4 font-display text-[2rem] font-semibold leading-tight tracking-tight sm:text-4xl">
        Practice questions you can <span className="text-accent">trust.</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Exam Coach turns study material into exam-style questions. Each answer shows the exact line it comes from, and the server
        throws out any question whose quote it can&apos;t find in the material, so a made-up explanation never reaches the learner.
      </p>

      {error && (
        <div role="alert" className="mt-5 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Built-in pack: instant, no AI call needed */}
      <section className="mt-6 overflow-hidden rounded-3xl border border-line bg-panel">
        <div className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
            <BookOpen className="size-4" /> Study pack
          </div>
          <h2 className="mt-2 font-display text-xl font-semibold">Networking Essentials</h2>
          <p className="text-sm text-muted">CompTIA A+ Core 1 · {SAMPLE.questions.length} questions · about 5 minutes</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {topics.map((t) => (
              <span key={t} className="rounded-full bg-panel-2 px-2.5 py-1 text-xs text-muted">
                {t}
              </span>
            ))}
          </div>
          <Button variant="primary" className="mt-5 h-12 w-full text-[15px]" onClick={onSample}>
            Start practice <ArrowRight className="size-4" />
          </Button>
        </div>
        <button
          onClick={() => setNotes(!notes)}
          aria-expanded={notes}
          className="flex w-full items-center justify-between border-t border-line px-5 py-3 text-sm text-muted hover:bg-panel-2"
        >
          Read the study notes the questions come from
          <ChevronDown className={cx("size-4 transition", notes && "rotate-180")} />
        </button>
        {notes && (
          <div className="max-h-96 overflow-y-auto border-t border-line bg-panel-2 px-5 py-4 text-sm leading-relaxed">
            {SAMPLE_CONTENT.trim()
              .split(/\n\s*\n/)
              .map((p, k) =>
                p.length < 40 ? (
                  <h3 key={k} className="mt-4 font-semibold first:mt-0">
                    {p}
                  </h3>
                ) : (
                  <p key={k} className="mt-2 text-muted">
                    {p}
                  </p>
                ),
              )}
          </div>
        )}
      </section>

      {/* Own material: live generation */}
      <section className="mt-4 rounded-3xl border border-line bg-panel p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose">
          <Sparkles className="size-4" /> Your material
        </div>
        <h2 className="mt-2 font-display text-xl font-semibold">Generate from any notes</h2>
        <p className="text-sm text-muted">Paste a chapter, a lecture transcript or official exam objectives.</p>
        <input
          value={own.title}
          onChange={(e) => setOwn({ ...own, title: e.target.value })}
          placeholder="Title, e.g. Pharmacology: Antibiotics"
          className="mt-4 h-11 w-full rounded-xl border border-line bg-panel-2 px-3 text-[15px] outline-none focus:border-accent"
        />
        <textarea
          value={own.content}
          onChange={(e) => setOwn({ ...own, content: e.target.value })}
          placeholder="Paste your study material here…"
          rows={6}
          className="mt-2 w-full resize-y rounded-xl border border-line bg-panel-2 px-3 py-2.5 text-[15px] outline-none focus:border-accent"
        />
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="count" className="text-sm text-muted">
            Questions
          </label>
          <select
            id="count"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-10 rounded-xl border border-line bg-panel-2 px-2 text-sm"
          >
            {[4, 6, 8].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <div className="flex-1" />
          <Button
            variant="soft"
            className="h-11"
            disabled={!ready}
            title={ready ? undefined : "Paste at least a few paragraphs"}
            onClick={() => onGenerate({ title: own.title.trim() || "My study material", content: own.content }, count)}
          >
            Generate <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>

      <ol className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          ["Read", "The material is split into passages the model can cite."],
          ["Write", "The model writes questions, a reason for every wrong option and a supporting quote."],
          ["Verify", "The server finds each quote in the source. No match, no question."],
        ].map(([t, d], k) => (
          <li key={t} className="rounded-2xl border border-line p-4">
            <p className="text-xs font-semibold text-accent">Step {k + 1}</p>
            <p className="mt-1 font-semibold">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Loading({ label }: { label: string }) {
  const steps = ["Reading the material", "Writing exam-style questions", "Checking every quote against the source"];
  const [k, setK] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setK((n) => Math.min(n + 1, steps.length - 1)), 4500);
    return () => clearInterval(t);
  }, [steps.length]);
  return (
    <div className="animate-rise py-10" role="status" aria-live="polite">
      <h2 className="font-display text-2xl font-semibold">{label}…</h2>
      <p className="mt-1 text-sm text-muted">This usually takes 10–30 seconds.</p>
      <ol className="mt-6 space-y-3">
        {steps.map((s, n) => (
          <li key={s} className={cx("flex items-center gap-3 text-[15px] transition", n > k && "opacity-40")}>
            <span
              className={cx(
                "flex size-6 items-center justify-center rounded-full border",
                n < k ? "border-emerald-500 bg-emerald-500 text-white" : n === k ? "border-accent" : "border-line",
              )}
            >
              {n < k ? <Check className="size-3.5" /> : n === k ? <span className="size-2 animate-pulse rounded-full bg-accent" /> : null}
            </span>
            {s}
          </li>
        ))}
      </ol>
      <div className="mt-8 space-y-2.5">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="shimmer h-14 rounded-2xl border border-line" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Practice({
  stage,
  onAnswer,
  onNext,
}: {
  stage: Extract<Stage, { kind: "practice" }>;
  onAnswer: (answers: (number | null)[]) => void;
  onNext: () => void;
}) {
  const { set, answers, i } = stage;
  const q = set.questions[i];
  const picked = answers[i];
  const answered = picked !== null;
  const last = i + 1 === set.questions.length;
  const pick = (k: number) => !answered && onAnswer(answers.map((a, j) => (j === i ? k : a)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = "1234".indexOf(e.key) >= 0 ? Number(e.key) - 1 : "abcd".indexOf(e.key.toLowerCase());
      if (!answered && n >= 0 && n < 4) pick(n);
      else if (answered && e.key === "Enter") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div key={q.id} className="animate-rise">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="tabular-nums">
          {i + 1}/{set.questions.length}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={i + 1} aria-valuemax={set.questions.length}>
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${((i + (answered ? 1 : 0)) / set.questions.length) * 100}%` }} />
        </div>
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-accent">{q.topic}</p>
      <h2 className="mt-2 font-display text-[1.35rem] font-semibold leading-snug">{q.question}</h2>

      <div className="mt-5 space-y-2.5">
        {q.options.map((o, k) => {
          const state = !answered ? "idle" : k === q.answerIndex ? "right" : k === picked ? "wrong" : "dim";
          return (
            <button
              key={k}
              disabled={answered}
              onClick={() => pick(k)}
              className={cx(
                "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] transition",
                state === "idle" && "border-line bg-panel hover:border-accent active:scale-[0.99]",
                state === "right" && "border-emerald-500 bg-emerald-500/10",
                state === "wrong" && "border-danger bg-danger/10",
                state === "dim" && "border-line opacity-55",
              )}
            >
              <span
                className={cx(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  state === "right" ? "border-emerald-500 bg-emerald-500 text-white" : state === "wrong" ? "border-danger bg-danger text-white" : "border-line text-muted",
                )}
              >
                {state === "right" ? <Check className="size-4" /> : state === "wrong" ? <X className="size-4" /> : LETTERS[k]}
              </span>
              {o}
            </button>
          );
        })}
      </div>

      {answered && <Feedback q={q} picked={picked} />}

      {answered && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto max-w-2xl px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button variant="primary" className="h-12 w-full text-[15px]" onClick={onNext}>
              {last ? "See results" : "Next question"} <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Feedback({ q, picked }: { q: ExamQuestion; picked: number }) {
  const right = picked === q.answerIndex;
  return (
    <div className="mt-5 animate-rise space-y-3">
      <div className={cx("rounded-2xl p-4", right ? "bg-emerald-500/10" : "bg-danger/10")}>
        <p className={cx("font-semibold", right ? "text-emerald-600 dark:text-emerald-400" : "text-danger")}>
          {right ? "Correct" : `Not quite. The answer is ${LETTERS[q.answerIndex]}.`}
        </p>
        <p className="mt-1 text-[15px] leading-relaxed">{q.explanation}</p>
        {!right && q.whyWrong[picked] && (
          <p className="mt-3 text-[15px] leading-relaxed">
            <span className="font-semibold">Why not {LETTERS[picked]}?</span> {q.whyWrong[picked]}
          </p>
        )}
      </div>
      <Evidence q={q} />
    </div>
  );
}

function Evidence({ q }: { q: ExamQuestion }) {
  const [open, setOpen] = useState(false);
  const { passage, highlight, sourceTitle } = q.evidence;
  const [a, b] = highlight;
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <ShieldCheck className="size-4 text-emerald-500" />
        <span className="shrink-0 whitespace-nowrap font-medium text-emerald-600 dark:text-emerald-400">Verified in source</span>
        <span aria-hidden>·</span>
        <span className="flex min-w-0 items-center gap-1 truncate">
          <FileText className="size-3.5 shrink-0" /> <span className="truncate">{sourceTitle}</span>
        </span>
      </div>
      {open ? (
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          {passage.slice(0, a)}
          <mark className="cite-hl text-ink">{passage.slice(a, b)}</mark>
          {passage.slice(b)}
        </p>
      ) : (
        <blockquote className="mt-3 border-l-[3px] border-rose pl-3 text-[15px] leading-relaxed">“{passage.slice(a, b)}”</blockquote>
      )}
      <button onClick={() => setOpen(!open)} className="mt-2 text-sm font-medium text-accent">
        {open ? "Show quote only" : "Show in context"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Results({
  set,
  answers,
  onRetry,
  onDrill,
  onNewSet,
}: {
  set: ExamSet;
  answers: number[];
  onRetry: () => void;
  onDrill: (focus: string[]) => void;
  onNewSet: () => void;
}) {
  const [review, setReview] = useState(false);
  const total = set.questions.length;
  const score = answers.filter((a, k) => a === set.questions[k].answerIndex).length;
  const pct = Math.round((score / total) * 100);

  const topics = useMemo(() => {
    const m = new Map<string, { right: number; total: number }>();
    set.questions.forEach((q, k) => {
      const t = m.get(q.topic) ?? { right: 0, total: 0 };
      t.total++;
      if (answers[k] === q.answerIndex) t.right++;
      m.set(q.topic, t);
    });
    return [...m].map(([topic, t]) => ({ topic, ...t, pct: t.right / t.total })).sort((x, y) => x.pct - y.pct);
  }, [set, answers]);
  const weak = topics.filter((t) => t.pct < 1).map((t) => t.topic);

  return (
    <div className="animate-rise">
      <div className="rounded-3xl bg-gradient-to-br from-accent-soft to-panel-2 p-6 text-center">
        <p className="text-sm font-medium text-muted">Your score</p>
        <p className="mt-1 font-display text-6xl font-semibold tabular-nums text-accent">{pct}%</p>
        <p className="mt-1 text-sm text-muted">
          {score} of {total} correct
        </p>
        <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-panel px-3 py-1 text-xs text-muted">
          <ShieldCheck className="size-3.5 text-emerald-500" />
          {set.provider === "sample"
            ? `All ${total} explanations backed by verified quotes`
            : `${total} of ${set.checked} generated questions passed quote verification`}
        </p>
      </div>

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold">Topic mastery</h2>
        <ul className="mt-3 space-y-3">
          {topics.map((t) => (
            <li key={t.topic}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{t.topic}</span>
                <span className="tabular-nums text-muted">
                  {t.right}/{t.total}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                <div
                  className={cx("h-full rounded-full", t.pct === 1 ? "bg-emerald-500" : t.pct >= 0.5 ? "bg-amber-500" : "bg-danger")}
                  style={{ width: `${Math.max(t.pct * 100, 4)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 space-y-2.5">
        {weak.length > 0 ? (
          <Button variant="primary" className="h-12 w-full text-[15px]" onClick={() => onDrill(weak.slice(0, 3))}>
            <Target className="size-4" /> Drill my weak topics
          </Button>
        ) : (
          <p className="rounded-2xl bg-emerald-500/10 p-4 text-center text-sm">Every topic mastered. Try a fresh set to keep it that way.</p>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <Button className="h-12" onClick={onNewSet}>
            <Sparkles className="size-4" /> New questions
          </Button>
          <Button className="h-12" onClick={onRetry}>
            <RotateCcw className="size-4" /> Retake
          </Button>
        </div>
        {weak.length > 0 && <p className="text-center text-xs text-muted">Drilling writes new questions on: {weak.slice(0, 3).join(", ")}</p>}
      </div>

      <button
        onClick={() => setReview(!review)}
        aria-expanded={review}
        className="mt-8 flex w-full items-center justify-between rounded-2xl border border-line px-4 py-3 text-sm font-medium"
      >
        Review all answers
        <ChevronDown className={cx("size-4 transition", review && "rotate-180")} />
      </button>
      {review && (
        <ol className="mt-3 space-y-3">
          {set.questions.map((q, k) => {
            const right = answers[k] === q.answerIndex;
            return (
              <li key={q.id} className="rounded-2xl border border-line p-4">
                <p className="text-[15px] font-medium">
                  <span className={right ? "text-emerald-500" : "text-danger"}>{right ? "✓" : "✗"}</span> {q.question}
                </p>
                {!right && (
                  <p className="mt-1 text-sm text-muted">
                    You chose: {q.options[answers[k]]}
                  </p>
                )}
                <p className="mt-1 text-sm">
                  Answer: <b>{q.options[q.answerIndex]}</b>
                </p>
                <p className="mt-1 text-sm text-muted">{q.explanation}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
