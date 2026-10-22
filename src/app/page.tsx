"use client";

import {
  ArrowRight,
  AudioLines,
  BrainCircuit,
  Check,
  ChevronDown,
  Compass,
  FileText,
  Globe,
  Image as ImageIcon,
  Languages,
  Layers,
  ListChecks,
  Lock,
  MessageSquareQuote,
  MonitorPlay,
  Presentation,
  Sheet,
  Sparkles,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo, ThemeToggle, cx } from "@/components/ui";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#downloads", label: "Downloads" },
  { href: "#faq", label: "FAQ" },
];

const FORMATS: { icon: LucideIcon; label: string }[] = [
  { icon: FileText, label: "PDF & Word" },
  { icon: Globe, label: "Websites" },
  { icon: MonitorPlay, label: "YouTube" },
  { icon: ImageIcon, label: "Photos & scans" },
  { icon: StickyNote, label: "Notes & text" },
  { icon: Compass, label: "Web discovery" },
];

const STEPS = [
  { title: "Add your sources", text: "Upload PDFs and documents, paste links to articles or YouTube videos, or let Notara search the web for you." },
  { title: "Ask and explore", text: "Chat with everything at once. Every answer points to the exact passage it came from, so you can check it in one click." },
  { title: "Create and download", text: "Turn sources into study guides, quizzes, mind maps, podcasts and slide decks, then download them in the format you need." },
];

const DOWNLOADS = [
  { what: "Reports, notes and chat answers", formats: ["PDF", "Word", "Markdown", "HTML", "TXT"] },
  { what: "Slide decks", formats: ["PowerPoint"] },
  { what: "Mind maps", formats: ["PNG", "SVG"] },
  { what: "Flashcards", formats: ["Anki CSV", "PDF"] },
  { what: "Quizzes and data tables", formats: ["CSV", "PDF", "Word"] },
  { what: "A whole notebook", formats: ["ZIP", "Backup file"] },
];

