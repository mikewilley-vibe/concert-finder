import { FavoriteBands } from "./components/favorite-bands";
import { ShowList } from "./components/show-list";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[20rem] bg-[radial-gradient(ellipse_at_top,_rgba(216,255,62,0.16),_transparent_58%)] sm:h-[28rem]"
      />

      <header className="sticky top-0 z-20 border-b border-line/70 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
          <a href="/" className="flex min-h-11 items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-accent text-sm font-semibold text-background">
              MS
            </span>
            <span className="font-display text-base tracking-tight sm:text-lg">
              My Shows
            </span>
          </a>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href="#favorite-bands"
              className="inline-flex min-h-11 touch-manipulation items-center px-2 text-sm text-mute transition-colors hover:text-foreground sm:px-3"
            >
              Bands
            </a>
            <a
              href="#whats-coming"
              className="inline-flex min-h-11 touch-manipulation items-center px-2 text-sm text-mute transition-colors hover:text-foreground sm:px-3"
            >
              Shows
            </a>
          </nav>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-20 sm:px-8 sm:pb-16">
        <section className="flex max-w-2xl flex-col gap-4 py-8 sm:gap-6 sm:py-16">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent sm:text-sm">
            For music fans
          </p>
          <h1 className="font-display text-[1.75rem] leading-[1.12] font-medium tracking-tight sm:text-5xl lg:text-6xl">
            Never miss a night with the bands and rooms you love.
          </h1>
          <p className="max-w-xl text-base leading-7 text-mute sm:text-lg sm:leading-8">
            My Shows helps you stay aware of concerts. See when your favorite
            bands are nearby, what’s coming to venues around you, album
            releases on the horizon, and a taste of recent setlists and genres
            before you go.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="#whats-coming"
              className="inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-background transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:w-auto"
            >
              See what’s coming
            </a>
            <a
              href="#favorite-bands"
              className="inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full border border-line px-7 text-base font-semibold text-foreground transition-colors hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:w-auto"
            >
              Add favorite bands
            </a>
          </div>
        </section>

        <div className="flex flex-col gap-12 sm:gap-16">
          <FavoriteBands />

          <ShowList />
        </div>
      </main>

      <footer className="relative z-10 border-t border-line pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-mute sm:px-8">
          My Shows · Sample data for now. Alerts and calendar sync can come
          later.
        </p>
      </footer>
    </div>
  );
}
