import type { Metadata } from "next";
import { NewShows } from "./components/new-shows";
import { ShowList } from "./components/show-list";
import { ShowsForYou } from "./components/shows-for-you";
import { SiteHeader } from "./components/site-header";
import {
  FollowedItemsManage,
  TicketmasterFollows,
} from "./components/ticketmaster-follows";

const homeTitle = "My Shows · Concerts for the bands and rooms you follow";
const homeDescription =
  "Follow artists and venues, see upcoming concerts, and keep a listings board — for music fans who want to stay aware of what's coming.";

export const metadata: Metadata = {
  title: {
    absolute: homeTitle,
  },
  description: homeDescription,
  openGraph: {
    title: homeTitle,
    description: homeDescription,
    type: "website",
    url: "/",
    siteName: "My Shows",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: homeTitle,
    description: homeDescription,
  },
};

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[20rem] bg-[radial-gradient(ellipse_at_top,_rgba(216,255,62,0.16),_transparent_58%)] sm:h-[28rem]"
      />

      <SiteHeader />

      <main
        id="main"
        tabIndex={-1}
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-20 outline-none sm:px-8 sm:pb-16"
      >
        <section className="flex max-w-2xl flex-col gap-4 py-8 sm:gap-6 sm:py-16">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent sm:text-sm">
            For music fans
          </p>
          <h1 className="font-display text-[1.75rem] leading-[1.12] font-medium tracking-tight sm:text-5xl lg:text-6xl">
            Never miss a night with the bands and rooms you love.
          </h1>
          <p className="max-w-xl text-base leading-7 text-mute sm:text-lg sm:leading-8">
            My Shows helps you stay aware of concerts. Follow the bands you
            love, see what's coming to venues you follow, and keep a listings
            board of shows.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="#whats-coming"
              className="inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full bg-accent px-7 text-base font-semibold text-background transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:w-auto"
            >
              See listings
            </a>
            <a
              href="#follows"
              className="inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full border border-line px-7 text-base font-semibold text-foreground transition-colors hover:bg-panel focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:w-auto"
            >
              Follow an artist
            </a>
          </div>
        </section>

        <div className="flex flex-col gap-12 sm:gap-16">
          <TicketmasterFollows />

          <ShowsForYou />

          <section id="whats-coming" className="scroll-mt-24">
            <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
              Listings
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-mute sm:text-base">
              Concerts you've added, plus a few example cards.
            </p>
            <ShowList />
          </section>

          <FollowedItemsManage />

          <NewShows />
        </div>
      </main>

      <footer className="relative z-10 border-t border-line pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-mute sm:px-8">
          My Shows · Listings include example cards. Alerts and calendar sync
          can come later. This app does not sell tickets.
        </p>
      </footer>
    </div>
  );
}
