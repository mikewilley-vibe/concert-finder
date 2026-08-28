import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
        <Link href="/" className="flex min-h-11 items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-sm font-semibold text-background">
            MS
          </span>
          <span className="font-display text-base tracking-tight sm:text-lg">
            My Shows
          </span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/#favorite-bands"
            className="inline-flex min-h-11 touch-manipulation items-center px-2 text-sm text-mute transition-colors hover:text-foreground sm:px-3"
          >
            Bands
          </Link>
          <Link
            href="/#whats-coming"
            className="inline-flex min-h-11 touch-manipulation items-center px-2 text-sm text-mute transition-colors hover:text-foreground sm:px-3"
          >
            Shows
          </Link>
          <Link
            href="/account"
            className="inline-flex min-h-11 touch-manipulation items-center px-2 text-sm text-mute transition-colors hover:text-foreground sm:px-3"
          >
            Account
          </Link>
        </nav>
      </div>
    </header>
  );
}
