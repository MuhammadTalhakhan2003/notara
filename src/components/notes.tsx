"use client";

import { Eye, PencilLine } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { wordCount } from "@/lib/client";
import { db, touchNotebook, uid } from "@/lib/db";
import { exportMarkdown, noteToMarkdown } from "@/lib/exporters";
import type { Note } from "@/lib/types";
import { Button, DownloadMenu, Modal, cx, inputCls, toast } from "./ui";

export function NoteEditor({ notebookId, note, onClose }: { notebookId: string; note: Note | null; onClose: () => void }) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [preview, setPreview] = useState(!!note);

  const save = async () => {
    const now = Date.now();
    const t = title.trim() || content.trim().split("\n")[0].replace(/^#+\s*/, "").slice(0, 70) || "Untitled note";
    if (note) await db.notes.update(note.id, { title: t, content, updatedAt: now });
    else await db.notes.add({ id: uid(), notebookId, title: t, content, createdAt: now, updatedAt: now });
    touchNotebook(notebookId);
    toast("Note saved");
    onClose();
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={note ? "Edit note" : "New note"}
      actions={
        <DownloadMenu
          compact
          formats={["pdf", "docx", "md", "txt"]}
          onPick={(f) => exportMarkdown(title || "Note", noteToMarkdown({ title: title || "Note", content } as Note), f)}
        />
      }
    >
      <div className="flex h-full flex-col gap-3 p-5">
        <input className={cx(inputCls, "font-display text-lg font-semibold")} placeholder="Note title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="flex gap-1 self-start rounded-full bg-panel-2 p-1">
          {[
            { on: false, label: "Write", icon: PencilLine },
            { on: true, label: "Preview", icon: Eye },
          ].map((t) => (
            <button
              key={t.label}
              onClick={() => setPreview(t.on)}
              className={cx("flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", preview === t.on ? "bg-panel shadow-sm" : "text-muted")}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>
        {preview ? (
          <div className="prose-ink min-h-64 rounded-2xl border border-line p-4 text-[14.5px]" onDoubleClick={() => setPreview(false)}>
            {content.trim() ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown> : <p className="text-muted">Nothing here yet.</p>}
          </div>
        ) : (
          <textarea
            autoFocus
            className={cx(inputCls, "min-h-64 flex-1 font-mono text-[13.5px] leading-relaxed")}
            placeholder={"Write in Markdown: # headings, **bold**, - lists..."}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">{wordCount(content)} words</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={!content.trim() && !title.trim()}>
              Save note
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
