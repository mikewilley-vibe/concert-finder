import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

const headerLinkClass =
  "inline-flex min-h-11 touch-manipulation items-center px-2 text-sm text-mute transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:px-3";

export function LegalPage({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[20rem] bg-[radial-gradient(ellipse_at_top,_rgba(216,255,62,0.16),_transparent_58%)] sm:h-[28rem]"
      />
      <a
        href="#main"
        className="fixed left-4 top-0 z-50 inline-flex min-h-11 max-w-[calc(100%-2rem)] -translate-y-full items-center rounded-full bg-accent px-4 text-sm font-semibold text-background outline-none transition-transform focus:translate-y-[max(0.75rem,env(safe-area-inset-top))] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-20 border-b border-line/70 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 sm:px-8 sm:py-4">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <Image
              src="/icon.png"
              alt=""
              aria-hidden="true"
              width={32}
              height={32}
              className="h-8 w-8 rounded-md"
              priority
            />
            <span className="font-display text-base tracking-tight sm:text-lg">
              ShowSignal
            </span>
          </Link>
          <nav aria-label="Privacy and support" className="flex items-center gap-1">
            <Link href="/privacy" className={headerLinkClass}>
              Privacy
            </Link>
            <Link href="/support" className={headerLinkClass}>
              Support
            </Link>
          </nav>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-8 pb-20 outline-none sm:px-8 sm:pt-12 sm:pb-16"
      >
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent sm:text-sm">
          {eyebrow}
        </p>
        <h1 className="mt-3 font-display text-[1.75rem] leading-[1.12] font-medium tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-mute sm:text-lg sm:leading-8">
          {lede}
        </p>
        <div className="mt-10 flex flex-col gap-10 text-base leading-7 sm:gap-12">
          {children}
        </div>
      </main>
      <footer className="relative z-10 border-t border-line pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-mute sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>ShowSignal · This app does not sell tickets.</p>
          <nav aria-label="Policies" className="flex gap-4">
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center text-foreground underline decoration-line underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              Privacy
            </Link>
            <Link
              href="/support"
              className="inline-flex min-h-11 items-center text-foreground underline decoration-line underline-offset-4 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              Support
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-mute">{children}</div>
    </section>
  );
}
