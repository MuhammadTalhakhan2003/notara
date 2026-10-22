"use client";

import {
  ArrowDownUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Expand,
  Maximize2,
  MessageCircleQuestion,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { downloadBlob, exportStudioItem, formatsFor, safeName } from "@/lib/exporters";
import type {
  AudioData,
  FlashcardsData,
  MindMapData,
  MindMapNode,
  QuizData,
  ReportData,
  SlidesData,
  TableData,
} from "@/lib/studio";
import { toolMeta } from "@/lib/studio";
import type { StudioItem } from "@/lib/types";
import { TOOL_ICON } from "./studio";
import { Button, DownloadMenu, IconButton, Modal, cx, inputCls } from "./ui";

export function StudioViewer({ item, onClose, onAsk }: { item: StudioItem; onClose: () => void; onAsk: (q: string) => void }) {
  const meta = toolMeta(item.type);
  const Icon = TOOL_ICON[item.type];
  const svgRef = useRef<SVGSVGElement>(null);

  const onPick = async (f: Parameters<typeof exportStudioItem>[1]) => {
    if ((f === "png" || f === "svg") && svgRef.current) return exportSvg(svgRef.current, item.title, f);
    return exportStudioItem(item, f);
  };
  const ask = (q: string) => {
    onAsk(q);
    onClose();
  };

  return (
    <Modal
      open
      full
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Icon className="size-5 shrink-0 text-accent" />
          <span className="truncate">{item.title}</span>
          <span className="hidden shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent sm:inline">{meta.label}</span>
        </span>
      }
      actions={<DownloadMenu formats={formatsFor(item)} onPick={onPick} />}
    >
      {meta.kind === "report" && <ReportView data={item.data as ReportData} />}
      {meta.kind === "mindmap" && <MindMapView data={item.data as MindMapData} svgRef={svgRef} onAsk={ask} />}
      {meta.kind === "flashcards" && <FlashcardsView data={item.data as FlashcardsData} />}
      {meta.kind === "quiz" && <QuizView data={item.data as QuizData} onAsk={ask} />}
      {meta.kind === "audio" && <AudioView data={item.data as AudioData} language={item.options.language} />}
      {meta.kind === "slides" && <SlidesView data={item.data as SlidesData} />}
      {meta.kind === "table" && <TableView data={item.data as TableData} />}
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function ReportView({ data }: { data: ReportData }) {
  return (
    <article className="prose-ink mx-auto max-w-3xl px-5 py-8 text-[15.5px] sm:px-8">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.markdown}</ReactMarkdown>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Mind map: a left-to-right tree drawn in SVG, with collapsible branches.

const BRANCH = [
  { fill: "#dff2f9", stroke: "#007ba7", text: "#00384d" },
  { fill: "#dcfce7", stroke: "#22c55e", text: "#14532d" },
  { fill: "#e0f2fe", stroke: "#0ea5e9", text: "#0c4a6e" },
  { fill: "#fef3c7", stroke: "#f59e0b", text: "#78350f" },
  { fill: "#ffe0ef", stroke: "#ff2d95", text: "#7a0a43" },
  { fill: "#ccfbf1", stroke: "#14b8a6", text: "#134e4a" },
  { fill: "#fce7f3", stroke: "#ec4899", text: "#831843" },
  { fill: "#e0e7ff", stroke: "#6366f1", text: "#312e81" },
];
const NODE_W = 200;
const NODE_H = 46;
const COL = 270;
const ROW = 58;

function wrap(label: string, max = 26): string[] {
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > 2) return [lines[0], lines.slice(1).join(" ").slice(0, max - 1) + "…"];
  return lines;
}

function MindMapView({ data, svgRef, onAsk }: { data: MindMapData; svgRef: React.RefObject<SVGSVGElement | null>; onAsk: (q: string) => void }) {
  const { root, kids, depthOf } = useMemo(() => {
    const ids = new Set(data.nodes.map((n) => n.id));
    const root = data.nodes.find((n) => n.parent === null) ?? data.nodes[0];
    const kids = new Map<string, MindMapNode[]>();
    for (const n of data.nodes) {
      if (n === root) continue;
      // Orphans (bad parent ids) hang off the root rather than disappearing.
      const p = n.parent && ids.has(n.parent) && n.parent !== n.id ? n.parent : root.id;
      kids.set(p, [...(kids.get(p) ?? []), n]);
    }
    const depthOf = new Map<string, number>();
    const walk = (id: string, d: number, seen: Set<string>) => {
      if (seen.has(id)) return;
      seen.add(id);
      depthOf.set(id, d);
      (kids.get(id) ?? []).forEach((c) => walk(c.id, d + 1, seen));
    };
    walk(root.id, 0, new Set());
    return { root, kids, depthOf };
  }, [data]);

  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(data.nodes.filter((n) => (depthOf.get(n.id) ?? 0) >= 2 && (kids.get(n.id)?.length ?? 0) > 0).map((n) => n.id)),
  );
  const [zoom, setZoom] = useState(1);
  const [active, setActive] = useState<MindMapNode | null>(null);

  const layout = useMemo(() => {
    const pos = new Map<string, { x: number; y: number; branch: number; node: MindMapNode }>();
    let row = 0;
    const place = (n: MindMapNode, depth: number, branch: number, seen: Set<string>): number => {
      if (seen.has(n.id)) return 0;
      seen.add(n.id);
      const children = collapsed.has(n.id) ? [] : (kids.get(n.id) ?? []);
      let y: number;
      if (!children.length) y = row++ * ROW;
      else {
        const ys = children.map((c, i) => place(c, depth + 1, depth === 0 ? i % BRANCH.length : branch, seen));
        y = (ys[0] + ys[ys.length - 1]) / 2;
      }
      pos.set(n.id, { x: depth * COL, y, branch, node: n });
      return y;
    };
    place(root, 0, 0, new Set());
    const maxX = Math.max(...[...pos.values()].map((p) => p.x)) + NODE_W;
    return { pos, width: maxX + 40, height: Math.max(row, 1) * ROW + 30 };
  }, [root, kids, collapsed]);

  const toggle = (id: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set([...kids.keys()].filter((id) => id !== root.id)));

  return (
    <div className="flex h-full min-h-[60dvh] flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-4 py-2">
        <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}>
          <Minus className="size-4" />
        </IconButton>
        <span className="w-12 text-center text-xs text-muted">{Math.round(zoom * 100)}%</span>
        <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(2, z + 0.15))}>
          <Plus className="size-4" />
        </IconButton>
        <Button size="sm" variant="ghost" onClick={expandAll}>
          <Expand className="size-3.5" /> Expand all
        </Button>
        <Button size="sm" variant="ghost" onClick={collapseAll}>
          Collapse
        </Button>
        <span className="ml-auto hidden text-xs text-muted sm:inline">Click a node to expand it and see details</span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle,var(--line)_1px,transparent_1px)] [background-size:22px_22px]">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          width={layout.width * zoom}
          height={layout.height * zoom}
          viewBox={`-20 -20 ${layout.width + 20} ${layout.height + 10}`}
          style={{ fontFamily: "Inter, Arial, sans-serif" }}
        >
          {[...layout.pos.values()].map(({ node, x, y }) => {
            const parent = node.parent ? layout.pos.get(node.parent) : undefined;
            if (!parent || node === root) return null;
            const c = BRANCH[layout.pos.get(node.id)!.branch];
            const x1 = parent.x + NODE_W;
            const y1 = parent.y + NODE_H / 2;
            const y2 = y + NODE_H / 2;
            return <path key={`e-${node.id}`} d={`M${x1},${y1} C${x1 + 40},${y1} ${x - 40},${y2} ${x},${y2}`} fill="none" stroke={c.stroke} strokeOpacity={0.55} strokeWidth={2} />;
          })}
          {[...layout.pos.values()].map(({ node, x, y, branch }) => {
            const isRoot = node === root;
            const c = isRoot ? { fill: "#0a0a0a", stroke: "#0a0a0a", text: "#ffffff" } : BRANCH[branch];
            const lines = wrap(node.label);
            const n = kids.get(node.id)?.length ?? 0;
            const isCollapsed = collapsed.has(node.id);
            return (
              <g
                key={node.id}
                transform={`translate(${x},${y})`}
                onClick={() => {
                  if (n) toggle(node.id);
                  setActive(node);
                }}
                style={{ cursor: "pointer" }}
              >
                <rect width={NODE_W} height={NODE_H} rx={14} fill={c.fill} stroke={active?.id === node.id ? "#f59e0b" : c.stroke} strokeWidth={active?.id === node.id ? 2.5 : 1.2} />
                <text x={14} y={lines.length === 1 ? NODE_H / 2 + 4.5 : NODE_H / 2 - 3} fontSize={13} fontWeight={isRoot ? 700 : 600} fill={c.text}>
                  {lines.map((l, i) => (
                    <tspan key={i} x={14} dy={i === 0 ? 0 : 15}>
                      {l}
                    </tspan>
                  ))}
                </text>
                {n > 0 && (
                  <g transform={`translate(${NODE_W + 2},${NODE_H / 2})`}>
                    <circle r={10} fill="#ffffff" stroke={c.stroke} strokeWidth={1.4} />
                    <text textAnchor="middle" y={4} fontSize={isCollapsed ? 10 : 13} fontWeight={700} fill={c.stroke}>
                      {isCollapsed ? n : "‹"}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
        {active && (
          <div className="animate-rise sticky bottom-3 left-3 m-3 max-w-md rounded-2xl border border-line bg-panel p-4 shadow-xl">
            <div className="flex items-start gap-2">
              <h3 className="flex-1 font-semibold">{active.label}</h3>
              <IconButton label="Close" className="size-7" onClick={() => setActive(null)}>
                <X className="size-3.5" />
              </IconButton>
            </div>
            {active.detail && <p className="mt-1 text-sm text-muted">{active.detail}</p>}
            <Button size="sm" variant="soft" className="mt-3" onClick={() => onAsk(`Tell me more about "${active.label}" from my sources.`)}>
              <MessageCircleQuestion className="size-4" /> Ask in chat
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

async function exportSvg(svg: SVGSVGElement, title: string, format: "png" | "svg") {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const vb = svg.viewBox.baseVal;
  clone.setAttribute("width", String(vb.width));
  clone.setAttribute("height", String(vb.height));
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", String(vb.x));
  bg.setAttribute("y", String(vb.y));
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);
  const xml = new XMLSerializer().serializeToString(clone);
  if (format === "svg") return downloadBlob(`${safeName(title)}.svg`, new Blob([xml], { type: "image/svg+xml" }));

  const scale = 2;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("Could not render the image"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = vb.width * scale;
  canvas.height = vb.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, vb.width, vb.height);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (blob) downloadBlob(`${safeName(title)}.png`, blob);
}

// ---------------------------------------------------------------------------

function FlashcardsView({ data }: { data: FlashcardsData }) {
  const [order, setOrder] = useState(() => data.cards.map((_, i) => i));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [grid, setGrid] = useState(false);
  const card = data.cards[order[i]];

  const go = useCallback(
    (d: number) => {
      setFlipped(false);
      setI((x) => Math.min(order.length - 1, Math.max(0, x + d)));
    },
    [order.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (grid)
    return (
      <div className="p-5">
        <Button size="sm" variant="soft" onClick={() => setGrid(false)} className="mb-4">
          Study mode
        </Button>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.cards.map((c, k) => (
            <div key={k} className="rounded-2xl border border-line bg-panel-2 p-4">
              <p className="font-semibold">{c.front}</p>
              <p className="mt-2 text-sm text-muted">{c.back}</p>
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-8">
      <div className="mb-4 flex w-full items-center gap-3 text-sm text-muted">
        <span>
          Card {i + 1} of {order.length}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${((i + 1) / order.length) * 100}%` }} />
        </div>
        <span className="text-emerald-600 dark:text-emerald-400">{known.size} known</span>
      </div>

      <button onClick={() => setFlipped((f) => !f)} className={cx("flip-card h-80 w-full", flipped && "flipped")} aria-label="Flip card">
        <div className="flip-inner relative h-full w-full">
          <div className="flip-face absolute inset-0 flex flex-col items-center justify-center rounded-[28px] border border-line bg-gradient-to-br from-accent-soft to-panel p-8 text-center shadow-lg">
            <span className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-accent">Question</span>
            <span className="font-display text-2xl font-semibold leading-snug">{card.front}</span>
            <span className="absolute bottom-4 text-xs text-muted">Click or press space to flip</span>
          </div>
          <div className="flip-face flip-back absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-[28px] border border-line bg-panel p-8 text-center shadow-lg">
            <span className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-rose">Answer</span>
            <span className="text-lg leading-relaxed">{card.back}</span>
          </div>
        </div>
      </button>

      <div className="mt-6 flex w-full items-center justify-between gap-2">
        <IconButton label="Previous" onClick={() => go(-1)} disabled={i === 0} className="size-11 border border-line">
          <ChevronLeft className="size-5" />
        </IconButton>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const next = new Set(known);
              next.delete(order[i]);
              setKnown(next);
              go(1);
            }}
          >
            Still learning
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setKnown(new Set(known).add(order[i]));
              go(1);
            }}
          >
            <Check className="size-4" /> I know it
          </Button>
        </div>
        <IconButton label="Next" onClick={() => go(1)} disabled={i === order.length - 1} className="size-11 border border-line">
          <ChevronRight className="size-5" />
        </IconButton>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOrder([...order].sort(() => Math.random() - 0.5));
            setI(0);
            setFlipped(false);
          }}
        >
          <Shuffle className="size-3.5" /> Shuffle
        </Button>
        {known.size > 0 && known.size < order.length && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setOrder(order.filter((k) => !known.has(k)));
              setI(0);
              setFlipped(false);
            }}
          >
            <RotateCcw className="size-3.5" /> Review the {order.length - known.size} I&apos;m learning
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setGrid(true)}>
          See all cards
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function QuizView({ data, onAsk }: { data: QuizData; onAsk: (q: string) => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => data.questions.map(() => null));
  const [i, setI] = useState(0);
  const done = i >= data.questions.length;
  const score = answers.filter((a, k) => a === data.questions[k].answerIndex).length;

  if (done)
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="rounded-[28px] bg-gradient-to-br from-accent-soft to-panel-2 p-8 text-center">
          <p className="text-sm font-medium text-muted">Your score</p>
          <p className="mt-1 font-display text-6xl font-semibold text-accent">
            {score}/{data.questions.length}
          </p>
          <p className="mt-2 text-muted">
            {score === data.questions.length ? "Perfect score! Your teachers would be suspicious. 🎉" : score / data.questions.length >= 0.7 ? "Great work! Nearly professor material." : "Every expert was once a beginner. Review the explanations below and try again."}
          </p>
          <Button
            variant="primary"
            className="mt-5"
            onClick={() => {
              setAnswers(data.questions.map(() => null));
              setI(0);
            }}
          >
            <RotateCcw className="size-4" /> Retake quiz
          </Button>
        </div>
        <ol className="mt-8 space-y-4">
          {data.questions.map((q, k) => {
            const right = answers[k] === q.answerIndex;
            return (
              <li key={k} className="rounded-2xl border border-line p-4">
                <p className="font-medium">
                  <span className={right ? "text-emerald-500" : "text-danger"}>{right ? "✓" : "✗"}</span> {k + 1}. {q.question}
                </p>
                <p className="mt-1 text-sm">
                  Correct answer: <b>{q.options[q.answerIndex]}</b>
                </p>
                <p className="mt-1 text-sm text-muted">{q.explanation}</p>
              </li>
            );
          })}
        </ol>
      </div>
    );

  const q = data.questions[i];
  const picked = answers[i];
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-5 flex items-center gap-3 text-sm text-muted">
        <span>
          Question {i + 1} of {data.questions.length}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(i / data.questions.length) * 100}%` }} />
        </div>
      </div>
      <h3 className="font-display text-2xl font-semibold leading-snug">{q.question}</h3>
      <div className="mt-5 space-y-2.5">
        {q.options.map((o, k) => {
          const state = picked === null ? "idle" : k === q.answerIndex ? "right" : k === picked ? "wrong" : "dim";
          return (
            <button
              key={k}
              disabled={picked !== null}
              onClick={() => setAnswers(answers.map((a, j) => (j === i ? k : a)))}
              className={cx(
                "flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition",
                state === "idle" && "border-line hover:border-accent hover:bg-accent-soft/50",
                state === "right" && "border-emerald-500 bg-emerald-500/10",
                state === "wrong" && "border-danger bg-danger/10",
                state === "dim" && "border-line opacity-60",
              )}
            >
              <span
                className={cx(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  state === "right" ? "border-emerald-500 bg-emerald-500 text-white" : state === "wrong" ? "border-danger bg-danger text-white" : "border-line",
                )}
              >
                {state === "right" ? "✓" : state === "wrong" ? "✗" : String.fromCharCode(65 + k)}
              </span>
              <span className="pt-0.5">{o}</span>
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div className="animate-rise mt-5 rounded-2xl bg-panel-2 p-4">
          <p className={cx("font-semibold", picked === q.answerIndex ? "text-emerald-600 dark:text-emerald-400" : "text-danger")}>
            {picked === q.answerIndex ? "Correct!" : "Not quite."}
          </p>
          <p className="mt-1 text-sm text-muted">{q.explanation}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setI(i + 1)}>
              {i === data.questions.length - 1 ? "See results" : "Next question"} <ChevronRight className="size-4" />
            </Button>
            {picked !== q.answerIndex && (
              <Button variant="ghost" onClick={() => onAsk(`Help me understand: ${q.question} Why is the answer "${q.options[q.answerIndex]}"?`)}>
                <MessageCircleQuestion className="size-4" /> Explain in chat
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audio overview: the script is played with the device's speech voices.

const LANG_CODE: Record<string, string> = {
  English: "en", Urdu: "ur", "Roman Urdu": "en", Hindi: "hi", Arabic: "ar", Spanish: "es", French: "fr", German: "de",
  Portuguese: "pt", Turkish: "tr", Chinese: "zh", Japanese: "ja", Korean: "ko", Indonesian: "id", Bengali: "bn", Russian: "ru",
};

function AudioView({ data, language }: { data: AudioData; language: string }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceIdx, setVoiceIdx] = useState<[number, number]>([0, 1]);
  const [line, setLine] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const playingRef = useRef(false);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => {
      const code = LANG_CODE[language] ?? "en";
      const all = speechSynthesis.getVoices();
      const matching = all.filter((v) => v.lang.toLowerCase().startsWith(code));
      const list = matching.length ? [...matching, ...all.filter((v) => !matching.includes(v))] : all;
      setVoices(list);
      // Prefer two different natural-sounding voices for the two hosts.
      const good = list.map((v, k) => ({ v, k })).filter(({ v }) => v.lang.toLowerCase().startsWith(code));
      const rank = (v: SpeechSynthesisVoice) => (/natural|neural|online|google/i.test(v.name) ? 0 : 1);
      good.sort((a, b) => rank(a.v) - rank(b.v));
      setVoiceIdx([good[0]?.k ?? 0, good.find((g) => g.k !== good[0]?.k)?.k ?? Math.min(1, list.length - 1)]);
    };
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", load);
      speechSynthesis.cancel();
    };
  }, [language]);

  const speakFrom = useCallback(
    (k: number) => {
      if (k >= data.lines.length) {
        playingRef.current = false;
        setPlaying(false);
        setLine(0);
        return;
      }
      setLine(k);
      lineRefs.current[k]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const l = data.lines[k];
      const u = new SpeechSynthesisUtterance(l.text);
      const v = voices[voiceIdx[l.speaker === 1 ? 1 : 0]];
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      }
      u.rate = rate;
      u.pitch = l.speaker === 1 ? 0.95 : 1.05;
      u.onend = () => playingRef.current && speakFrom(k + 1);
      speechSynthesis.speak(u);
    },
    [data.lines, voices, voiceIdx, rate],
  );

  const play = (from = line) => {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    playingRef.current = true;
    setPlaying(true);
    speakFrom(from);
  };
  const pause = () => {
    playingRef.current = false;
    setPlaying(false);
    speechSynthesis.cancel();
  };

  const hosts = data.hosts.length >= 2 ? data.hosts : [{ name: "Host A", persona: "" }, { name: "Host B", persona: "" }];
  const progress = (line / Math.max(1, data.lines.length - 1)) * 100;

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <div className="rounded-[28px] bg-gradient-to-br from-[#0a0a0a] via-[#0a0a0a] to-[#005677] ring-1 ring-white/10 p-6 text-white shadow-xl">
        <div className="flex items-center gap-3">
          {hosts.slice(0, 2).map((h, k) => (
            <div key={k} className={cx("flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 transition", playing && data.lines[line]?.speaker === k && "bg-white/25 ring-2 ring-[#ff2d95]")}>
              <span className={cx("flex size-8 items-center justify-center rounded-full text-sm font-bold", k ? "bg-[#ff2d95] text-white" : "bg-[#007ba7] text-white")}>{h.name[0]}</span>
              <span className="text-sm">{h.name}</span>
            </div>
          ))}
        </div>
        <h3 className="mt-5 font-display text-2xl font-semibold">{data.title}</h3>
        <div className="mt-5 flex h-10 items-end gap-[3px]" aria-hidden>
          {Array.from({ length: 56 }, (_, k) => (
            <span
              key={k}
              className={cx("w-full rounded-full transition-all", (k / 56) * 100 <= progress ? "bg-[#ff2d95]" : "bg-white/25", playing && "animate-pulse")}
              style={{ height: `${25 + Math.abs(Math.sin(k * 1.7) * 60) + (k % 5) * 3}%`, animationDelay: `${(k % 7) * 90}ms` }}
            />
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button aria-label="Back" onClick={() => (playing ? play(Math.max(0, line - 1)) : setLine(Math.max(0, line - 1)))} className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <SkipBack className="size-4" />
          </button>
          <button
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => (playing ? pause() : play())}
            className="flex size-14 items-center justify-center rounded-full bg-white text-[#0a0a0a] shadow-lg transition hover:scale-105"
          >
            {playing ? <Pause className="size-6 fill-current" /> : <Play className="ml-1 size-6 fill-current" />}
          </button>
          <button aria-label="Forward" onClick={() => (playing ? play(Math.min(data.lines.length - 1, line + 1)) : setLine(Math.min(data.lines.length - 1, line + 1)))} className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            <SkipForward className="size-4" />
          </button>
          <span className="text-sm text-white/80">
            {line + 1} / {data.lines.length}
          </span>
          <select
            aria-label="Speed"
            value={rate}
            onChange={(e) => {
              setRate(Number(e.target.value));
              if (playing) setTimeout(() => play(line), 0);
            }}
            className="ml-auto rounded-full border-0 bg-white/15 px-3 py-1.5 text-sm text-white outline-none [&>option]:text-black"
          >
            {[0.8, 1, 1.15, 1.3, 1.5].map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        </div>
      </div>

      {voices.length > 1 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[0, 1].map((h) => (
            <label key={h} className="text-xs text-muted">
              Voice for {hosts[h].name}
              <select
                className={cx(inputCls, "mt-1 py-1.5 text-xs")}
                value={voiceIdx[h]}
                onChange={(e) => {
                  const next: [number, number] = [...voiceIdx] as [number, number];
                  next[h] = Number(e.target.value);
                  setVoiceIdx(next);
                }}
              >
                {voices.map((v, k) => (
                  <option key={k} value={k}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-muted">Plays with your device&apos;s built-in voices. Download the script from the Download menu.</p>

      <div className="mt-6 space-y-1">
        {data.lines.map((l, k) => (
          <button
            key={k}
            ref={(el) => {
              lineRefs.current[k] = el;
            }}
            onClick={() => play(k)}
            className={cx("flex w-full gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-accent-soft/50", k === line && "bg-accent-soft")}
          >
            <span className={cx("mt-0.5 w-20 shrink-0 truncate text-xs font-semibold", l.speaker ? "text-[#ff2d95]" : "text-[#007ba7] dark:text-[#3ab4e0]")}>
              {hosts[l.speaker === 1 ? 1 : 0].name}
            </span>
            <span className="text-[14.5px] leading-relaxed">{l.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SlidesView({ data }: { data: SlidesData }) {
  const [i, setI] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const s = data.slides[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") setI((x) => Math.min(data.slides.length - 1, x + 1));
      if (e.key === "ArrowLeft" || e.key === "PageUp") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data.slides.length]);

  return (
    <div className="flex flex-col gap-4 p-4 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div ref={stageRef} className="relative aspect-video w-full overflow-hidden rounded-2xl shadow-xl [container-type:inline-size]">
          <Slide slide={s} index={i} />
          <button
            aria-label="Present full screen"
            onClick={() => stageRef.current?.requestFullscreen?.()}
            className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/20 text-white opacity-60 hover:opacity-100"
          >
            <Maximize2 className="size-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-center gap-3">
          <IconButton label="Previous slide" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="border border-line">
            <ChevronLeft className="size-4" />
          </IconButton>
          <span className="text-sm text-muted">
            {i + 1} / {data.slides.length}
          </span>
          <IconButton label="Next slide" onClick={() => setI(Math.min(data.slides.length - 1, i + 1))} disabled={i === data.slides.length - 1} className="border border-line">
            <ChevronRight className="size-4" />
          </IconButton>
        </div>
        {s.notes && (
          <div className="mt-3 rounded-2xl bg-panel-2 p-4 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">Speaker notes</p>
            {s.notes}
          </div>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto lg:w-48 lg:flex-col lg:overflow-y-auto">
        {data.slides.map((sl, k) => (
          <button key={k} onClick={() => setI(k)} className={cx("relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg border-2 [container-type:inline-size] lg:w-full", k === i ? "border-accent" : "border-transparent opacity-70 hover:opacity-100")}>
            <Slide slide={sl} index={k} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Slide({ slide, index }: { slide: SlidesData["slides"][number]; index: number }) {
  if (index === 0)
    return (
      <div className="flex h-full flex-col justify-center bg-[#0a0a0a] p-[7cqw] text-left text-white">
        <h2 className="font-display text-[5.2cqw] font-semibold leading-tight">{slide.title}</h2>
        <div className="my-[2.5cqw] h-[0.6cqw] w-[11cqw] bg-[#ff2d95]" />
        <p className="text-[2.2cqw] text-[#8fd6ef]">{slide.bullets.join("  ·  ")}</p>
      </div>
    );
  return (
    <div className="relative flex h-full flex-col bg-white p-[5cqw] pl-[6.5cqw] text-left text-stone-800">
      <div className="absolute inset-y-0 left-0 w-[1.3cqw] bg-[#007ba7]" />
      <h2 className="font-display text-[3.6cqw] font-semibold leading-tight text-[#0a0a0a]">{slide.title}</h2>
      <ul className="mt-[2.5cqw] space-y-[1.4cqw] text-[2.3cqw] leading-snug">
        {slide.bullets.map((b, k) => (
          <li key={k} className="flex gap-[1.2cqw]">
            <span className="mt-[0.9cqw] size-[0.9cqw] shrink-0 rounded-full bg-[#ff2d95]" />
            {b}
          </li>
        ))}
      </ul>
      <span className="absolute bottom-[2cqw] right-[3cqw] text-[1.4cqw] text-stone-400">{index + 1}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TableView({ data }: { data: TableData }) {
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    let r = t ? data.rows.filter((row) => row.some((c) => c?.toLowerCase().includes(t))) : data.rows;
    if (sort) {
      const num = (v: string) => Number(String(v).replace(/[^0-9.-]/g, ""));
      r = [...r].sort((a, b) => {
        const x = a[sort.col] ?? "";
        const y = b[sort.col] ?? "";
        const nx = num(x);
        const ny = num(y);
        const cmp = !isNaN(nx) && !isNaN(ny) && /\d/.test(x) && /\d/.test(y) ? nx - ny : x.localeCompare(y);
        return cmp * sort.dir;
      });
    }
    return r;
  }, [data.rows, sort, q]);

  return (
    <div className="p-5">
      <div className="relative mb-3 max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input className={cx(inputCls, "rounded-full pl-9")} placeholder="Filter rows" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-accent-soft">
              {data.columns.map((c, k) => (
                <th key={k} className="whitespace-nowrap px-3 py-2.5 text-left font-semibold">
                  <button className="inline-flex items-center gap-1" onClick={() => setSort(sort?.col === k ? { col: k, dir: sort.dir === 1 ? -1 : 1 } : { col: k, dir: 1 })}>
                    {c} <ArrowDownUp className={cx("size-3", sort?.col === k ? "text-accent" : "text-muted")} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => (
              <tr key={k} className="border-t border-line odd:bg-panel-2/60">
                {data.columns.map((_, c) => (
                  <td key={c} className="px-3 py-2 align-top">
                    {r[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        {rows.length} of {data.rows.length} rows · click a column to sort
      </p>
    </div>
  );
}
