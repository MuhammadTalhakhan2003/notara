"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Download, FileStack, LayoutGrid, List, MoreVertical, Pencil, Plus, Search, Sparkles, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { UpgradeDialog } from "@/components/plus";
import { SiteFooter } from "@/components/SiteFooter";
import { Button, IconButton, Menu, Toaster, cx, inputCls, toast } from "@/components/ui";
import { prefs, timeAgo } from "@/lib/client";
import { db, deleteNotebook, exportNotebookBackup, importNotebookBackup, uid } from "@/lib/db";
import { downloadText, safeName } from "@/lib/exporters";
import { COLORS, EMOJIS, tileFor } from "@/lib/palette";
import type { Notebook } from "@/lib/types";

type Sort = "recent" | "title" | "created";

export default function NotebooksPage() {
  const router = useRouter();
  const notebooks = useLiveQuery(() => db.notebooks.toArray(), []);
  const stats = useLiveQuery(async () => {
    const [sources, studio] = await Promise.all([db.sources.toArray(), db.studio.toArray()]);
    const m: Record<string, { sources: number; outputs: number }> = {};
    for (const s of sources) (m[s.notebookId] ??= { sources: 0, outputs: 0 }).sources++;
    for (const s of studio) if (s.status === "ready") (m[s.notebookId] ??= { sources: 0, outputs: 0 }).outputs++;
    return m;
  }, []);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  useEffect(() => setView(prefs.get("view") === "list" ? "list" : "grid"), []);
  const fileRef = useRef<HTMLInputElement>(null);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = (notebooks ?? []).filter((n) => n.title.toLowerCase().includes(t));
    const by: Record<Sort, (a: Notebook, b: Notebook) => number> = {
      recent: (a, b) => b.updatedAt - a.updatedAt,
      created: (a, b) => b.createdAt - a.createdAt,
      title: (a, b) => a.title.localeCompare(b.title),
    };
    return list.sort(by[sort]);
  }, [notebooks, q, sort]);

  async function create() {
    const id = uid();
    const now = Date.now();
    await db.notebooks.add({
      id,
      title: "Untitled notebook",
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      createdAt: now,
      updatedAt: now,
    });
    router.push(`/notebook/${id}`);
  }

  async function importBackup(file: File) {
    try {
      let json = JSON.parse(await file.text());
      if (Array.isArray(json)) json = json[0];
      const id = await importNotebookBackup(json);
      toast("Notebook restored");
      router.push(`/notebook/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not import that file", "error");
    }
  }

  const menu = (n: Notebook) => (
    <Menu
      trigger={
        <IconButton label="Notebook options">
          <MoreVertical className="size-4" />
        </IconButton>
      }
      items={[
        {
          label: "Rename",
          icon: <Pencil />,
          onClick: () => {
            const title = prompt("Rename notebook", n.title)?.trim();
            if (title) db.notebooks.update(n.id, { title });
          },
        },
        {
          label: "Download backup",
          icon: <Download />,
          onClick: async () => downloadText(`${safeName(n.title)}.notara.json`, JSON.stringify(await exportNotebookBackup(n.id)), "application/json"),
        },
        {
          label: "Delete",
          icon: <Trash2 />,
          danger: true,
          onClick: async () => {
            if (confirm(`Delete "${n.title}" and everything in it?`)) {
              await deleteNotebook(n.id);
              toast("Notebook deleted");
            }
          },
        },
      ]}
    />
  );

  const meta = (n: Notebook) => {
    const s = stats?.[n.id] ?? { sources: 0, outputs: 0 };
    return `${s.sources} source${s.sources === 1 ? "" : "s"} · ${s.outputs} output${s.outputs === 1 ? "" : "s"} · ${timeAgo(n.updatedAt)}`;
  };

  return (
    <div className="min-h-dvh">
      <AppHeader>
        <IconButton label="Restore a backup" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" />
        </IconButton>
      </AppHeader>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importBackup(f);
          e.target.value = "";
        }}
      />

      <main className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold tracking-tight">Notebooks</h1>
            <p className="mt-1 text-sm text-muted">
              {notebooks?.length ? `${notebooks.length} notebook${notebooks.length === 1 ? "" : "s"} saved in this browser` : "Saved in this browser. Nothing leaves your device until you ask a question."}
            </p>
          </div>
          <Button variant="primary" onClick={create}>
            <Plus className="size-4" /> New notebook
          </Button>
        </div>

        {!!notebooks?.length && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input id="nb-search" className={cx(inputCls, "h-10 py-2 pl-9")} placeholder="Search notebooks" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex-1" />
            <select
              id="nb-sort"
              aria-label="Sort notebooks"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-10 rounded-xl border border-line bg-panel px-3 text-sm outline-none focus:border-accent"
            >
              <option value="recent">Recently updated</option>
              <option value="created">Newest first</option>
              <option value="title">Title A–Z</option>
            </select>
            <div className="flex rounded-xl border border-line bg-panel p-0.5">
              {(
                [
                  ["grid", LayoutGrid],
                  ["list", List],
                ] as const
              ).map(([v, Icon]) => (
                <button
                  key={v}
                  aria-label={`${v} view`}
                  onClick={() => {
                    setView(v);
                    prefs.set("view", v);
                  }}
                  className={cx("flex size-9 items-center justify-center rounded-lg transition", view === v ? "bg-accent-soft text-accent" : "text-muted hover:text-ink")}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>
        )}

        {notebooks && notebooks.length === 0 && (
          <div className="mt-10 rounded-3xl border border-dashed border-line bg-panel px-6 py-16 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
              <Sparkles className="size-7" />
            </span>
            <h2 className="mt-5 font-brand text-2xl font-semibold">A blank desk. The best kind.</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Even Einstein started with an empty desk (probably). Add PDFs, websites, YouTube videos or notes, and Notara will read them, answer with citations, and build study guides, quizzes and slides.
            </p>
            <Button variant="primary" className="mt-6" onClick={create}>
              <Plus className="size-4" /> New notebook
            </Button>
          </div>
        )}

        {view === "grid" ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((n) => (
              <Link
                key={n.id}
                href={`/notebook/${n.id}`}
                className="animate-rise group relative flex min-h-44 flex-col overflow-hidden rounded-2xl border border-line bg-panel p-5 transition hover:border-accent/60 hover:shadow-lg hover:shadow-black/5"
              >
                <span className={cx("absolute inset-x-0 top-0 h-0.5 opacity-80", tileFor(n.color).line)} />
                <div className="flex items-start justify-between">
                  <span className={cx("flex size-11 items-center justify-center rounded-xl text-2xl", tileFor(n.color).tile)}>{n.emoji}</span>
                  <div onClick={(e) => e.preventDefault()}>{menu(n)}</div>
                </div>
                <h3 className="mt-auto line-clamp-2 pt-6 font-display text-[17px] font-semibold leading-snug">{n.title}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <FileStack className="size-3.5 shrink-0" /> {meta(n)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
            {shown.map((n) => (
              <li key={n.id} className="flex items-center gap-3 px-4 py-3 hover:bg-panel-2">
                <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-xl text-xl", tileFor(n.color).tile)}>{n.emoji}</span>
                <Link href={`/notebook/${n.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{n.title}</span>
                  <span className="block truncate text-xs text-muted">{meta(n)}</span>
                </Link>
                {menu(n)}
              </li>
            ))}
          </ul>
        )}
        {notebooks && notebooks.length > 0 && shown.length === 0 && <p className="mt-8 text-center text-sm text-muted">No notebooks match “{q}”.</p>}
      </main>
      <SiteFooter />
      <UpgradeDialog />
      <Toaster />
    </div>
  );
}
