"use client";

import { Check, ChevronDown, Crown, KeyRound, MessageCircle, Minus, Wallet } from "lucide-react";
import { MarketingNav, Ornament } from "@/components/MarketingNav";
import { ActivatePlus } from "@/components/plus";
import { SiteFooter } from "@/components/SiteFooter";
import { Toaster, cx } from "@/components/ui";
import { FREE_LIMITS, PLUS_PRICE, WHATSAPP_DISPLAY, usePlus, whatsappPlusLink } from "@/lib/plus";

const COMPARE: { feature: string; free: string | boolean; plus: string | boolean }[] = [
  { feature: "Questions to your sources", free: `${FREE_LIMITS.chat} a day`, plus: "Unlimited" },
  { feature: "Studio creations (guides, quizzes, podcasts…)", free: `${FREE_LIMITS.studio} a day`, plus: "Unlimited" },
  { feature: "Sources per notebook", free: String(FREE_LIMITS.sources), plus: "50" },
  { feature: "Cited answers in 16 languages", free: true, plus: true },
  { feature: "Downloads: PDF, Word, Markdown, CSV, PNG, ZIP", free: true, plus: true },
  { feature: "Web Discover: find sources on any topic", free: false, plus: true },
  { feature: "Slide Decks (PowerPoint download)", free: false, plus: true },
  { feature: "Custom Reports written to your brief", free: false, plus: true },
];

const STEPS = [
  { icon: MessageCircle, title: "Message on WhatsApp", text: `Tap the button and send the ready-made message to ${WHATSAPP_DISPLAY}.` },
  { icon: Wallet, title: "Pay your way", text: "Talha replies with payment details for JazzCash, EasyPaisa or bank transfer." },
  { icon: KeyRound, title: "Enter your code", text: "You get a Plus code back. Paste it below and Plus switches on instantly." },
];

const FAQ = [
  { q: "Does Plus renew automatically?", a: "No. Each code lasts for one month. Nothing is charged automatically; when your month ends, message again to renew." },
  { q: "Can I use my code on another device?", a: "Yes. Enter the same code in Settings on any browser where you use Notara." },
  { q: "What happens to my notebooks if Plus ends?", a: "Nothing is deleted. Your notebooks stay in your browser and the free plan's daily limits apply again." },
  { q: "Who am I paying?", a: "Notara is built and run by one independent developer, Muhammad Talha Khan. Your payment goes directly to him and keeps the servers running." },
];

const Cell = ({ v, plus }: { v: string | boolean; plus?: boolean }) =>
  typeof v === "string" ? (
    <span className={cx("text-sm", plus && "font-semibold")}>{v}</span>
  ) : v ? (
    <Check className={cx("mx-auto size-4", plus ? "text-amber-500" : "text-accent")} aria-label="Included" />
  ) : (
    <Minus className="mx-auto size-4 text-muted/50" aria-label="Not included" />
  );

export default function PlusPage() {
  const plus = usePlus();

  return (
    <div className="min-h-dvh overflow-x-clip">
      <MarketingNav />

      <section className="relative">
        <div className="pointer-events-none absolute left-1/2 top-[-160px] -z-10 h-[380px] w-[760px] max-w-full -translate-x-1/2 rounded-full bg-amber-400/15 blur-[120px]" />
        <div className="mx-auto max-w-4xl px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">For people who read for a living</p>
          <h1 className="mt-5 font-brand text-6xl font-semibold leading-none tracking-tight sm:text-8xl">
            Notara{" "}
            <span className="bg-gradient-to-br from-amber-200 via-amber-400 to-[#ff2d95] bg-clip-text italic text-transparent">Plus</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted [text-wrap:balance]">
            No daily limits, bigger notebooks, and the premium tools. For the thesis, the bar exam, or the quiz on Monday you just remembered.
          </p>
          <Ornament className="mt-10" />
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 pb-20 sm:px-6 lg:grid-cols-[1fr_1.15fr]">
        {/* Price card */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-400/40 bg-panel p-8 shadow-2xl shadow-amber-500/10">
          <div className="pointer-events-none absolute inset-2 rounded-[20px] border border-amber-400/20" aria-hidden />
          <div className="relative">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">
              <Crown className="size-4" /> Notara Plus
            </p>
            <p className="mt-5 font-brand text-6xl font-semibold tracking-tight">
              {PLUS_PRICE}
              <span className="ml-1 font-sans text-base font-normal text-muted">/ month</span>
            </p>
            <p className="mt-2 text-sm text-muted">Less than a plate of biryani and a cold drink. Much better for your grades.</p>
            {plus ? (
              <div className="mt-7">
                <ActivatePlus />
              </div>
            ) : (
              <>
                <a
                  href={whatsappPlusLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] font-semibold text-[#0a0a0a] transition hover:opacity-90"
                >
                  <MessageCircle className="size-5" /> Get Plus on WhatsApp
                </a>
                <p className="mt-3 text-center text-xs text-muted">Talha activates every Plus code personally.</p>
                <div className="mt-7 border-t border-line pt-6">
                  <ActivatePlus />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Comparison */}
        <div className="overflow-hidden rounded-3xl border border-line bg-panel">
          <div className="grid grid-cols-[1fr_84px_84px] items-center border-b border-line bg-panel-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted">
            <span>Feature</span>
            <span className="text-center">Free</span>
            <span className="text-center text-amber-500">Plus</span>
          </div>
          {COMPARE.map((r) => (
            <div key={r.feature} className="grid grid-cols-[1fr_84px_84px] items-center border-b border-line px-5 py-3.5 text-center last:border-b-0">
              <span className="pr-3 text-left text-sm">{r.feature}</span>
              <Cell v={r.free} />
              <Cell v={r.plus} plus />
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-panel/50">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-rose">How to upgrade</p>
          <h2 className="mt-3 text-center font-brand text-4xl font-semibold tracking-tight sm:text-5xl">Three steps, no card needed</h2>
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-line bg-panel p-6">
                <div className="flex items-center justify-between">
                  <span className="font-brand text-4xl italic text-muted/40">{i + 1}</span>
                  <s.icon className="size-5 text-accent" />
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="text-center font-brand text-4xl font-semibold tracking-tight">Good questions</h2>
        <div className="mt-10 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
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
      </section>

      <SiteFooter />
      <Toaster />
    </div>
  );
}
