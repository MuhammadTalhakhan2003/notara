"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Archive, Download, FileJson, FileStack, MessageSquare, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { ChatPanel } from "@/components/chat";
import { SourceViewer, SourcesPanel } from "@/components/sources";
import { SettingsDialog } from "@/components/SettingsDialog";
import { StudioPanel } from "@/components/studio";
import { ProviderBadge } from "@/components/AppHeader";
import { Button, IconButton, Logo, Menu, ThemeToggle, Toaster, cx, toast } from "@/components/ui";
import { StudioViewer } from "@/components/viewers";
import { db, exportNotebookBackup } from "@/lib/db";
import { downloadText, exportNotebookZip, safeName } from "@/lib/exporters";
import { EMOJIS } from "@/lib/palette";

type MobileTab = "sources" | "chat" | "studio";

export default function NotebookPage() {
  const { id } = useParams<{ id: string }>();
  const notebook = useLiveQuery(() => db.notebooks.get(id), [id], null);
  const sources = useLiveQuery(() => db.sources.where("notebookId").equals(id).sortBy("createdAt"), [id]) ?? [];
  const messages = useLiveQuery(() => db.messages.where("notebookId").equals(id).sortBy("createdAt"), [id]) ?? [];
  const studio = useLiveQuery(async () => (await db.studio.where("notebookId").equals(id).sortBy("createdAt")).reverse(), [id]) ?? [];
  const notes = useLiveQuery(async () => (await db.notes.where("notebookId").equals(id).sortBy("updatedAt")).reverse(), [id]) ?? [];

  const [viewSource, setViewSource] = useState<{ id: string; highlight?: string } | null>(null);
  const [viewItem, setViewItem] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [tab, setTab] = useState<MobileTab>("chat");
  const [settings, setSettings] = useState(false);

  const ask = useCallback((q: string) => {
    setPending(q);
    setViewSource(null);
    setTab("chat");
  }, []);
  const clearPending = useCallback(() => setPending(null), []);
  const openSource = useCallback((sid: string, highlight?: string) => setViewSource({ id: sid, highlight }), []);

  if (notebook === null) return <div className="flex min-h-dvh items-center justify-center text-muted">Loading…</div>;
  if (!notebook)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-display text-2xl">This notebook doesn&apos;t exist on this device.</p>
        <Link href="/notebooks">
          <Button variant="primary">Back to notebooks</Button>
        </Link>
      </div>
    );

  const exportZip = async () => {
    await exportNotebookZip(notebook.title, { sources, notes, messages, studio, backup: await exportNotebookBackup(notebook.id) });
    toast("Notebook downloaded as ZIP");
  };

  const item = studio.find((s) => s.id === viewItem);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-line bg-panel px-2 sm:px-4">
        <Link href="/notebooks" aria-label="All notebooks" className="flex items-center gap-1 rounded-full p-1.5 text-muted hover:bg-accent-soft hover:text-ink">
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">
            <Logo />
          </span>
        </Link>
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <Menu
          align="start"
          trigger={
            <button className="flex size-9 items-center justify-center rounded-full text-xl hover:bg-accent-soft" aria-label="Change icon">
              {notebook.emoji}
            </button>
          }
          items={EMOJIS.map((e) => ({ label: e, onClick: () => db.notebooks.update(notebook.id, { emoji: e }) }))}
        />
        <input
          aria-label="Notebook title"
          className="min-w-0 flex-1 truncate rounded-lg bg-transparent px-1.5 py-1 font-display text-lg font-semibold outline-none hover:bg-panel-2 focus:bg-panel-2"
          defaultValue={notebook.title}
          key={notebook.title}
          onBlur={(e) => {
            const t = e.target.value.trim();
            if (t && t !== notebook.title) db.notebooks.update(notebook.id, { title: t, updatedAt: Date.now() });
            else e.target.value = notebook.title;
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <Menu
          header="Export notebook"
          trigger={
            <Button size="sm" variant="soft">
              <Download className="size-4" /> <span className="hidden sm:inline">Export</span>
            </Button>
          }
          items={[
            { label: "Everything as ZIP", hint: "sources, notes, studio, chat", icon: <Archive />, onClick: exportZip },
            {
              label: "Backup file (.json)",
              hint: "restore later",
              icon: <FileJson />,
              onClick: async () => {
                downloadText(`${safeName(notebook.title)}.notara.json`, JSON.stringify(await exportNotebookBackup(notebook.id)), "application/json");
                toast("Backup downloaded");
              },
            },
          ]}
        />
        <ProviderBadge />
        <ThemeToggle />
        <IconButton label="Settings" onClick={() => setSettings(true)}>
          <Settings className="size-4" />
        </IconButton>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 p-0 md:grid-cols-[280px_minmax(0,1fr)] md:p-3 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <section className={cx("min-h-0 overflow-hidden bg-panel md:rounded-3xl md:border md:border-line", tab === "sources" ? "block" : "hidden md:block")}>
          <SourcesPanel notebookId={notebook.id} sources={sources} onOpen={openSource} />
        </section>
        <section
          className={cx(
            "min-h-0 overflow-hidden bg-panel md:rounded-3xl md:border md:border-line",
            tab === "studio" ? "hidden xl:block" : tab === "chat" ? "block" : "hidden md:block",
          )}
        >
          <ChatPanel notebook={notebook} sources={sources} messages={messages} onOpenSource={openSource} pendingQuestion={pending} clearPending={clearPending} />
        </section>
        <section
          className={cx(
            "min-h-0 overflow-hidden bg-panel md:rounded-3xl md:border md:border-line",
            tab === "studio" ? "block" : "hidden xl:block",
          )}
        >
          <StudioPanel notebookId={notebook.id} sources={sources} items={studio} notes={notes} onOpenItem={setViewItem} />
        </section>
      </div>

      {/* Below xl the Studio gets its own tab; below md every panel does. */}
      <nav className="flex shrink-0 border-t border-line bg-panel xl:hidden">
        {(
          [
            { id: "sources", label: "Sources", icon: FileStack, cls: "md:hidden" },
            { id: "chat", label: "Chat", icon: MessageSquare, cls: "" },
            { id: "studio", label: "Studio", icon: Sparkles, cls: "" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cx("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium", t.cls, tab === t.id ? "text-accent" : "text-muted")}
          >
            <t.icon className="size-5" />
            {t.label}
          </button>
        ))}
      </nav>

      {viewSource && (
        <SourceViewer
          source={sources.find((s) => s.id === viewSource.id)}
          highlight={viewSource.highlight}
          onClose={() => setViewSource(null)}
          onAsk={ask}
        />
      )}
      {item?.status === "ready" && <StudioViewer item={item} onClose={() => setViewItem(null)} onAsk={ask} />}
      <SettingsDialog open={settings} onClose={() => setSettings(false)} />
      <Toaster />
    </div>
  );
}
