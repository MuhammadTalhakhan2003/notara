"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./ui";

export const PORTFOLIO_URL = "https://muhammadtalhakhan2003.github.io/PortFolio_Talha/";

const QUIPS = [
  "Made with chai, curiosity and slightly too many browser tabs.",
  "No notebooks were harmed in the making of this app.",
  "Reads 300 pages so you can read the 3 that matter.",
  "Powered by caffeine and citations.",
  "Your sources called. They'd like to be understood.",
];

export function SiteFooter() {
  // Picked after mount so the server and browser render the same first frame.
  const [quip, setQuip] = useState(QUIPS[0]);
  useEffect(() => setQuip(QUIPS[Math.floor(Math.random() * QUIPS.length)]), []);

  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <Logo />
          <p className="mt-3 max-w-sm font-brand text-[15px] italic text-muted">{quip}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/notebooks" className="hover:text-ink">
            Notebooks
          </Link>
          <Link href="/plus" className="hover:text-ink">
            Notara Plus
          </Link>
          <a href="https://github.com/MuhammadTalhakhan2003/notara" target="_blank" rel="noopener noreferrer" className="hover:text-ink">
            GitHub
          </a>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted sm:px-6">
          © {new Date().getFullYear()} Notara · Designed &amp; developed by{" "}
          <a href={PORTFOLIO_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline decoration-rose/60 decoration-2 underline-offset-4 transition hover:text-rose">
            Muhammad Talha Khan
          </a>
        </p>
      </div>
    </footer>
  );
}
