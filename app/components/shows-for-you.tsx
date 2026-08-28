"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  FOLLOWS_CHANGED_EVENT,
  loadFollowedItems,
  type FollowedItem,
} from "../../lib/saved-follows";
import { ensureAnonymousUser } from "../../lib/saved-concerts";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser-client";
import {
  fetchUpcomingShows,
  TicketmasterShowResults,
  type ShowResult,
} from "./ticketmaster-show-results";

const ALL = "all";

const fieldClass =
  "min-h-12 w-full rounded-full border border-line bg-panel px-4 text-base text-foreground outline-none placeholder:text-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const primaryButtonClass =
  "inline-flex min-h-12 w-full shrink-0 touch-manipulation items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-background transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto";

function toRefs(items: FollowedItem[]) {
  return items.map((item) => ({
    id: item.item_key,
    label: item.item_label,
  }));
}

function pickFollowed(items: FollowedItem[], selected: string) {
  if (selected === ALL) {
    return items;
  }
  return items.filter((item) => item.item_key === selected);
}

function artistHeadingLabel(items: FollowedItem[], selected: string) {
  if (selected === ALL) {
    return "the artists you follow";
  }
  return (
    items.find((item) => item.item_key === selected)?.item_label ||
    "this artist"
  );
}

function upcomingArtistHeading(name: string, usedZip: boolean) {
  if (usedZip) {
    return `Upcoming shows for ${name} near your selected postal area`;
  }
  return `Upcoming shows for ${name}`;
}

