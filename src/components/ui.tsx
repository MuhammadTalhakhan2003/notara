"use client";

import { Check, ChevronDown, Download, Loader2, Moon, Sun, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { prefs } from "@/lib/client";
import { FORMAT_LABEL, type ExportFormat } from "@/lib/exporters";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---------------------------------------------------------------------------

type Variant = "primary" | "ghost" | "outline" | "soft" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:opacity-90 shadow-sm",
  outline: "border border-line bg-panel hover:bg-panel-2",
  ghost: "hover:bg-accent-soft/70",
  soft: "bg-accent-soft text-accent hover:brightness-95 dark:hover:brightness-125",
  danger: "bg-danger text-white hover:opacity-90",
};

export function Button({
  variant = "outline",
  size = "md",
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm",
        VARIANTS[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      {...props}
      className={cx(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-accent-soft hover:text-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent",
        className,
      )}
    >
      {children}
    </button>
  );
}

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cx("size-4 animate-spin", className)} />;

// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  full,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  full?: boolean;
  actions?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          "animate-rise flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-panel shadow-2xl sm:rounded-3xl",
          full ? "sm:h-[92dvh] sm:max-w-6xl" : wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
          <div className="min-w-0 flex-1 truncate font-display text-lg font-semibold">{title}</div>
          {actions}
          <IconButton label="Close" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  hint?: string;
}

export function Menu({ trigger, items, align = "end", header }: { trigger: ReactNode; items: MenuItem[]; align?: "start" | "end"; header?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      {open && (
        <div
          className={cx(
            "animate-rise absolute top-full z-40 mt-1 min-w-52 overflow-hidden rounded-2xl border border-line bg-panel p-1 shadow-xl",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {header && <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{header}</div>}
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={cx(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-accent-soft",
                it.danger && "text-danger",
              )}
            >
              {it.icon && <span className="text-muted [&>svg]:size-4">{it.icon}</span>}
              <span className="flex-1">{it.label}</span>
              {it.hint && <span className="text-xs text-muted">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DownloadMenu({
  formats,
  onPick,
  compact,
  label = "Download",
}: {
  formats: ExportFormat[];
  onPick: (f: ExportFormat) => Promise<void> | void;
  compact?: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Menu
      header="Download as"
      trigger={
        compact ? (
          <IconButton label={label}>{busy ? <Spinner /> : <Download className="size-4" />}</IconButton>
        ) : (
          <Button size="sm" variant="soft" loading={busy}>
            {!busy && <Download className="size-4" />} {label} <ChevronDown className="size-3.5" />
          </Button>
        )
      }
      items={formats.map((f) => ({
        label: FORMAT_LABEL[f],
        hint: `.${f}`,
        onClick: async () => {
          setBusy(true);
          try {
            await onPick(f);
            toast(`Downloaded ${FORMAT_LABEL[f]}`);
          } catch (e) {
            toast(e instanceof Error ? e.message : "Download failed", "error");
          } finally {
            setBusy(false);
          }
        },
      }))}
    />
  );
}

// ---------------------------------------------------------------------------
// Toasts

interface Toast {
  id: number;
  text: string;
  kind: "ok" | "error";
}
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, kind: "ok" | "error" = "ok") {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, text, kind }].slice(-4);
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, kind === "error" ? 6500 : 3000);
}

const EMPTY: Toast[] = [];
export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => EMPTY,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {list.map((t) => (
        <div
          key={t.id}
          className={cx(
            "animate-rise pointer-events-auto flex max-w-md items-start gap-2 rounded-2xl px-4 py-2.5 text-sm shadow-lg",
            t.kind === "error" ? "bg-danger text-white" : "bg-ink text-bg",
          )}
        >
          {t.kind === "ok" && <Check className="mt-0.5 size-4 shrink-0" />}
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 64 64" className={size === "lg" ? "size-10" : "size-8"} aria-hidden>
        <defs>
          <linearGradient id="notara-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#0094c9" />
            <stop offset="1" stopColor="#005677" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#notara-g)" />
        <path d="M18 14h20l10 10v26a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2z" fill="#fff" />
        <path d="M38 14v8a2 2 0 0 0 2 2h8z" fill="#bfe6f4" />
        <rect x="22" y="32" width="18" height="3" rx="1.5" fill="#7fcbe6" />
        <rect x="22" y="39" width="13" height="3" rx="1.5" fill="#7fcbe6" />
        <path d="M47 6l2.4 5.6L55 14l-5.6 2.4L47 22l-2.4-5.6L39 14l5.6-2.4z" fill="#ff2d95" />
      </svg>
      <span className={cx("font-brand font-semibold tracking-tight", size === "lg" ? "text-3xl" : "text-xl")}>Notara</span>
    </span>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  return (
    <IconButton
      label={dark ? "Light mode" : "Dark mode"}
      onClick={() => {
        const next = !dark;
        document.documentElement.classList.toggle("dark", next);
        prefs.set("theme", next ? "dark" : "light");
        setDark(next);
      }}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </IconButton>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-panel-2 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/20";
