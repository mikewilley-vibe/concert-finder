"use client";

import { useEffect, useRef, useState } from "react";
import { sampleItems, type SampleItem } from "../../data/sample-items";
import { loadConcerts } from "../../lib/concerts";
import {
  concertItemKey,
  ensureAnonymousUser,
  loadSavedConcertKeys,
  saveConcert,
  unsaveConcert,
} from "../../lib/saved-concerts";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser-client";
import { ShowCard } from "./show-card";

function favoritesMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";

  if (message.includes("NEXT_PUBLIC_SUPABASE")) {
    return "Favorites need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.";
  }

  if (
    code === "anonymous_provider_disabled" ||
    /anonymous sign-ins are disabled/i.test(message)
  ) {
    return "Anonymous sign-in is turned off in Supabase. Enable it under Authentication → Providers → Anonymous, then refresh this page.";
  }

  return "Could not load saved concerts. Try refreshing the page.";
}

function concertsMessage(error: unknown) {
  if (
    error instanceof Error &&
    error.message.includes("NEXT_PUBLIC_SUPABASE")
  ) {
    return "Concerts need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.";
  }

  return "Could not load concerts right now. Try refreshing the page.";
}

export function ShowList() {
  const [query, setQuery] = useState("");
  const [concerts, setConcerts] = useState<SampleItem[]>([]);
  const [concertsReady, setConcertsReady] = useState(false);
  const [concertsError, setConcertsError] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const listings = [...concerts, ...sampleItems];
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? listings.filter((item) => {
        const band = item.title.toLowerCase();
        const venue = item.place.toLowerCase();
        return band.includes(needle) || venue.includes(needle);
      })
    : listings;

  const trimmedQuery = query.trim();
  const resultLabel = !concertsReady
    ? "Loading concerts…"
    : needle
      ? `${matches.length} matching ${matches.length === 1 ? "show" : "shows"} for “${trimmedQuery}”`
      : `${concerts.length} upcoming ${concerts.length === 1 ? "concert" : "concerts"}`;

  useEffect(() => {
    let cancelled = false;

    async function loadListings() {
      try {
        const supabase = getSupabaseBrowserClient();
        const rows = await loadConcerts(supabase);

        if (!cancelled) {
          setConcerts(rows);
          setConcertsError(null);
          setConcertsReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setConcerts([]);
          setConcertsError(concertsMessage(error));
          setConcertsReady(true);
        }
      }
    }

    async function loadFavorites() {
      try {
        const supabase = getSupabaseBrowserClient();
        await ensureAnonymousUser(supabase);
        const keys = await loadSavedConcertKeys(supabase);

        if (!cancelled) {
          setSavedKeys(keys);
          setFavoritesError(null);
          setFavoritesReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setFavoritesError(favoritesMessage(error));
          setFavoritesReady(false);
        }
      }
    }

    void loadListings();
    void loadFavorites();

    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleFavorite(item: SampleItem) {
    const key = concertItemKey(item);

    if (
      item.kind !== "concert" ||
      !favoritesReady ||
      pendingKeysRef.current.has(key)
    ) {
      return;
    }

    const currentlySaved = savedKeys.has(key);
    pendingKeysRef.current.add(key);
    setPendingKeys(new Set(pendingKeysRef.current));
    setFavoritesError(null);
    setSavedKeys((current) => {
      const next = new Set(current);
      if (currentlySaved) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    try {
      const supabase = getSupabaseBrowserClient();
      const user = await ensureAnonymousUser(supabase);

      if (currentlySaved) {
        await unsaveConcert(supabase, user.id, item);
      } else {
        await saveConcert(supabase, user.id, item);
      }
    } catch {
      setSavedKeys((current) => {
        const next = new Set(current);
        if (currentlySaved) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
      setFavoritesError(
        currentlySaved
          ? "Could not remove this concert. Try again."
          : "Could not save this concert. Try again.",
      );
    } finally {
      pendingKeysRef.current.delete(key);
      setPendingKeys(new Set(pendingKeysRef.current));
    }
  }

  return (
    <section id="whats-coming" className="scroll-mt-24">
      <div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
            A peek at your music week
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-mute sm:text-base">
            Upcoming concerts from the database, plus an album drop, a past
            night out, and a venue nearby.
          </p>
        </div>
        <p className="text-sm text-mute">{resultLabel}</p>
      </div>

      <label
        htmlFor="search-concerts"
        className="mb-2 block text-sm font-medium text-foreground"
      >
        Search concerts
      </label>
      <input
        id="search-concerts"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Type a band or venue, like The Anthem"
        autoComplete="off"
        className="mb-5 min-h-12 w-full rounded-full border border-line bg-panel px-4 text-base text-foreground outline-none placeholder:text-mute/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />

      {concertsError ? (
        <p className="mb-5 rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-mute" role="alert">
          {concertsError}
        </p>
      ) : null}

      {favoritesError ? (
        <p className="mb-5 rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-mute" role="alert">
          {favoritesError}
        </p>
      ) : null}

      {!concertsReady ? (
        <p className="rounded-2xl border border-line bg-panel px-4 py-6 text-sm leading-6 text-mute sm:text-base">
          Loading concerts…
        </p>
      ) : matches.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {matches.map((item) => {
            const key = concertItemKey(item);
            return (
              <ShowCard
                key={item.id}
                item={item}
                saved={savedKeys.has(key)}
                favoriteBusy={pendingKeys.has(key)}
                favoritesReady={favoritesReady}
                favoritesUnavailable={Boolean(favoritesError)}
                onToggleFavorite={
                  item.kind === "concert"
                    ? () => {
                        void toggleFavorite(item);
                      }
                    : undefined
                }
              />
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-line bg-panel px-4 py-6 text-sm leading-6 text-mute sm:text-base">
          {trimmedQuery
            ? `No shows match “${trimmedQuery}”. Try another band or venue name.`
            : "No concerts are listed yet."}
        </p>
      )}
    </section>
  );
}
