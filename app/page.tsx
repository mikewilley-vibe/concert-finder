import { FavoriteBands } from "./components/favorite-bands";
import { NewShows } from "./components/new-shows";
import { ShowList } from "./components/show-list";
import { ShowsForYou } from "./components/shows-for-you";
import { SiteHeader } from "./components/site-header";
import { TicketmasterFollows } from "./components/ticketmaster-follows";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[20rem] bg-[radial-gradient(ellipse_at_top,_rgba(216,255,62,0.16),_transparent_58%)] sm:h-[28rem]"
      />

      <SiteHeader />

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

          <NewShows />

          <TicketmasterFollows />

          <ShowsForYou />

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
