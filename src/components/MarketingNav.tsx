"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PlusButton } from "./plus";
import { Logo, ThemeToggle, cx } from "./ui";

const NAV = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className={cx("sticky top-0 z-40 transition", scrolled ? "border-b border-line bg-bg/85 backdrop-blur" : "border-b border-transparent")}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Notara home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="transition hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <PlusButton className="hidden sm:inline-flex" />
        <ThemeToggle />
        <Link href="/notebooks" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:opacity-90">
          Open Notara <ArrowRight className="size-4" />
        </Link>
      </div>
    </header>
  );
}

/** A small classic flourish between sections. */
export function Ornament({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center justify-center gap-3 text-muted/60", className)} aria-hidden>
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-current" />
      <span className="text-rose">✦</span>
      <span className="text-xs">✦</span>
      <span className="text-accent">✦</span>
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-current" />
    </div>
  );
}
