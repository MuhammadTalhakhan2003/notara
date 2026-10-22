"use client";

import {
  AudioLines,
  BookOpenCheck,
  BrainCircuit,
  CalendarRange,
  FileQuestion,
  FileText,
  Layers,
  ListChecks,
  MoreVertical,
  Newspaper,
  NotebookPen,
  Pencil,
  Plus,
  Presentation,
  RotateCcw,
  Settings2,
  Sheet,
  Trash2,
  Upload,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, prefs, timeAgo, toPayload } from "@/lib/client";
import { db, touchNotebook, uid } from "@/lib/db";
import { exportMarkdown, exportStudioItem, formatsFor, noteToMarkdown } from "@/lib/exporters";
import { LANGUAGES, STUDIO_TOOLS, defaultOptions, toolMeta } from "@/lib/studio";
import type { Note, Source, StudioItem, StudioOptions, StudioType } from "@/lib/types";
import { PanelHeader, addSource } from "./sources";
import { Button, DownloadMenu, Field, IconButton, Menu, Modal, Spinner, cx, inputCls, toast } from "./ui";
import { NoteEditor } from "./notes";

export const TOOL_ICON: Record<StudioType, LucideIcon> = {
  audio: AudioLines,
  mindmap: BrainCircuit,
  study_guide: BookOpenCheck,
  briefing: FileText,
  faq: FileQuestion,
  timeline: CalendarRange,
  flashcards: Layers,
  quiz: ListChecks,
  slides: Presentation,
  table: Sheet,
  blog: Newspaper,
  custom: Wand2,
};

export async function generateStudio(notebookId: string, type: StudioType, options: StudioOptions, sources: Source[]) {
  const selected = sources.filter((s) => s.selected);
  if (!selected.length) {
    toast("Select at least one source first", "error");
    return;
  }
  const meta = toolMeta(type);
  const item: StudioItem = {
    id: uid(),
    notebookId,
    type,
    title: meta.label,
    status: "pending",
    options,
    sourceCount: selected.length,
    createdAt: Date.now(),
  };
  await db.studio.add(item);
  touchNotebook(notebookId);
  try {
    const { data } = await api<{ data: { title: string } }>("/api/studio", { type, options, sources: toPayload(selected) });
    await db.studio.update(item.id, { status: "ready", data, title: data.title || meta.label });
    toast(`${meta.label} is ready`);
  } catch (e) {
    await db.studio.update(item.id, { status: "error", error: e instanceof Error ? e.message : "Generation failed" });
  }
}

