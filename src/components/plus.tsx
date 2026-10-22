"use client";

import { Check, Crown, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { FREE_LIMITS, PLUS_PRICE, askUpgrade, closeUpgrade, setPlus, usePlus, useUpgradeReason, whatsappPlusLink } from "@/lib/plus";
import { Button, Modal, cx, inputCls, toast } from "./ui";

export const PLUS_PERKS = [
  "Unlimited questions every day",
  "Unlimited Studio creations",
  `Up to 50 sources per notebook (free: ${FREE_LIMITS.sources})`,
  "Web Discover: find sources on any topic",
  "Slide Decks you can download as PowerPoint",
  "Custom Reports written to your brief",
];

/** Small header control: a gold "Plus" chip for members, an upgrade link for everyone else. */
export function PlusButton({ className }: { className?: string }) {
  const plus = usePlus();
  return plus ? (
    <Link
      href="/plus"
      title={`Notara Plus active until ${plus.expires}`}
      className={cx("inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-2.5 py-1 text-[11px] font-bold text-amber-950", className)}
    >
      <Crown className="size-3.5" /> PLUS
    </Link>
  ) : (
    <Link
      href="/plus"
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border border-rose/40 px-3 py-1 text-xs font-semibold text-rose transition hover:bg-rose/10",
        className,
      )}
    >
      <Crown className="size-3.5" /> Get Plus
    </Link>
  );
}

/** Enter the code Talha sends on WhatsApp to switch Plus on in this browser. */
export function ActivatePlus({ onDone }: { onDone?: () => void }) {
  const plus = usePlus();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (plus)
    return (
      <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
        <p className="flex items-center gap-2 font-semibold">
          <Crown className="size-4 text-amber-500" /> Notara Plus is active
        </p>
        <p className="mt-1 text-sm text-muted">Valid until {new Date(plus.expires).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}. Thank you for supporting an indie developer!</p>
        <button className="mt-3 text-xs text-muted underline-offset-2 hover:underline" onClick={() => setPlus(null)}>
          Remove Plus from this browser
        </button>
      </div>
    );

  const activate = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ expires: string }>("/api/plus", { code: code.trim().toUpperCase() });
      setPlus({ code: code.trim().toUpperCase(), expires: r.expires });
      toast("Welcome to Notara Plus ✨");
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check that code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label htmlFor="plus-code" className="mb-1.5 block text-sm font-medium">
        Already paid? Enter your Plus code
      </label>
      <div className="flex gap-2">
        <input
          id="plus-code"
          className={cx(inputCls, "font-mono uppercase tracking-wide")}
          placeholder="NPLUS-XXXXXXXX-XXXX-XXXXXXXXXXXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && code.trim() && activate()}
        />
        <Button variant="primary" onClick={activate} loading={busy} disabled={!code.trim()}>
          Activate
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

/** Mounted once per page; opens when a limit is hit or a Plus-only feature is used. */
export function UpgradeDialog() {
  const reason = useUpgradeReason();
  useEffect(() => {
    const on = (e: Event) => askUpgrade("That one's a Plus feature", String((e as CustomEvent).detail ?? "Upgrade to Notara Plus to use it."));
    window.addEventListener("notara:upgrade", on);
    return () => window.removeEventListener("notara:upgrade", on);
  }, []);

  return (
    <Modal open={!!reason} onClose={closeUpgrade} title={<span className="flex items-center gap-2"><Crown className="size-5 text-amber-500" /> {reason?.title}</span>}>
      <div className="space-y-5 p-5">
        <p className="text-sm text-muted">{reason?.text}</p>
        <div className="rounded-2xl border border-line bg-panel-2 p-4">
          <p className="font-brand text-2xl font-semibold">
            {PLUS_PRICE} <span className="font-sans text-sm font-normal text-muted">/ month</span>
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {PLUS_PERKS.map((p) => (
              <li key={p} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-accent" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <a
          href={whatsappPlusLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] font-semibold text-[#0a0a0a] transition hover:opacity-90"
        >
          <MessageCircle className="size-4" /> Get Plus on WhatsApp
        </a>
        <ActivatePlus onDone={closeUpgrade} />
        <p className="text-center text-xs text-muted">
          <Link href="/plus" className="underline-offset-2 hover:underline" onClick={closeUpgrade}>
            See everything in Plus
          </Link>
        </p>
      </div>
    </Modal>
  );
}
