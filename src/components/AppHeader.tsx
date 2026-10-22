"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { apiHeaders } from "@/lib/client";
import { PlusButton } from "./plus";
import { SettingsDialog } from "./SettingsDialog";
import { IconButton, Logo, ThemeToggle, cx } from "./ui";

/** Shows which AI the server will use for this browser (Claude, Groq, or none configured). */
export function ProviderBadge({ className }: { className?: string }) {
  const [s, setS] = useState<{ provider: string | null; label: string } | null>(null);
  useEffect(() => {
    fetch("/api/status", { headers: apiHeaders() })
      .then((r) => r.json())
      .then(setS)
      .catch(() => {});
  }, []);
  if (!s) return null;
  return (
    <span
      title={s.label}
      className={cx(
        "hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-muted sm:inline-flex",
        className,
      )}
    >
      <span className={cx("size-1.5 rounded-full", s.provider ? "bg-emerald-500" : "bg-danger")} />
      {s.provider === "claude" ? "Claude" : s.provider === "groq" ? "Groq" : "No AI key"}
    </span>
  );
}

export function AppHeader({ children }: { children?: ReactNode }) {
  const [settings, setSettings] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" aria-label="Notara home">
          <Logo />
        </Link>
        <span className="mx-2 hidden h-5 w-px bg-line sm:block" />
        <Link href="/notebooks" className="hidden text-sm font-medium text-ink sm:block">
          Notebooks
        </Link>
        <div className="flex-1" />
        <ProviderBadge />
        <PlusButton />
        {children}
        <ThemeToggle />
        <IconButton label="Settings" onClick={() => setSettings(true)}>
          <Settings className="size-4" />
        </IconButton>
      </div>
      <SettingsDialog open={settings} onClose={() => setSettings(false)} />
    </header>
  );
}
