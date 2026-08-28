import Link from "next/link";

const navLinkClass =
  "inline-flex min-h-11 touch-manipulation items-center px-2 text-sm text-mute transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:px-3";

export function SiteHeader() {
  return (
    <>
      <a
        href="#main"
        className="fixed left-4 top-0 z-50 inline-flex min-h-11 max-w-[calc(100%-2rem)] -translate-y-full items-center rounded-full bg-accent px-4 text-sm font-semibold text-background outline-none transition-transform focus:translate-y-[max(0.75rem,env(safe-area-inset-top))] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-20 border-b border-line/70 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-md bg-accent text-sm font-semibold text-background"
            >
              MS
            </span>
            <span className="font-display text-base tracking-tight sm:text-lg">
              My Shows
            </span>
          </Link>
          <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
            <Link href="/#shows-for-you" className={navLinkClass}>
              Upcoming
            </Link>
            <Link href="/#follows" className={navLinkClass}>
              Follow
            </Link>
            <Link href="/#whats-coming" className={navLinkClass}>
              Listings
            </Link>
            <Link href="/#new-shows" className={navLinkClass}>
              New shows
            </Link>
            <Link href="/my-submissions" className={navLinkClass}>
              Submissions
            </Link>
            <Link href="/account" className={navLinkClass}>
              Account
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
