"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  followItem,
  loadFollowedItems,
  notifyFollowsChanged,
  unfollowItem,
  type FollowedItem,
  type FollowedItemType,
} from "../../lib/saved-follows";
import { ensureAnonymousUser } from "../../lib/saved-concerts";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser-client";

type AttractionResult = {
  id: string;
  name: string;
  image?: string;
};

type VenueResult = {
  id: string;
  name: string;
  city?: string;
  state?: string;
};

const fieldClass =
  "min-h-12 w-full rounded-full border border-line bg-panel px-4 text-base text-foreground outline-none placeholder:text-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const primaryButtonClass =
  "inline-flex min-h-12 w-full shrink-0 touch-manipulation items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-background transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto";

const secondaryButtonClass =
  "inline-flex min-h-10 shrink-0 touch-manipulation items-center justify-center rounded-full border border-line px-4 text-sm font-semibold text-foreground transition-colors hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70";

function searchMessage(status: number, fallback: string) {
  if (status === 400) {
    return fallback || "Enter at least 2 characters to search.";
  }
  if (status === 429) {
    return "Too many Ticketmaster searches. Wait a moment and try again.";
  }
  if (status === 500) {
    return "Search is not configured on the server yet.";
  }
  return fallback || "Could not search Ticketmaster right now. Try again.";
}

function followsMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";

  if (message.includes("NEXT_PUBLIC_SUPABASE")) {
    return "Following needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.";
  }

  if (
    code === "anonymous_provider_disabled" ||
    /anonymous sign-ins are disabled/i.test(message)
  ) {
    return "Anonymous sign-in is turned off in Supabase. Enable it under Authentication → Providers → Anonymous, then refresh this page.";
  }

  return "Could not update who you follow. Try again.";
}

function venuePlace(venue: VenueResult) {
  return [venue.city, venue.state].filter(Boolean).join(", ");
}

