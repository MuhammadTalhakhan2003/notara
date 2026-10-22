"use client";

import Dexie, { type EntityTable } from "dexie";
import type { ChatMessage, Note, Notebook, Source, StudioItem } from "./types";

// Everything lives in the browser's IndexedDB: no account, no server database.
class NotaraDB extends Dexie {
  notebooks!: EntityTable<Notebook, "id">;
  sources!: EntityTable<Source, "id">;
  notes!: EntityTable<Note, "id">;
  messages!: EntityTable<ChatMessage, "id">;
  studio!: EntityTable<StudioItem, "id">;

  constructor() {
    super("notara");
    this.version(1).stores({
      notebooks: "id, updatedAt",
      sources: "id, notebookId, createdAt",
      notes: "id, notebookId, updatedAt",
      messages: "id, notebookId, createdAt",
      studio: "id, notebookId, createdAt",
    });
  }
}

export const db = new NotaraDB();

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const touchNotebook = (id: string) =>
  db.notebooks.update(id, { updatedAt: Date.now() });

export async function deleteNotebook(id: string) {
  await db.transaction("rw", [db.notebooks, db.sources, db.notes, db.messages, db.studio], async () => {
    await db.sources.where("notebookId").equals(id).delete();
    await db.notes.where("notebookId").equals(id).delete();
    await db.messages.where("notebookId").equals(id).delete();
    await db.studio.where("notebookId").equals(id).delete();
    await db.notebooks.delete(id);
  });
}

export interface NotebookBackup {
  app: "notara" | "inkwise";
  version: 1;
  notebook: Notebook;
  sources: Source[];
  notes: Note[];
  messages: ChatMessage[];
  studio: StudioItem[];
}

export async function exportNotebookBackup(id: string): Promise<NotebookBackup> {
  const notebook = await db.notebooks.get(id);
  if (!notebook) throw new Error("Notebook not found");
  const [sources, notes, messages, studio] = await Promise.all([
    db.sources.where("notebookId").equals(id).toArray(),
    db.notes.where("notebookId").equals(id).toArray(),
    db.messages.where("notebookId").equals(id).sortBy("createdAt"),
    db.studio.where("notebookId").equals(id).toArray(),
  ]);
  return { app: "notara", version: 1, notebook, sources, notes, messages, studio };
}

/** Imports a backup as a brand-new notebook (fresh ids, so it never clobbers an existing one). */
export async function importNotebookBackup(backup: NotebookBackup): Promise<string> {
  if (!["notara", "inkwise"].includes(backup?.app) || !backup.notebook) throw new Error("This file is not a Notara backup.");
  const newId = uid();
  const now = Date.now();
  const remap = <T extends { id: string; notebookId: string }>(rows: T[] = []) =>
    rows.map((r) => ({ ...r, id: uid(), notebookId: newId }));
  // Citations point at source ids, so keep a mapping for chat messages.
  const sourceIdMap = new Map<string, string>();
  const sources = (backup.sources ?? []).map((s) => {
    const id = uid();
    sourceIdMap.set(s.id, id);
    return { ...s, id, notebookId: newId };
  });
  const messages = remap(backup.messages).map((m) => ({
    ...m,
    segments: m.segments.map((seg) => ({
      ...seg,
      citations: seg.citations.map((c) => ({ ...c, sourceId: sourceIdMap.get(c.sourceId) ?? c.sourceId })),
    })),
  }));
  await db.transaction("rw", [db.notebooks, db.sources, db.notes, db.messages, db.studio], async () => {
    await db.notebooks.add({ ...backup.notebook, id: newId, createdAt: now, updatedAt: now, overview: undefined });
    await db.sources.bulkAdd(sources);
    await db.notes.bulkAdd(remap(backup.notes));
    await db.messages.bulkAdd(messages);
    await db.studio.bulkAdd(remap(backup.studio).filter((s) => s.status === "ready"));
  });
  return newId;
}
