"use client";

import {
  CheckSquare,
  ClipboardPaste,
  Compass,
  Download,
  ExternalLink,
  FileText,
  FileType2,
  Globe,
  Image as ImageIcon,
  Link2,
  MonitorPlay,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Square,
  StickyNote,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { api, prefs, toPayload, wordCount } from "@/lib/client";
import { db, touchNotebook, uid } from "@/lib/db";
import { exportMarkdown } from "@/lib/exporters";
import { ACCEPT, parseFile } from "@/lib/parsers";
import type { Source, SourceGuide, SourceKind } from "@/lib/types";
import { Button, DownloadMenu, IconButton, Menu, Modal, Spinner, cx, inputCls, toast } from "./ui";

export const KIND_ICON: Record<SourceKind, typeof FileText> = {
  pdf: FileType2,
  docx: FileText,
  text: FileText,
  markdown: FileText,
  url: Globe,
  youtube: MonitorPlay,
  image: ImageIcon,
  paste: ClipboardPaste,
  note: StickyNote,
};

const KIND_TINT: Record<SourceKind, string> = {
  pdf: "text-rose-500",
  docx: "text-sky-500",
  text: "text-stone-500",
  markdown: "text-stone-500",
  url: "text-emerald-500",
  youtube: "text-red-500",
  image: "text-amber-500",
  paste: "text-rose",
  note: "text-yellow-500",
};

/** Saves a new source, then asks Claude for its summary/topics in the background. */
export async function addSource(notebookId: string, s: { title: string; kind: SourceKind; content: string; url?: string }) {
  const content = s.content.trim();
  if (!content) throw new Error(`"${s.title}" has no readable text.`);
  const source: Source = {
    id: uid(),
    notebookId,
    title: s.title.trim().slice(0, 200) || "Untitled source",
    kind: s.kind,
    content,
    url: s.url,
    size: content.length,
    selected: true,
    createdAt: Date.now(),
    guideStatus: "pending",
  };
  await db.sources.add(source);
  await touchNotebook(notebookId);
  // Name an untitled notebook after its first source.
  const nb = await db.notebooks.get(notebookId);
  if (nb && nb.title === "Untitled notebook") await db.notebooks.update(notebookId, { title: source.title.slice(0, 80) });
  generateGuide(source);
  return source;
}

export async function generateGuide(source: Source) {
  await db.sources.update(source.id, { guideStatus: "pending" });
  try {
    const { guide } = await api<{ guide: SourceGuide }>("/api/guide", {
      sources: toPayload([source]),
      scope: "source",
      language: prefs.get("language") || undefined,
    });
    await db.sources.update(source.id, { guide, guideStatus: "ready" });
  } catch {
    await db.sources.update(source.id, { guideStatus: "error" });
  }
}

// ---------------------------------------------------------------------------

export function SourcesPanel({
  notebookId,
  sources,
  onOpen,
}: {
  notebookId: string;
  sources: Source[];
  onOpen: (id: string, highlight?: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const selected = sources.filter((s) => s.selected).length;
  const allOn = sources.length > 0 && selected === sources.length;
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? sources.filter((s) => s.title.toLowerCase().includes(t) || s.content.toLowerCase().includes(t)) : sources;
  }, [sources, q]);

  useEffect(() => {
    if (sources.length === 0) setAdding(true);
    // Only on first load of an empty notebook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Sources" count={sources.length} />
      <div className="space-y-2 px-3 pb-2">
        <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add sources
        </Button>
        {sources.length > 3 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <input className={cx(inputCls, "h-9 rounded-full py-1.5 pl-8 text-[13px]")} placeholder="Search in sources" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
      </div>

      {sources.length > 0 ? (
        <>
          <button
            onClick={() => db.sources.where("notebookId").equals(notebookId).modify({ selected: !allOn })}
            className="mx-3 flex items-center gap-2.5 rounded-xl px-2 py-2 text-[13px] text-muted hover:bg-accent-soft/60"
          >
            {allOn ? <CheckSquare className="size-4 text-accent" /> : <Square className="size-4" />}
            <span className="flex-1 text-left">Select all sources</span>
            <span className="text-xs">
              {selected}/{sources.length}
            </span>
          </button>
          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
            {shown.map((s) => (
              <SourceRow key={s.id} source={s} onOpen={() => onOpen(s.id)} />
            ))}
          </ul>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-sm text-muted">
          <UploadCloud className="mb-3 size-10 text-accent/60" />
          <p className="font-medium text-ink">No sources yet</p>
          <p className="mt-1 text-xs">Add PDFs, docs, websites, YouTube videos, images or pasted text.</p>
        </div>
      )}
      <AddSourceDialog open={adding} onClose={() => setAdding(false)} notebookId={notebookId} />
    </div>
  );
}

export function PanelHeader({ title, count, children }: { title: string; count?: number; children?: ReactNode }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 px-4">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {!!count && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">{count}</span>}
      <div className="flex-1" />
      {children}
    </div>
  );
}

function SourceRow({ source: s, onOpen }: { source: Source; onOpen: () => void }) {
  const Icon = KIND_ICON[s.kind];
  return (
    <li className="group flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-accent-soft/60">
      <Icon className={cx("size-4 shrink-0", KIND_TINT[s.kind])} />
      <button onClick={onOpen} className="min-w-0 flex-1 truncate text-left text-[13.5px]" title={s.title}>
        {s.title}
      </button>
      {s.guideStatus === "pending" && <Spinner className="size-3.5 text-muted" />}
      <div className="opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <SourceMenu source={s} />
      </div>
      <input
        type="checkbox"
        aria-label={`Use ${s.title}`}
        checked={s.selected}
        onChange={(e) => db.sources.update(s.id, { selected: e.target.checked })}
        className="size-4 shrink-0 cursor-pointer accent-[var(--accent)]"
      />
    </li>
  );
}

function SourceMenu({ source: s, onDeleted }: { source: Source; onDeleted?: () => void }) {
  return (
    <Menu
      trigger={
        <IconButton label="Source options" className="size-7">
          <MoreVertical className="size-3.5" />
        </IconButton>
      }
      items={[
        {
          label: "Rename",
          icon: <Pencil />,
          onClick: () => {
            const title = prompt("Rename source", s.title)?.trim();
            if (title) db.sources.update(s.id, { title });
          },
        },
        { label: "Download text", icon: <Download />, onClick: () => exportMarkdown(s.title, s.content, "txt") },
        ...(s.url ? [{ label: "Open original", icon: <ExternalLink />, onClick: () => window.open(s.url, "_blank", "noopener") }] : []),
        {
          label: "Remove source",
          icon: <Trash2 />,
          danger: true,
          onClick: async () => {
            if (!confirm(`Remove "${s.title}"?`)) return;
            await db.sources.delete(s.id);
            onDeleted?.();
            toast("Source removed");
          },
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------

type Tab = "upload" | "link" | "paste" | "discover";

interface Job {
  id: string;
  label: string;
  status: "working" | "done" | "error";
  error?: string;
}

function AddSourceDialog({ open, onClose, notebookId }: { open: boolean; onClose: () => void; notebookId: string }) {
  const [tab, setTab] = useState<Tab>("upload");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [drag, setDrag] = useState(false);
  const [links, setLinks] = useState("");
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (label: string, work: () => Promise<void>) => {
    const id = uid();
    setJobs((j) => [{ id, label, status: "working" }, ...j]);
    try {
      await work();
      setJobs((j) => j.map((x) => (x.id === id ? { ...x, status: "done" } : x)));
    } catch (e) {
      setJobs((j) => j.map((x) => (x.id === id ? { ...x, status: "error", error: e instanceof Error ? e.message : "Failed" } : x)));
    }
  };

  const addFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (file.size > 60 * 1024 * 1024) {
        toast(`${file.name} is larger than 60 MB`, "error");
        continue;
      }
      await run(file.name, async () => {
        const parsed = await parseFile(file);
        await addSource(notebookId, { ...parsed, content: parsed.content });
      });
    }
  };

  const addLinks = async (urls: string[]) => {
    await Promise.all(
      urls.map((url) =>
        run(url, async () => {
          const r = await api<{ title: string; content: string; kind: SourceKind; url: string }>("/api/fetch-url", { url });
          await addSource(notebookId, r);
        }),
      ),
    );
  };

  const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: "upload", label: "Upload", icon: UploadCloud },
    { id: "link", label: "Website / YouTube", icon: Link2 },
    { id: "paste", label: "Paste text", icon: ClipboardPaste },
    { id: "discover", label: "Discover", icon: Compass },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Add sources" wide>
      <div className="p-5">
        <div className="mb-5 flex gap-1 overflow-x-auto rounded-full bg-panel-2 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-medium transition",
                tab === t.id ? "bg-panel text-ink shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "upload" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className={cx(
              "flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-12 text-center transition",
              drag ? "border-accent bg-accent-soft" : "border-line hover:border-accent/60 hover:bg-accent-soft/40",
            )}
          >
            <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent">
              <UploadCloud className="size-7" />
            </span>
            <p className="font-medium">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-muted">PDF, Word (.docx), TXT, Markdown, CSV, HTML, subtitles, and images (photos of notes, screenshots, scans)</p>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPT}
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {tab === "link" && (
          <div className="space-y-3">
            <textarea
              className={cx(inputCls, "min-h-32 font-mono text-[13px]")}
              placeholder={"Paste one or more links, one per line\nhttps://en.wikipedia.org/wiki/Photosynthesis\nhttps://www.youtube.com/watch?v=..."}
              value={links}
              onChange={(e) => setLinks(e.target.value)}
            />
            <p className="text-xs text-muted">Web pages are imported as clean article text. YouTube videos are imported from their captions.</p>
            <Button
              variant="primary"
              disabled={!links.trim()}
              onClick={() => {
                const urls = links.split(/\s+/).map((u) => u.trim()).filter(Boolean);
                setLinks("");
                addLinks(urls);
              }}
            >
              <Plus className="size-4" /> Import links
            </Button>
          </div>
        )}

        {tab === "paste" && (
          <div className="space-y-3">
            <input className={inputCls} placeholder="Title (optional)" value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} />
            <textarea
              className={cx(inputCls, "min-h-52")}
              placeholder="Paste any text: lecture notes, an article, a transcript, an email thread..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{wordCount(pasteText).toLocaleString()} words</span>
              <Button
                variant="primary"
                disabled={!pasteText.trim()}
                onClick={() => {
                  const title = pasteTitle.trim() || pasteText.trim().split("\n")[0].slice(0, 60) || "Pasted text";
                  const content = pasteText;
                  setPasteText("");
                  setPasteTitle("");
                  run(title, async () => {
                    await addSource(notebookId, { title, kind: "paste", content });
                  });
                }}
              >
                <Plus className="size-4" /> Add text
              </Button>
            </div>
          </div>
        )}

        {tab === "discover" && <Discover onImport={addLinks} />}

        {jobs.length > 0 && (
          <div className="mt-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Import progress</p>
              <button className="text-xs text-muted hover:text-ink" onClick={() => setJobs((j) => j.filter((x) => x.status === "working"))}>
                Clear
              </button>
            </div>
            {jobs.map((j) => (
              <div key={j.id} className="flex items-start gap-2 rounded-xl bg-panel-2 px-3 py-2 text-[13px]">
                {j.status === "working" ? (
                  <Spinner className="mt-0.5 shrink-0 text-accent" />
                ) : j.status === "done" ? (
                  <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>
                ) : (
                  <X className="mt-0.5 size-4 shrink-0 text-danger" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate">{j.label}</div>
                  {j.error && <div className="text-xs text-danger">{j.error}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Discover({ onImport }: { onImport: (urls: string[]) => void }) {
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ url: string; title: string; reason: string; recommended: boolean }[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const search = async () => {
    setBusy(true);
    setResults([]);
    try {
      const r = await api<{ results: typeof results }>("/api/discover", { topic });
      setResults(r.results);
      setPicked(new Set(r.results.filter((x) => x.recommended).map((x) => x.url)));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Search failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Describe a topic and Notara will search the web for good sources you can import.</p>
      <div className="flex gap-2">
        <input
          className={inputCls}
          placeholder="e.g. causes of the 2008 financial crisis"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && topic.trim() && !busy && search()}
        />
        <Button variant="primary" onClick={search} loading={busy} disabled={!topic.trim()}>
          {!busy && <Sparkles className="size-4" />} Search
        </Button>
      </div>
      {busy && <div className="shimmer h-24 rounded-2xl border border-line" />}
      {results.length > 0 && (
        <>
          <ul className="max-h-80 space-y-1.5 overflow-y-auto">
            {results.map((r) => (
              <li key={r.url}>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line px-3 py-2.5 hover:bg-accent-soft/40">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 accent-[var(--accent)]"
                    checked={picked.has(r.url)}
                    onChange={(e) => {
                      const next = new Set(picked);
                      if (e.target.checked) next.add(r.url);
                      else next.delete(r.url);
                      setPicked(next);
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.title || r.url}</span>
                    <span className="block truncate text-xs text-accent">{new URL(r.url).hostname}</span>
                    {r.reason && <span className="mt-0.5 block text-xs text-muted">{r.reason}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Button
            variant="primary"
            disabled={!picked.size}
            onClick={() => {
              onImport([...picked]);
              setResults([]);
            }}
          >
            <Plus className="size-4" /> Import {picked.size} source{picked.size === 1 ? "" : "s"}
          </Button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function SourceViewer({
  source,
  highlight,
  onClose,
  onAsk,
}: {
  source: Source | undefined;
  highlight?: string;
  onClose: () => void;
  onAsk: (q: string) => void;
}) {
  const markRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const t = setTimeout(() => markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 150);
    return () => clearTimeout(t);
  }, [source?.id, highlight]);

  if (!source) return null;
  const Icon = KIND_ICON[source.kind];
  const hl = highlight?.trim();
  const at = hl ? source.content.indexOf(hl) : -1;

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={
        <span className="flex items-center gap-2">
          <Icon className={cx("size-5 shrink-0", KIND_TINT[source.kind])} />
          <span className="truncate">{source.title}</span>
        </span>
      }
      actions={
        <DownloadMenu
          compact
          formats={["txt", "md", "pdf", "docx"]}
          onPick={(f) => exportMarkdown(source.title, source.content, f)}
        />
      }
    >
      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="uppercase tracking-wide">{source.kind}</span>
          <span>{wordCount(source.content).toLocaleString()} words</span>
          {source.url && (
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
              Open original <ExternalLink className="size-3" />
            </a>
          )}
        </div>

        <div className="mb-5 rounded-3xl bg-gradient-to-br from-accent-soft to-panel-2 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-accent" /> Source guide
            {source.guideStatus === "error" && (
              <button className="ml-auto text-xs font-normal text-accent hover:underline" onClick={() => generateGuide(source)}>
                Retry
              </button>
            )}
          </div>
          {source.guide ? (
            <>
              <div className="prose-ink text-sm">
                <ReactMarkdown>{source.guide.summary}</ReactMarkdown>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {source.guide.topics.map((t) => (
                  <button
                    key={t}
                    onClick={() => onAsk(`Explain "${t}" based on "${source.title}".`)}
                    className="rounded-full border border-line bg-panel px-2.5 py-1 text-xs hover:border-accent hover:text-accent"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          ) : source.guideStatus === "error" ? (
            <p className="text-sm text-muted">Couldn&apos;t summarise this source.</p>
          ) : (
            <div className="shimmer h-16 rounded-xl" />
          )}
        </div>

        <div className="whitespace-pre-wrap rounded-2xl border border-line bg-panel-2 p-4 text-[13.5px] leading-relaxed">
          {at >= 0 ? (
            <>
              {source.content.slice(0, at)}
              <mark ref={markRef} className="cite-hl">
                {source.content.slice(at, at + hl!.length)}
              </mark>
              {source.content.slice(at + hl!.length)}
            </>
          ) : (
            source.content
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <SourceMenu source={source} onDeleted={onClose} />
        </div>
      </div>
    </Modal>
  );
}