export function TicketmasterFollows() {
  const [artistKeyword, setArtistKeyword] = useState("");
  const [venueKeyword, setVenueKeyword] = useState("");
  const [artistPending, setArtistPending] = useState(false);
  const [venuePending, setVenuePending] = useState(false);
  const [artistError, setArtistError] = useState<string | null>(null);
  const [venueError, setVenueError] = useState<string | null>(null);
  const [followError, setFollowError] = useState<string | null>(null);
  const [artistResults, setArtistResults] = useState<AttractionResult[] | null>(
    null,
  );
  const [venueResults, setVenueResults] = useState<VenueResult[] | null>(null);
  const [bands, setBands] = useState<FollowedItem[]>([]);
  const [venues, setVenues] = useState<FollowedItem[]>([]);
  const [ready, setReady] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const artistRequestRef = useRef<AbortController | null>(null);
  const venueRequestRef = useRef<AbortController | null>(null);
  const pendingKeysRef = useRef<Set<string>>(new Set());

  function markPending(key: string, on: boolean) {
    if (on) {
      pendingKeysRef.current.add(key);
    } else {
      pendingKeysRef.current.delete(key);
    }
    setPendingKeys(new Set(pendingKeysRef.current));
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const supabase = getSupabaseBrowserClient();
        await ensureAnonymousUser(supabase);
        const [nextBands, nextVenues] = await Promise.all([
          loadFollowedItems(supabase, FOLLOWED_ATTRACTION_TYPE),
          loadFollowedItems(supabase, FOLLOWED_VENUE_TYPE),
        ]);
        if (!cancelled) {
          setBands(nextBands);
          setVenues(nextVenues);
          setFollowError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setFollowError(followsMessage(error));
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  async function searchArtists(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextKeyword = artistKeyword.trim();
    if (nextKeyword.length < 2) {
      setArtistResults(null);
      setArtistError("Enter at least 2 characters to search.");
      return;
    }

    artistRequestRef.current?.abort();
    const controller = new AbortController();
    artistRequestRef.current = controller;
    setArtistPending(true);
    setArtistError(null);

    try {
      const response = await fetch(
        `/api/ticketmaster/attractions?keyword=${encodeURIComponent(nextKeyword)}`,
        { signal: controller.signal },
      );
      const payload = (await response.json()) as {
        attractions?: AttractionResult[];
        error?: string;
      };

      if (!response.ok) {
        setArtistResults(null);
        setArtistError(searchMessage(response.status, payload.error ?? ""));
        return;
      }

      setArtistResults(payload.attractions ?? []);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setArtistResults(null);
      setArtistError("Could not search Ticketmaster right now. Try again.");
    } finally {
      if (artistRequestRef.current === controller) {
        artistRequestRef.current = null;
        setArtistPending(false);
      }
    }
  }

  async function searchVenues(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextKeyword = venueKeyword.trim();
    if (nextKeyword.length < 2) {
      setVenueResults(null);
      setVenueError("Enter at least 2 characters to search.");
      return;
    }

    venueRequestRef.current?.abort();
    const controller = new AbortController();
    venueRequestRef.current = controller;
    setVenuePending(true);
    setVenueError(null);

    try {
      const response = await fetch(
        `/api/ticketmaster/venues?keyword=${encodeURIComponent(nextKeyword)}`,
        { signal: controller.signal },
      );
      const payload = (await response.json()) as {
        venues?: VenueResult[];
        error?: string;
      };

      if (!response.ok) {
        setVenueResults(null);
        setVenueError(searchMessage(response.status, payload.error ?? ""));
        return;
      }

      setVenueResults(payload.venues ?? []);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setVenueResults(null);
      setVenueError("Could not search Ticketmaster right now. Try again.");
    } finally {
      if (venueRequestRef.current === controller) {
        venueRequestRef.current = null;
        setVenuePending(false);
      }
    }
  }

  async function toggleFollow(
    itemType: FollowedItemType,
    item: FollowedItem,
    currentlyFollowed: boolean,
  ) {
    const pendingId = `${itemType}:${item.item_key}`;
    if (!ready || pendingKeysRef.current.has(pendingId)) {
      return;
    }

    markPending(pendingId, true);
    setFollowError(null);

    const applyList = itemType === FOLLOWED_ATTRACTION_TYPE ? setBands : setVenues;
    applyList((current) => {
      if (currentlyFollowed) {
        return current.filter((row) => row.item_key !== item.item_key);
      }
      if (current.some((row) => row.item_key === item.item_key)) {
        return current;
      }
      return [...current, item].sort((a, b) =>
        a.item_label.localeCompare(b.item_label),
      );
    });

    try {
      const supabase = getSupabaseBrowserClient();
      const user = await ensureAnonymousUser(supabase);
      if (currentlyFollowed) {
        await unfollowItem(supabase, user.id, itemType, item.item_key);
      } else {
        await followItem(supabase, user.id, itemType, item);
      }
      notifyFollowsChanged();
    } catch (error) {
      applyList((current) => {
        if (currentlyFollowed) {
          if (current.some((row) => row.item_key === item.item_key)) {
            return current;
          }
          return [...current, item].sort((a, b) =>
            a.item_label.localeCompare(b.item_label),
          );
        }
        return current.filter((row) => row.item_key !== item.item_key);
      });
      setFollowError(followsMessage(error));
    } finally {
      markPending(pendingId, false);
    }
  }

  const followedBandKeys = new Set(bands.map((item) => item.item_key));
  const followedVenueKeys = new Set(venues.map((item) => item.item_key));

  return (
    <section id="follows" className="scroll-mt-24">
      <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
        Follow artists and venues
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-mute sm:text-base">
        Search Ticketmaster, pick the right match, and follow it. This is
        separate from Favorite on a concert card.
      </p>

      {followError ? (
        <p
          className="mt-5 rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-mute"
          role="alert"
        >
          {followError}
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <h3 className="font-display text-xl tracking-tight">Find an artist</h3>
          <form
            onSubmit={searchArtists}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <label className="sr-only" htmlFor="follow-artist-keyword">
              Artist name
            </label>
            <input
              id="follow-artist-keyword"
              type="search"
              value={artistKeyword}
              onChange={(event) => setArtistKeyword(event.target.value)}
              placeholder="Search an artist, like Wilco"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={80}
              className={fieldClass}
            />
            <button type="submit" disabled={artistPending} className={primaryButtonClass}>
              {artistPending ? "Searching…" : "Search"}
            </button>
          </form>
          {artistError ? (
            <p className="mt-4 text-sm leading-6 text-mute" role="alert">
              {artistError}
            </p>
          ) : null}
          {artistResults ? (
            artistResults.length === 0 ? (
              <p className="mt-4 text-sm text-mute">
                No Ticketmaster artists matched that search.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {artistResults.map((attraction) => {
                  const followed = followedBandKeys.has(attraction.id);
                  const pending = pendingKeys.has(
                    `${FOLLOWED_ATTRACTION_TYPE}:${attraction.id}`,
                  );
                  return (
                    <li
                      key={attraction.id}
                      className="flex items-center gap-3 rounded-3xl border border-line bg-panel p-3"
                    >
                      {attraction.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={attraction.image}
                          alt=""
                          width={48}
                          height={48}
                          className="h-12 w-12 shrink-0 rounded-2xl object-cover"
                        />
                      ) : (
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/15 text-xs font-semibold text-accent">
                          TM
                        </span>
                      )}
                      <p className="min-w-0 flex-1 font-display text-base tracking-tight">
                        {attraction.name}
                      </p>
                      <button
                        type="button"
                        disabled={!ready || pending}
                        onClick={() =>
                          void toggleFollow(
                            FOLLOWED_ATTRACTION_TYPE,
                            {
                              item_key: attraction.id,
                              item_label: attraction.name,
                            },
                            followed,
                          )
                        }
                        className={secondaryButtonClass}
                      >
                        {followed ? "Following" : "Follow"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </div>

        <div>
          <h3 className="font-display text-xl tracking-tight">Find a venue</h3>
          <form
            onSubmit={searchVenues}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <label className="sr-only" htmlFor="follow-venue-keyword">
              Venue name
            </label>
            <input
              id="follow-venue-keyword"
              type="search"
              value={venueKeyword}
              onChange={(event) => setVenueKeyword(event.target.value)}
              placeholder="Search a venue, like The Anthem"
              autoComplete="off"
              enterKeyHint="search"
              maxLength={80}
              className={fieldClass}
            />
            <button type="submit" disabled={venuePending} className={primaryButtonClass}>
              {venuePending ? "Searching…" : "Search"}
            </button>
          </form>
          {venueError ? (
            <p className="mt-4 text-sm leading-6 text-mute" role="alert">
              {venueError}
            </p>
          ) : null}
          {venueResults ? (
            venueResults.length === 0 ? (
              <p className="mt-4 text-sm text-mute">
                No Ticketmaster venues matched that search.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {venueResults.map((venue) => {
                  const followed = followedVenueKeys.has(venue.id);
                  const pending = pendingKeys.has(
                    `${FOLLOWED_VENUE_TYPE}:${venue.id}`,
                  );
                  const place = venuePlace(venue);
                  return (
                    <li
                      key={venue.id}
                      className="flex items-center gap-3 rounded-3xl border border-line bg-panel p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-base tracking-tight">
                          {venue.name}
                        </p>
                        {place ? (
                          <p className="mt-0.5 text-sm text-mute">{place}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={!ready || pending}
                        onClick={() =>
                          void toggleFollow(
                            FOLLOWED_VENUE_TYPE,
                            {
                              item_key: venue.id,
                              item_label: venue.name,
                            },
                            followed,
                          )
                        }
                        className={secondaryButtonClass}
                      >
                        {followed ? "Following" : "Follow"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div id="bands-i-follow">
          <h3 className="font-display text-xl tracking-tight">Bands I follow</h3>
          {bands.length === 0 ? (
            <p className="mt-3 text-sm text-mute">
              No followed artists yet. Search Ticketmaster and choose one.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {bands.map((band) => (
                <li
                  key={band.item_key}
                  className="flex items-center justify-between gap-3 rounded-full border border-line bg-panel px-4 py-2"
                >
                  <span className="min-w-0 truncate text-sm">{band.item_label}</span>
                  <button
                    type="button"
                    disabled={pendingKeys.has(
                      `${FOLLOWED_ATTRACTION_TYPE}:${band.item_key}`,
                    )}
                    onClick={() =>
                      void toggleFollow(FOLLOWED_ATTRACTION_TYPE, band, true)
                    }
                    className="text-sm font-semibold text-mute hover:text-foreground"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div id="venues-i-follow">
          <h3 className="font-display text-xl tracking-tight">Venues I follow</h3>
          {venues.length === 0 ? (
            <p className="mt-3 text-sm text-mute">
              No followed venues yet. Search Ticketmaster and choose one.
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {venues.map((venue) => (
                <li
                  key={venue.item_key}
                  className="flex items-center justify-between gap-3 rounded-full border border-line bg-panel px-4 py-2"
                >
                  <span className="min-w-0 truncate text-sm">
                    {venue.item_label}
                  </span>
                  <button
                    type="button"
                    disabled={pendingKeys.has(
                      `${FOLLOWED_VENUE_TYPE}:${venue.item_key}`,
                    )}
                    onClick={() =>
                      void toggleFollow(FOLLOWED_VENUE_TYPE, venue, true)
                    }
                    className="text-sm font-semibold text-mute hover:text-foreground"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
