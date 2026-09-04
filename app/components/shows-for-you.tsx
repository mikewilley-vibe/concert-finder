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
import { FollowedArtistSelect, ALL_FOLLOWED_ARTISTS } from "./followed-artist-select";
import { EVENT_SEARCH_FOLLOW_LIMIT } from "../../shared/api/v1";
import {
  fetchUpcomingShows,
  TicketmasterShowResults,
  type ShowResult,
} from "./ticketmaster-show-results";

const ALL = ALL_FOLLOWED_ARTISTS;

const fieldClass =
  "min-h-12 min-w-0 w-full rounded-full border border-line bg-panel px-4 text-base text-foreground outline-none placeholder:text-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function toRefs(items: FollowedItem[]) {
  return items.slice(0, EVENT_SEARCH_FOLLOW_LIMIT).map((item) => ({
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

function venueHeadingLabel(items: FollowedItem[], selected: string) {
  if (selected === ALL) {
    return "the venues you follow";
  }
  return (
    items.find((item) => item.item_key === selected)?.item_label ||
    "this venue"
  );
}

function upcomingVenueHeading(name: string) {
  return `Upcoming shows at ${name}`;
}

const columnButtonClass =
  "inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-background transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70";

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
  const [venueResultHeading, setVenueResultHeading] = useState("");
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

  const currentArtistSelection =
    selectedArtist === ALL ||
    artists.some((artist) => artist.item_key === selectedArtist)
      ? selectedArtist
      : ALL;
  const currentVenueSelection =
    selectedVenue === ALL ||
    venues.some((venue) => venue.item_key === selectedVenue)
      ? selectedVenue
      : ALL;

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
      const selection =
        selectedArtist === ALL ||
        nextArtists.some((artist) => artist.item_key === selectedArtist)
          ? selectedArtist
          : ALL;
      const chosen = pickFollowed(nextArtists, selection);
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
          ...(zip ? { location: { postalCode: zip } } : {}),
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
        upcomingArtistHeading(
          artistHeadingLabel(nextArtists, selection),
          Boolean(zip),
        ),
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
      const selection =
        selectedVenue === ALL ||
        nextVenues.some((venue) => venue.item_key === selectedVenue)
          ? selectedVenue
          : ALL;
      const chosen = pickFollowed(nextVenues, selection);
      if (chosen.length === 0) {
        setSelectedVenue(ALL);
        setVenueShows(null);
        setVenueResultHeading("");
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

      setVenueResultHeading(
        upcomingVenueHeading(venueHeadingLabel(nextVenues, selection)),
      );
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
    <div
      id="shows-for-you"
      className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-8"
    >
      <section id="upcoming-artist-shows" className="min-w-0 scroll-mt-24">
        <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
          Upcoming Shows by Artist
        </h2>
        <p className="mt-2 text-sm leading-6 text-mute sm:text-base">
          See where followed artists are playing. Add a ZIP to narrow it.
        </p>

        {!followsReady ? (
          <p className="mt-5 text-sm text-mute" aria-live="polite">
            Loading who you follow…
          </p>
        ) : artists.length === 0 ? (
          <p className="mt-5 text-sm leading-6 text-mute">
            You aren&apos;t following any artists yet.{" "}
            <a
              href="#follow-artist-keyword"
              className="rounded-sm font-semibold text-foreground underline decoration-line underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              Search and follow an artist
            </a>
            .
          </p>
        ) : (
          <form
            onSubmit={handleArtistSearch}
            className="mt-5 flex w-full flex-col gap-3"
          >
            <FollowedArtistSelect
              artists={artists}
              value={currentArtistSelection}
              onChange={setSelectedArtist}
            />
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
              className={columnButtonClass}
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
          compact
        />
      </section>

      <section id="upcoming-venue-shows" className="min-w-0 scroll-mt-24">
        <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
          Upcoming Shows by Venue
        </h2>
        <p className="mt-2 text-sm leading-6 text-mute sm:text-base">
          See what&apos;s coming at venues you follow.
        </p>

        {!followsReady ? (
          <p className="mt-5 text-sm text-mute" aria-live="polite">
            Loading who you follow…
          </p>
        ) : venues.length === 0 ? (
          <p className="mt-5 text-sm leading-6 text-mute">
            You aren&apos;t following any venues yet.{" "}
            <a
              href="#follow-venue-keyword"
              className="rounded-sm font-semibold text-foreground underline decoration-line underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              Search and follow a venue
            </a>
            .
          </p>
        ) : (
          <form
            onSubmit={handleVenueSearch}
            className="mt-5 flex w-full flex-col gap-3"
          >
            <div>
              <label
                htmlFor="upcoming-venue-select"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Followed venues
              </label>
              <select
                id="upcoming-venue-select"
                value={currentVenueSelection}
                onChange={(event) => setSelectedVenue(event.target.value)}
                className={fieldClass}
              >
                <option value={ALL}>All followed venues</option>
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
              className={columnButtonClass}
            >
              {venuePending ? "Loading shows..." : "Find Venue Shows"}
            </button>
          </form>
        )}

        <TicketmasterShowResults
          pending={venuePending}
          error={venueError}
          shows={venueShows}
          heading={venueResultHeading}
          emptyMessage="No upcoming shows found at this venue."
          compact
        />
      </section>
    </div>
  );
}
