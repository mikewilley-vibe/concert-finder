"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  FOLLOWS_CHANGED_EVENT,
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

function ArtistFollowRow({
  attraction,
  followed,
  pending,
  ready,
  onToggle,
}: {
  attraction: AttractionResult;
  followed: boolean;
  pending: boolean;
  ready: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-3xl border border-line bg-panel p-3">
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
        aria-pressed={followed}
        aria-label={
          followed
            ? `Unfollow ${attraction.name}`
            : `Follow ${attraction.name}`
        }
        onClick={onToggle}
        className={secondaryButtonClass}
      >
        {followed ? "Following" : "Follow"}
      </button>
    </li>
  );
}

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
    return "Couldn't save that. Try again.";
  }

  if (
    code === "anonymous_provider_disabled" ||
    /anonymous sign-ins are disabled/i.test(message)
  ) {
    return "Couldn't start a session. Try refreshing the page.";
  }

  return "Could not update who you follow. Try again.";
}

function venuePlace(venue: VenueResult) {
  return [venue.city, venue.state].filter(Boolean).join(", ");
}

function useSavedFollows() {
  const [bands, setBands] = useState<FollowedItem[]>([]);
  const [venues, setVenues] = useState<FollowedItem[]>([]);
  const [ready, setReady] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const [followError, setFollowError] = useState<string | null>(null);
  const pendingKeysRef = useRef<Set<string>>(new Set());

  function markPending(key: string, on: boolean) {
    if (on) {
      pendingKeysRef.current.add(key);
    } else {
      pendingKeysRef.current.delete(key);
    }
    setPendingKeys(new Set(pendingKeysRef.current));
  }

  async function refreshLists() {
    const supabase = getSupabaseBrowserClient();
    await ensureAnonymousUser(supabase);
    const [nextBands, nextVenues] = await Promise.all([
      loadFollowedItems(supabase, FOLLOWED_ATTRACTION_TYPE),
      loadFollowedItems(supabase, FOLLOWED_VENUE_TYPE),
    ]);
    setBands(nextBands);
    setVenues(nextVenues);
    setFollowError(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        await refreshLists();
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

    function onFollowsChanged() {
      void refreshLists().catch((error) => {
        if (!cancelled) {
          setFollowError(followsMessage(error));
        }
      });
    }

    void boot();
    window.addEventListener(FOLLOWS_CHANGED_EVENT, onFollowsChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(FOLLOWS_CHANGED_EVENT, onFollowsChanged);
    };
  }, []);

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

    const applyList =
      itemType === FOLLOWED_ATTRACTION_TYPE ? setBands : setVenues;
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

  return {
    bands,
    venues,
    ready,
    pendingKeys,
    followError,
    toggleFollow,
  };
}