const FAQ = [
  {
    q: "Is Notara free to use?",
    a: "Yes. Notara runs on free Groq models out of the box. If you add a Claude API key in Settings, it switches to Claude for longer documents and more precise citations.",
  },
  {
    q: "Where are my notebooks stored?",
    a: "In your own browser. There is no account and no database on our side. Your sources are sent to the AI model only when you ask a question or create something, and you can download a backup of any notebook at any time.",
  },
  {
    q: "What can I upload?",
    a: "PDF, Word, text, Markdown, CSV, HTML and subtitle files, photos of notes or scanned pages, website links and YouTube videos with captions. You can also paste text or turn your own notes into sources.",
  },
  {
    q: "Can it answer in Urdu?",
    a: "Yes. Chat answers and every Studio output can be written in 16 languages, including Urdu and Roman Urdu, Hindi, Arabic, Turkish and Spanish.",
  },
  {
    q: "How are answers checked?",
    a: "Answers are grounded in the sources you select and carry numbered citations. Hover a citation to read the quote, or click it to open the source with that passage highlighted.",
  },
];

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className={cx("sticky top-0 z-40 transition", scrolled ? "border-b border-line bg-bg/85 backdrop-blur" : "border-b border-transparent")}>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="Notara home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="transition hover:text-ink">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex-1" />
          <ThemeToggle />
          <Link href="/notebooks" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:opacity-90">
            Open Notara <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--line)_1px,transparent_1px),linear-gradient(to_bottom,var(--line)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="pointer-events-none absolute left-1/2 top-[-180px] -z-10 h-[420px] w-[820px] max-w-full -translate-x-1/2 rounded-full bg-[#007ba7]/25 blur-[120px]" />
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-line bg-panel/80 px-3 py-1 text-xs font-medium text-muted">
            <Sparkles className="size-3.5 text-rose" /> Your AI research notebook
          </p>
          <h1 className="mx-auto mt-6 max-w-4xl font-display text-[40px] font-extrabold leading-[1.04] tracking-[-0.03em] [text-wrap:balance] sm:text-6xl lg:text-7xl">
            Understand anything you read, <span className="text-accent">with sources</span> you can check.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted [text-wrap:balance] sm:text-lg">
            Upload documents, websites and videos. Ask questions and get answers with citations. Turn it all into study guides, podcasts, mind maps and slides you can download.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/notebooks"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-semibold text-accent-ink shadow-[0_8px_30px_-8px] shadow-[#007ba7]/60 transition hover:opacity-90"
            >
              Start a notebook <ArrowRight className="size-4" />
            </Link>
            <a href="#features" className="inline-flex h-12 items-center rounded-full border border-line bg-panel px-6 font-semibold transition hover:border-accent/60">
              See what it does
            </a>
          </div>
          <p className="mt-4 text-xs text-muted">Free to use · No sign-up · Notebooks stay in your browser</p>

          <AppPreview />
        </div>
      </section>

      {/* Supported inputs */}
      <section className="border-y border-line bg-panel/50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-6 sm:px-6">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Works with</span>
          {FORMATS.map((f) => (
            <span key={f.label} className="inline-flex items-center gap-2 text-sm font-medium">
              <f.icon className="size-4 text-accent" /> {f.label}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6">
        <SectionTitle eyebrow="Features" title="One workspace for reading, thinking and studying" text="Everything NotebookLM does, plus the tools students and researchers kept asking for." />
        <div className="mt-14 grid gap-4 md:grid-cols-6">
          <FeatureCard className="md:col-span-4" icon={MessageSquareQuote} title="Answers with citations" text="Ask across all your sources at once. Each claim links to the passage it came from. Hover to read the quote, click to jump to it.">
            <div className="mt-6 rounded-2xl border border-line bg-panel-2 p-4 text-left text-sm leading-relaxed">
              Wheat yields in Punjab are most exposed to <b>heat stress during grain filling</b>
              <Chip n={1} /> and to shifting monsoon timing, which delays sowing
              <Chip n={2} />.
              <div className="mt-3 rounded-xl border border-line bg-panel p-3 text-xs text-muted">
                <span className="font-semibold text-accent">Climate Risk Report 2025 · p. 14</span>
                <br />“Each 1 °C rise above 34 °C during grain filling reduced yields by 6–8 percent…”
              </div>
            </div>
          </FeatureCard>
          <FeatureCard className="md:col-span-2" icon={AudioLines} title="Audio Overviews" text="Two hosts discuss your sources as a podcast. Pick a deep dive, a quick brief, a debate or a critique.">
            <div className="mt-6 flex h-16 items-end gap-[3px]" aria-hidden>
              {Array.from({ length: 34 }, (_, k) => (
                <span key={k} className={cx("w-full rounded-full", k < 20 ? "bg-rose" : "bg-line")} style={{ height: `${25 + Math.abs(Math.sin(k * 1.7)) * 70}%` }} />
              ))}
            </div>
          </FeatureCard>
          <FeatureCard className="md:col-span-2" icon={BrainCircuit} title="Mind maps" text="See how ideas connect. Expand branches, open details, and export the map as an image.">
            <MiniMap />
          </FeatureCard>
          <FeatureCard className="md:col-span-2" icon={Layers} title="Flashcards and quizzes" text="Study mode with flip cards, scoring and explanations. Export flashcards straight to Anki.">
            <div className="mt-6 space-y-2 text-left text-sm">
              {["Light reactions happen in the stroma", "Light reactions happen in the thylakoid membrane"].map((o, i) => (
                <div key={o} className={cx("flex items-center gap-2 rounded-xl border px-3 py-2", i ? "border-emerald-500/60 bg-emerald-500/10" : "border-line opacity-60")}>
                  <span className={cx("flex size-5 items-center justify-center rounded-full text-[10px] font-bold", i ? "bg-emerald-500 text-white" : "border border-line")}>{i ? <Check className="size-3" /> : "A"}</span>
                  {o}
                </div>
              ))}
            </div>
          </FeatureCard>
          <FeatureCard className="md:col-span-2" icon={Presentation} title="Slides and reports" text="Briefing docs, study guides, FAQs, timelines, blog posts and full slide decks you can open in PowerPoint.">
            <div className="mt-6 grid grid-cols-3 gap-2" aria-hidden>
              {[0, 1, 2].map((k) => (
                <div key={k} className={cx("aspect-video rounded-lg border border-line p-1.5", k === 0 ? "bg-[#0a0a0a]" : "bg-white")}>
                  <div className={cx("h-1 w-1/2 rounded", k === 0 ? "bg-white/80" : "bg-[#0a0a0a]/70")} />
                  <div className={cx("mt-1 h-0.5 w-1/4 rounded", k === 0 ? "bg-rose" : "bg-[#007ba7]")} />
                  {k > 0 && <div className="mt-1.5 space-y-0.5">{[0, 1, 2].map((l) => <div key={l} className="h-0.5 w-4/5 rounded bg-stone-300" />)}</div>}
                </div>
              ))}
            </div>
          </FeatureCard>
          <FeatureCard className="md:col-span-3" icon={Compass} title="Discover sources on the web" text="Describe a topic and Notara searches the web for readable, reputable pages. Pick the ones you want and they are imported in seconds." />
          <FeatureCard className="md:col-span-3" icon={Languages} title="Works in your language" text="Answers and Studio outputs in 16 languages, including Urdu and Roman Urdu. Speak your question with voice input, or have answers read aloud." />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-y border-line bg-panel/50">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionTitle eyebrow="How it works" title="From a pile of files to real understanding" />
          <ol className="mt-14 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-line bg-panel p-6">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">{i + 1}</span>
                <h3 className="mt-5 font-display text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Downloads */}
      <section id="downloads" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <SectionTitle align="left" eyebrow="Downloads" title="Take your work anywhere" text="Everything you create can leave Notara in a format you already use: hand in a Word document, present a PowerPoint, or import cards into Anki." />
            <div className="mt-8 flex items-start gap-3 rounded-2xl border border-line bg-panel p-5">
              <Lock className="mt-0.5 size-5 shrink-0 text-rose" />
              <div>
                <p className="font-semibold">Private by design</p>
                <p className="mt-1 text-sm text-muted">No account and no server database. Notebooks are saved in your browser, and a backup file moves them to any device.</p>
              </div>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-panel">
            {DOWNLOADS.map((d) => (
              <div key={d.what} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 last:border-b-0">
                <span className="min-w-0 flex-1 text-sm font-medium">{d.what}</span>
                <span className="flex flex-wrap gap-1.5">
                  {d.formats.map((f) => (
                    <span key={f} className="rounded-md border border-line bg-panel-2 px-2 py-0.5 text-xs font-semibold text-muted">
                      {f}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-line bg-panel/50">
        <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
          <SectionTitle eyebrow="FAQ" title="Questions, answered" />
          <div className="mt-12 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="size-4 shrink-0 text-muted transition group-open:rotate-180" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-[#0a0a0a] px-6 py-14 text-center text-white ring-1 ring-white/10 sm:px-12">
          <div className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full bg-[#007ba7]/40 blur-[90px]" />
          <div className="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-[#ff2d95]/25 blur-[90px]" />
          <h2 className="relative mx-auto max-w-2xl font-display text-3xl font-extrabold tracking-tight [text-wrap:balance] sm:text-5xl">Start your first notebook in under a minute.</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/70">No sign-up. Drop in a PDF and ask your first question.</p>
          <Link href="/notebooks" className="relative mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-[#0a0a0a] transition hover:bg-white/90">
            Open Notara <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-8 text-sm text-muted sm:px-6">
          <Logo />
          <span className="flex-1">Your AI research notebook.</span>
          <span>Designed &amp; developed by Muhammad Talha Khan</span>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SectionTitle({ eyebrow, title, text, align = "center" }: { eyebrow: string; title: string; text?: string; align?: "center" | "left" }) {
  return (
    <div className={cx(align === "center" && "mx-auto max-w-2xl text-center")}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose">{eyebrow}</p>
      <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight [text-wrap:balance] sm:text-[42px] sm:leading-[1.1]">{title}</h2>
      {text && <p className="mt-4 text-muted [text-wrap:pretty]">{text}</p>}
    </div>
  );
}

function FeatureCard({ icon: Icon, title, text, className, children }: { icon: LucideIcon; title: string; text: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cx("flex min-w-0 flex-col rounded-2xl border border-line bg-panel p-6", className)}>
      <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-5 font-display text-lg font-bold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
      {children}
    </div>
  );
}

const Chip = ({ n }: { n: number }) => (
  <span className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-soft px-1.5 align-baseline text-[11px] font-semibold text-accent">{n}</span>
);

function MiniMap() {
  const kids = [
    { y: 14, label: "Causes", c: "#007ba7" },
    { y: 46, label: "Impacts", c: "#ff2d95" },
    { y: 78, label: "Solutions", c: "#10b981" },
  ];
  return (
    <svg viewBox="0 0 260 96" className="mt-6 w-full" aria-hidden>
      {kids.map((k) => (
        <path key={k.label} d={`M86,48 C110,48 118,${k.y + 9} 142,${k.y + 9}`} fill="none" stroke={k.c} strokeOpacity={0.6} strokeWidth={2} />
      ))}
      <rect x="4" y="36" width="82" height="24" rx="8" fill="#0a0a0a" stroke="var(--line)" />
      <text x="45" y="52" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">Climate</text>
      {kids.map((k) => (
        <g key={k.label}>
          <rect x="142" y={k.y} width="96" height="18" rx="7" fill={k.c} fillOpacity={0.15} stroke={k.c} />
          <text x="190" y={k.y + 12.5} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--ink)">
            {k.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** A static illustration of the workspace: sources, chat with citations, and Studio. */
function AppPreview() {
  const tools: [LucideIcon, string][] = [
    [AudioLines, "Audio Overview"],
    [BrainCircuit, "Mind Map"],
    [ListChecks, "Quiz"],
    [Presentation, "Slide Deck"],
    [Layers, "Flashcards"],
    [Sheet, "Data Table"],
  ];
  return (
    <div className="relative mx-auto mt-16 max-w-6xl" aria-hidden>
      <div className="absolute -inset-x-6 -bottom-6 top-10 -z-10 rounded-[40px] bg-gradient-to-b from-[#007ba7]/30 via-[#ff2d95]/10 to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-line bg-panel text-left shadow-2xl shadow-black/30">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 truncate text-xs text-muted">🌍 Climate &amp; agriculture in Pakistan</span>
        </div>
        <div className="grid gap-3 bg-bg p-3 md:grid-cols-[220px_1fr] lg:grid-cols-[220px_1fr_240px]">
          <div className="hidden rounded-xl border border-line bg-panel p-3 md:block">
            <p className="text-xs font-semibold">Sources</p>
            {[
              [FileText, "Climate Risk Report 2025", "text-rose-500"],
              [Globe, "FAO: Climate & agriculture", "text-emerald-500"],
              [MonitorPlay, "Lecture 4: Monsoon shifts", "text-red-500"],
              [ImageIcon, "Field notes (photo)", "text-amber-500"],
            ].map(([Icon, t, c]) => {
              const I = Icon as LucideIcon;
              return (
                <div key={t as string} className="mt-2 flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[12px]">
                  <I className={cx("size-3.5 shrink-0", c as string)} />
                  <span className="min-w-0 flex-1 truncate">{t as string}</span>
                  <span className="flex size-3.5 items-center justify-center rounded-[4px] bg-accent text-white">
                    <Check className="size-2.5" />
                  </span>
                </div>
              );
            })}
          </div>
          <div className="min-w-0 rounded-xl border border-line bg-panel p-4">
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[13px] text-white">Which crops face the biggest risk, and why?</div>
            <div className="mt-4 space-y-2 text-[13px] leading-relaxed">
              <p>
                <b>Wheat</b> faces the highest risk: heat above 34 °C during grain filling cuts yields by 6–8% per degree
                <Chip n={1} />. <b>Rice</b> is exposed to later and more erratic monsoons, which delay transplanting
                <Chip n={2} />
                <Chip n={3} />.
              </p>
              <p className="text-muted">Field notes also mention water shortages in lower Sindh during April <Chip n={4} />.</p>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-full border border-line px-3 py-2 text-[12px] text-muted">
              Ask about 4 sources… <span className="ml-auto flex size-6 items-center justify-center rounded-full bg-accent text-white"><ArrowRight className="size-3" /></span>
            </div>
          </div>
          <div className="hidden rounded-xl border border-line bg-panel p-3 lg:block">
            <p className="text-xs font-semibold">Studio</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {tools.map(([I, t]) => (
                <div key={t} className="rounded-lg bg-accent-soft p-2 text-[11px] font-semibold">
                  <I className="mb-1 size-3.5 text-accent" />
                  {t}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-line p-2 text-[11px]">
              <span className="flex size-6 items-center justify-center rounded-md bg-rose/15 text-rose">
                <AudioLines className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate">Deep dive: Farming in a warmer Pakistan</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