export function ShowsForYou() {
  const [artists, setArtists] = useState<FollowedItem[]>([]);
  const [venues, setVenues] = useState<FollowedItem[]>([]);
  const [followsReady, setFollowsReady] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(ALL);
  const [selectedVenue, setSelectedVenue] = useState(ALL);
  const [postalCode, setPostalCode] = useState("");
  const [artistPending, setArtistPending] = useState(false);
  const [venuePending, setVenuePending] = useState(false);
  const [artistError, setArtistError] = useState<string | null>(null);
  const [venueError, setVenueError] = useState<string | null>(null);
  const [artistShows, setArtistShows] = useState<ShowResult[] | null>(null);
  const [artistUsedZip, setArtistUsedZip] = useState(false);
  const [artistResultHeading, setArtistResultHeading] = useState("");
  const [venueShows, setVenueShows] = useState<ShowResult[] | null>(null);
  const artistRequestRef = useRef<AbortController | null>(null);
  const venueRequestRef = useRef<AbortController | null>(null);

  async function refreshFollows() {
    const supabase = getSupabaseBrowserClient();
    await ensureAnonymousUser(supabase);
    const [nextArtists, nextVenues] = await Promise.all([
      loadFollowedItems(supabase, FOLLOWED_ATTRACTION_TYPE),
      loadFollowedItems(supabase, FOLLOWED_VENUE_TYPE),
    ]);
    setArtists(nextArtists);
    setVenues(nextVenues);
    return { nextArtists, nextVenues };
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        await refreshFollows();
      } catch {
        // Find buttons reload follows; keep the empty-state copy if none load.
      } finally {
        if (!cancelled) {
          setFollowsReady(true);
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onFollowsChanged() {
      void refreshFollows();
    }

    window.addEventListener(FOLLOWS_CHANGED_EVENT, onFollowsChanged);
    return () => {
      window.removeEventListener(FOLLOWS_CHANGED_EVENT, onFollowsChanged);
    };
  }, []);

  async function runArtistSearch(nextPostalCode: string) {
    if (artistPending) {
      return;
    }

    artistRequestRef.current?.abort();
    const controller = new AbortController();
    artistRequestRef.current = controller;
    setArtistPending(true);
    setArtistError(null);

    const zip = nextPostalCode.trim();

    try {
      const { nextArtists } = await refreshFollows();
      const chosen = pickFollowed(nextArtists, selectedArtist);
      if (chosen.length === 0) {
        setSelectedArtist(ALL);
        setArtistShows(null);
        setArtistResultHeading("");
        return;
      }

      const result = await fetchUpcomingShows(
        {
          attractions: toRefs(chosen),
          venues: [],
          ...(zip ? { postalCode: zip } : {}),
        },
        controller.signal,
      );

      if (!result.ok) {
        setArtistShows(null);
        setArtistError(result.error);
        return;
      }

      setArtistUsedZip(Boolean(zip));
      setArtistResultHeading(
        upcomingArtistHeading(artistHeadingLabel(nextArtists, selectedArtist), Boolean(zip)),
      );
      setArtistShows(result.shows);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setArtistShows(null);
      setArtistError("There was a problem reaching Ticketmaster.");
    } finally {
      if (artistRequestRef.current === controller) {
        artistRequestRef.current = null;
        setArtistPending(false);
      }
    }
  }

  async function handleArtistSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runArtistSearch(postalCode);
  }

  function handleSearchWithoutZip() {
    setPostalCode("");
    void runArtistSearch("");
  }

  async function handleVenueSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (venuePending) {
      return;
    }

    venueRequestRef.current?.abort();
    const controller = new AbortController();
    venueRequestRef.current = controller;
    setVenuePending(true);
    setVenueError(null);

    try {
      const { nextVenues } = await refreshFollows();
      const chosen = pickFollowed(nextVenues, selectedVenue);
      if (chosen.length === 0) {
        setSelectedVenue(ALL);
        setVenueShows(null);
        return;
      }

      const result = await fetchUpcomingShows(
        {
          attractions: [],
          venues: toRefs(chosen),
        },
        controller.signal,
      );

      if (!result.ok) {
        setVenueShows(null);
        setVenueError(result.error);
        return;
      }

      setVenueShows(result.shows);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setVenueShows(null);
      setVenueError("There was a problem reaching Ticketmaster.");
    } finally {
      if (venueRequestRef.current === controller) {
        venueRequestRef.current = null;
        setVenuePending(false);
      }
    }
  }

  return (
    <div id="shows-for-you" className="flex flex-col gap-12 sm:gap-16">
      <section id="upcoming-artist-shows" className="scroll-mt-24">
        <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
          Upcoming Shows by Artist
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-mute sm:text-base">
          Where are artists I follow playing? Choose an artist you follow. You
          can optionally add a ZIP/postal code to narrow the Ticketmaster
          results. This app does not sell tickets.
        </p>

        {!followsReady ? (
          <p className="mt-5 text-sm text-mute">Loading shows...</p>
        ) : artists.length === 0 ? (
          <p className="mt-5 max-w-xl text-sm leading-6 text-mute">
            You aren&apos;t following any artists yet.{" "}
            <a
              href="#follow-artist-keyword"
              className="font-semibold text-foreground underline decoration-line underline-offset-4"
            >
              Search and follow an artist
            </a>
            .
          </p>
        ) : (
          <form
            onSubmit={handleArtistSearch}
            className="mt-5 flex max-w-xl flex-col gap-3"
          >
            <div>
              <label
                htmlFor="upcoming-artist-select"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Artist
              </label>
              <select
                id="upcoming-artist-select"
                value={selectedArtist}
                onChange={(event) => setSelectedArtist(event.target.value)}
                className={fieldClass}
              >
                <option value={ALL}>All Followed Artists</option>
                {artists.map((artist) => (
                  <option key={artist.item_key} value={artist.item_key}>
                    {artist.item_label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="artist-postal-code"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                ZIP / Postal Code (optional)
              </label>
              <input
                id="artist-postal-code"
                type="text"
                autoComplete="postal-code"
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                placeholder="Optional, like 20003"
                maxLength={12}
                className={fieldClass}
              />
              <p className="mt-2 text-sm leading-6 text-mute">
                Add a ZIP to narrow the Ticketmaster search to that postal area.
                Leave it blank to look for upcoming shows more broadly.
              </p>
            </div>
            <button
              type="submit"
              disabled={artistPending}
              className={primaryButtonClass}
            >
              {artistPending ? "Loading shows..." : "Find Artist Shows"}
            </button>
          </form>
        )}

        <TicketmasterShowResults
          pending={artistPending}
          error={artistError}
          shows={artistShows}
          heading={artistResultHeading}
          emptyMessage="No upcoming shows found for this artist."
          emptyHint={
            artistUsedZip
              ? "Try removing the ZIP to search more broadly."
              : undefined
          }
          onSearchWithoutZip={
            artistUsedZip ? handleSearchWithoutZip : undefined
          }
        />
      </section>

      <section id="upcoming-venue-shows" className="scroll-mt-24">
        <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
          Upcoming Shows by Venue
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-mute sm:text-base">
          What&apos;s coming up at venues I follow? Choose a venue you follow to
          see what Ticketmaster has coming up there.
        </p>

        {!followsReady ? (
          <p className="mt-5 text-sm text-mute">Loading shows...</p>
        ) : venues.length === 0 ? (
          <p className="mt-5 max-w-xl text-sm leading-6 text-mute">
            You aren&apos;t following any venues yet.{" "}
            <a
              href="#follow-venue-keyword"
              className="font-semibold text-foreground underline decoration-line underline-offset-4"
            >
              Search and follow a venue
            </a>
            .
          </p>
        ) : (
          <form
            onSubmit={handleVenueSearch}
            className="mt-5 flex max-w-xl flex-col gap-3"
          >
            <div>
              <label
                htmlFor="upcoming-venue-select"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Venue
              </label>
              <select
                id="upcoming-venue-select"
                value={selectedVenue}
                onChange={(event) => setSelectedVenue(event.target.value)}
                className={fieldClass}
              >
                <option value={ALL}>All Followed Venues</option>
                {venues.map((venue) => (
                  <option key={venue.item_key} value={venue.item_key}>
                    {venue.item_label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={venuePending}
              className={primaryButtonClass}
            >
              {venuePending ? "Loading shows..." : "Find Venue Shows"}
            </button>
          </form>
        )}

        <TicketmasterShowResults
          pending={venuePending}
          error={venueError}
          shows={venueShows}
          emptyMessage="No upcoming shows found at this venue."
        />
      </section>
    </div>
  );
}