export function StudioPanel({
  notebookId,
  sources,
  items,
  notes,
  onOpenItem,
}: {
  notebookId: string;
  sources: Source[];
  items: StudioItem[];
  notes: Note[];
  onOpenItem: (id: string) => void;
}) {
  const [customize, setCustomize] = useState<StudioType | null>(null);
  const [editing, setEditing] = useState<Note | "new" | null>(null);

  // Items left "pending" by a closed tab will never finish; mark them failed.
  useEffect(() => {
    const stale = items.filter((i) => i.status === "pending" && Date.now() - i.createdAt > 6 * 60_000);
    stale.forEach((i) => db.studio.update(i.id, { status: "error", error: "Generation was interrupted." }));
  }, [items]);

  const language = () => prefs.get("language", "English") || "English";

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Studio" />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="grid grid-cols-2 gap-2">
          {STUDIO_TOOLS.map((t) => {
            const Icon = TOOL_ICON[t.type];
            return (
              <div
                key={t.type}
                className={cx("group relative rounded-2xl bg-gradient-to-br p-3 transition hover:-translate-y-0.5 hover:shadow-md", t.tint)}
              >
                <button
                  className="block w-full text-left"
                  title={t.blurb}
                  onClick={() => (t.type === "custom" ? setCustomize("custom") : generateStudio(notebookId, t.type, defaultOptions(t.type, language()), sources))}
                >
                  <Icon className="mb-1.5 size-5" />
                  <span className="block text-[13px] font-semibold leading-tight text-ink">{t.label}</span>
                </button>
                <button
                  aria-label={`Customise ${t.label}`}
                  title="Customise"
                  onClick={() => setCustomize(t.type)}
                  className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full text-ink/50 opacity-70 transition hover:bg-panel/70 hover:text-ink group-hover:opacity-100"
                >
                  <Settings2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {items.length > 0 && (
          <div className="mt-5">
            <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Generated</p>
            <ul className="space-y-1">
              {items.map((it) => (
                <StudioRow key={it.id} item={it} onOpen={() => onOpenItem(it.id)} sources={sources} />
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5">
          <div className="mb-1.5 flex items-center px-1">
            <p className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Notes</p>
            <Button size="sm" variant="ghost" onClick={() => setEditing("new")}>
              <Plus className="size-3.5" /> Add note
            </Button>
          </div>
          {notes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
              Write your own notes, or save chat answers here with the <NotebookPen className="inline size-3.5" /> button.
            </p>
          ) : (
            <ul className="space-y-1">
              {notes.map((n) => (
                <li key={n.id} className="group flex items-start gap-2 rounded-xl px-2 py-2 hover:bg-accent-soft/60">
                  <NotebookPen className="mt-0.5 size-4 shrink-0 text-yellow-500" />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(n)}>
                    <span className="block truncate text-[13.5px] font-medium">{n.title}</span>
                    <span className="line-clamp-2 text-xs text-muted">{n.content.replace(/[#*_>`|-]/g, "").slice(0, 140)}</span>
                  </button>
                  <Menu
                    trigger={
                      <IconButton label="Note options" className="size-7 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="size-3.5" />
                      </IconButton>
                    }
                    items={[
                      {
                        label: "Convert to source",
                        icon: <Upload />,
                        onClick: async () => {
                          await addSource(notebookId, { title: n.title, kind: "note", content: n.content });
                          toast("Note added as a source");
                        },
                      },
                      { label: "Download (.md)", icon: <FileText />, onClick: () => exportMarkdown(n.title, noteToMarkdown(n), "md") },
                      { label: "Download (.pdf)", icon: <FileText />, onClick: () => exportMarkdown(n.title, noteToMarkdown(n), "pdf") },
                      { label: "Download (.docx)", icon: <FileText />, onClick: () => exportMarkdown(n.title, noteToMarkdown(n), "docx") },
                      { label: "Delete", icon: <Trash2 />, danger: true, onClick: () => confirm(`Delete note "${n.title}"?`) && db.notes.delete(n.id) },
                    ]}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {customize && (
        <CustomizeDialog
          type={customize}
          onClose={() => setCustomize(null)}
          onGenerate={(opts) => {
            setCustomize(null);
            generateStudio(notebookId, customize, opts, sources);
          }}
        />
      )}
      {editing && <NoteEditor notebookId={notebookId} note={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function StudioRow({ item, onOpen, sources }: { item: StudioItem; onOpen: () => void; sources: Source[] }) {
  const Icon = TOOL_ICON[item.type];
  const meta = toolMeta(item.type);
  return (
    <li className="group flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-accent-soft/60">
      <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br", meta.tint)}>
        {item.status === "pending" ? <Spinner /> : <Icon className="size-4" />}
      </span>
      <button className="min-w-0 flex-1 text-left" disabled={item.status !== "ready"} onClick={onOpen}>
        <span className="block truncate text-[13.5px] font-medium">{item.status === "pending" ? `Generating ${meta.label}...` : item.title}</span>
        <span className={cx("block truncate text-xs", item.status === "error" ? "text-danger" : "text-muted")}>
          {item.status === "error"
            ? item.error
            : item.status === "pending"
              ? "This can take a minute"
              : `${meta.label} · ${item.sourceCount} source${item.sourceCount === 1 ? "" : "s"} · ${timeAgo(item.createdAt)}`}
        </span>
      </button>
      {item.status === "ready" && (
        <span className="opacity-0 transition group-hover:opacity-100">
          <DownloadMenu compact formats={formatsFor(item).filter((f) => f !== "png" && f !== "svg")} onPick={(f) => exportStudioItem(item, f)} />
        </span>
      )}
      <Menu
        trigger={
          <IconButton label="Options" className="size-7">
            <MoreVertical className="size-3.5" />
          </IconButton>
        }
        items={[
          ...(item.status === "ready"
            ? [
                {
                  label: "Rename",
                  icon: <Pencil />,
                  onClick: () => {
                    const title = prompt("Rename", item.title)?.trim();
                    if (title) db.studio.update(item.id, { title });
                  },
                },
              ]
            : []),
          ...(item.status !== "pending"
            ? [
                {
                  label: item.status === "error" ? "Try again" : "Regenerate",
                  icon: <RotateCcw />,
                  onClick: async () => {
                    if (item.status === "error") await db.studio.delete(item.id);
                    generateStudio(item.notebookId, item.type, item.options, sources);
                  },
                },
              ]
            : []),
          { label: "Delete", icon: <Trash2 />, danger: true, onClick: () => db.studio.delete(item.id) },
        ]}
      />
    </li>
  );
}

function CustomizeDialog({ type, onClose, onGenerate }: { type: StudioType; onClose: () => void; onGenerate: (o: StudioOptions) => void }) {
  const meta = toolMeta(type);
  const [o, setO] = useState<StudioOptions>(() => defaultOptions(type, prefs.get("language", "English") || "English"));
  const Icon = TOOL_ICON[type];
  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Icon className="size-5 text-accent" /> Customise {meta.label}
        </span>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-sm text-muted">{meta.blurb}.</p>
        {type === "custom" && (
          <Field label="What should Notara create?">
            <textarea
              autoFocus
              className={cx(inputCls, "min-h-28")}
              placeholder="e.g. A lesson plan for a 45-minute class, with learning objectives and an activity"
              value={o.customPrompt}
              onChange={(e) => setO({ ...o, customPrompt: e.target.value })}
            />
          </Field>
        )}
        {meta.levels && (
          <Field label={meta.levelLabel ?? "Level"}>
            <div className="flex flex-wrap gap-1.5">
              {meta.levels.map((l) => (
                <button
                  key={l}
                  onClick={() => setO({ ...o, level: l })}
                  className={cx(
                    "rounded-full border px-3.5 py-1.5 text-sm transition",
                    o.level === l ? "border-accent bg-accent text-accent-ink" : "border-line hover:border-accent",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </Field>
        )}
        {meta.countLabel && (
          <Field label={`${meta.countLabel}: ${o.count}`}>
            <input
              type="range"
              min={type === "slides" ? 4 : 5}
              max={type === "slides" ? 20 : 40}
              value={o.count}
              onChange={(e) => setO({ ...o, count: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </Field>
        )}
        <Field label="Focus (optional)" hint="Topics, chapters or angle to emphasise.">
          <input className={inputCls} placeholder="e.g. only chapter 3, or the economic impact" value={o.focus} onChange={(e) => setO({ ...o, focus: e.target.value })} />
        </Field>
        <Field label="Language">
          <select className={inputCls} value={o.language} onChange={(e) => setO({ ...o, language: e.target.value })}>
            {LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={type === "custom" && !o.customPrompt.trim()} onClick={() => onGenerate(o)}>
            <Wand2 className="size-4" /> Generate
          </Button>
        </div>
      </div>
    </Modal>
  );
}
