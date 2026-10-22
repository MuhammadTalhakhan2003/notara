import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose">Error 404</p>
      <h1 className="mt-4 font-brand text-6xl font-semibold tracking-tight sm:text-8xl">
        Page <span className="italic text-accent">not found</span>
      </h1>
      <p className="mt-5 max-w-md text-muted">
        We searched every source, checked the footnotes and even looked under the bibliography. This page went to study abroad and never came back.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex h-11 items-center rounded-full bg-accent px-6 font-semibold text-accent-ink transition hover:opacity-90">
          Take me home
        </Link>
        <Link href="/notebooks" className="inline-flex h-11 items-center rounded-full border border-line px-6 font-semibold transition hover:border-accent/60">
          My notebooks
        </Link>
      </div>
    </main>
  );
}