function FollowManageDisclosure({
  id,
  title,
  emptyMessage,
  items,
  itemType,
  pendingKeys,
  onRemove,
}: {
  id: string;
  title: string;
  emptyMessage: string;
  items: FollowedItem[];
  itemType: FollowedItemType;
  pendingKeys: Set<string>;
  onRemove: (item: FollowedItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `${id}-panel`;
  const countLabel =
    items.length === 1
      ? `1 ${itemType === FOLLOWED_ATTRACTION_TYPE ? "artist" : "venue"} followed`
      : `${items.length} ${itemType === FOLLOWED_ATTRACTION_TYPE ? "artists" : "venues"} followed`;

  if (items.length === 0) {
    return (
      <div id={id} className="min-w-0">
        <p className="text-sm text-mute">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div id={id} className="min-w-0 rounded-3xl border border-line bg-panel p-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={title}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 text-left font-display text-xl tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <span>{title}</span>
        <span aria-hidden="true" className="text-sm font-sans font-medium text-mute">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      <div id={panelId} hidden={!open}>
        <p className="mt-2 text-sm text-mute">{countLabel}</p>
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.item_key}
              className="flex items-center justify-between gap-3 rounded-full border border-line bg-background px-4 py-2"
            >
              <span className="min-w-0 truncate text-sm">{item.item_label}</span>
              <button
                type="button"
                aria-label={`Unfollow ${item.item_label}`}
                disabled={pendingKeys.has(`${itemType}:${item.item_key}`)}
                onClick={() => onRemove(item)}
                className="inline-flex min-h-11 shrink-0 touch-manipulation items-center px-3 text-sm font-semibold text-mute hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                Unfollow
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function TicketmasterFollows() {
  const [artistKeyword, setArtistKeyword] = useState("");
  const [venueKeyword, setVenueKeyword] = useState("");
  const [artistPending, setArtistPending] = useState(false);
  const [venuePending, setVenuePending] = useState(false);
  const [artistError, setArtistError] = useState<string | null>(null);
  const [venueError, setVenueError] = useState<string | null>(null);
  const [artistResults, setArtistResults] = useState<AttractionResult[] | null>(
    null,
  );
  const [artistSuggestions, setArtistSuggestions] = useState<
    AttractionResult[]
  >([]);
  const [venueResults, setVenueResults] = useState<VenueResult[] | null>(null);
  const artistRequestRef = useRef<AbortController | null>(null);
  const venueRequestRef = useRef<AbortController | null>(null);
  const { bands, venues, ready, pendingKeys, followError, toggleFollow } =
    useSavedFollows();

  async function searchArtists(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextKeyword = artistKeyword.trim();
    if (nextKeyword.length < 2) {
      setArtistResults(null);
      setArtistSuggestions([]);
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
        suggestions?: AttractionResult[];
        error?: string;
      };

      if (!response.ok) {
        setArtistResults(null);
        setArtistSuggestions([]);
        setArtistError(searchMessage(response.status, payload.error ?? ""));
        return;
      }

      setArtistResults(payload.attractions ?? []);
      setArtistSuggestions(payload.suggestions ?? []);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      setArtistResults(null);
      setArtistSuggestions([]);
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

  const followedBandKeys = new Set(bands.map((item) => item.item_key));
  const followedVenueKeys = new Set(venues.map((item) => item.item_key));

  return (
    <section id="follows" className="scroll-mt-24">
      <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
        Follow artists and venues
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-mute sm:text-base">
        Follow is for artists and venues. Save show is for a concert card. This
        app does not sell tickets.
      </p>

      {followError ? (
        <p
          className="mt-5 rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-foreground"
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
            <button
              type="submit"
              disabled={artistPending}
              aria-label={artistPending ? "Searching artists" : "Search artists"}
              className={primaryButtonClass}
            >
              {artistPending ? "Searching…" : "Search artists"}
            </button>
          </form>
          <div aria-live="polite" aria-atomic="true">
            {artistError ? (
              <p className="mt-4 rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-foreground" role="alert">
                {artistError}
              </p>
            ) : null}
            {artistResults &&
            artistResults.length === 0 &&
            artistSuggestions.length === 0 ? (
              <p className="mt-4 text-sm text-mute">
                No matching artists found.
              </p>
            ) : null}
            {artistResults && artistResults.length > 0 ? (
              <p className="sr-only">
                {artistResults.length === 1
                  ? "1 artist found"
                  : `${artistResults.length} artists found`}
              </p>
            ) : null}
            {artistSuggestions.length > 0 ? (
              <p className="sr-only">
                {artistSuggestions.length === 1
                  ? `Did you mean ${artistSuggestions[0].name}?`
                  : "Did you mean one of these artists?"}
              </p>
            ) : null}
          </div>
          {artistResults && artistResults.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-3">
              {artistResults.map((attraction) => (
                <ArtistFollowRow
                  key={attraction.id}
                  attraction={attraction}
                  followed={followedBandKeys.has(attraction.id)}
                  pending={pendingKeys.has(
                    `${FOLLOWED_ATTRACTION_TYPE}:${attraction.id}`,
                  )}
                  ready={ready}
                  onToggle={() =>
                    void toggleFollow(
                      FOLLOWED_ATTRACTION_TYPE,
                      {
                        item_key: attraction.id,
                        item_label: attraction.name,
                      },
                      followedBandKeys.has(attraction.id),
                    )
                  }
                />
              ))}
            </ul>
          ) : null}
          {artistSuggestions.length > 0 ? (
            <div className="mt-4">
              <p className="text-sm font-medium text-foreground">
                {artistSuggestions.length === 1
                  ? `Did you mean ${artistSuggestions[0].name}?`
                  : "Did you mean…"}
              </p>
              <ul className="mt-3 flex flex-col gap-3">
                {artistSuggestions.map((attraction) => (
                  <ArtistFollowRow
                    key={attraction.id}
                    attraction={attraction}
                    followed={followedBandKeys.has(attraction.id)}
                    pending={pendingKeys.has(
                      `${FOLLOWED_ATTRACTION_TYPE}:${attraction.id}`,
                    )}
                    ready={ready}
                    onToggle={() =>
                      void toggleFollow(
                        FOLLOWED_ATTRACTION_TYPE,
                        {
                          item_key: attraction.id,
                          item_label: attraction.name,
                        },
                        followedBandKeys.has(attraction.id),
                      )
                    }
                  />
                ))}
              </ul>
            </div>
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
            <button
              type="submit"
              disabled={venuePending}
              aria-label={venuePending ? "Searching venues" : "Search venues"}
              className={primaryButtonClass}
            >
              {venuePending ? "Searching…" : "Search venues"}
            </button>
          </form>
          <div aria-live="polite" aria-atomic="true">
            {venueError ? (
              <p className="mt-4 rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-foreground" role="alert">
                {venueError}
              </p>
            ) : null}
            {venueResults && venueResults.length === 0 ? (
              <p className="mt-4 text-sm text-mute">
                No Ticketmaster venues matched that search.
              </p>
            ) : null}
            {venueResults && venueResults.length > 0 ? (
              <p className="sr-only">
                {venueResults.length === 1
                  ? "1 venue found"
                  : `${venueResults.length} venues found`}
              </p>
            ) : null}
          </div>
          {venueResults && venueResults.length > 0 ? (
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
                      aria-pressed={followed}
                      aria-label={
                        followed
                          ? `Unfollow ${venue.name}`
                          : `Follow ${venue.name}`
                      }
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
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function FollowedItemsManage() {
  const { bands, venues, pendingKeys, followError, toggleFollow } =
    useSavedFollows();

  return (
    <section
      id="follow-management"
      aria-labelledby="follow-management-heading"
      className="scroll-mt-24"
    >
      <h2 id="follow-management-heading" className="sr-only">
        Manage who you follow
      </h2>
      {followError ? (
        <p
          className="mb-5 rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-foreground"
          role="alert"
        >
          {followError}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
        <FollowManageDisclosure
          id="bands-i-follow"
          title="Manage followed artists"
          emptyMessage="No followed artists yet. Search Ticketmaster and choose one."
          items={bands}
          itemType={FOLLOWED_ATTRACTION_TYPE}
          pendingKeys={pendingKeys}
          onRemove={(item) =>
            void toggleFollow(FOLLOWED_ATTRACTION_TYPE, item, true)
          }
        />
        <FollowManageDisclosure
          id="venues-i-follow"
          title="Manage followed venues"
          emptyMessage="No followed venues yet. Search Ticketmaster and choose one."
          items={venues}
          itemType={FOLLOWED_VENUE_TYPE}
          pendingKeys={pendingKeys}
          onRemove={(item) =>
            void toggleFollow(FOLLOWED_VENUE_TYPE, item, true)
          }
        />
      </div>
    </section>
  );
}
