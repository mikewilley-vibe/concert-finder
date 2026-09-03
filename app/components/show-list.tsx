"use client";

import { useEffect, useRef, useState } from "react";
import { AddConcertForm } from "./add-concert-form";
import { loadConcerts } from "../../lib/concerts";
import type { ListingItem } from "../../lib/listing-item";
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
    return "Couldn't save that. Try again.";
  }

  if (
    code === "anonymous_provider_disabled" ||
    /anonymous sign-ins are disabled/i.test(message)
  ) {
    return "Couldn't start a session. Try refreshing the page.";
  }

  return "Could not load saved concerts. Try refreshing the page.";
}

function concertsMessage(error: unknown) {
  if (
    error instanceof Error &&
    error.message.includes("NEXT_PUBLIC_SUPABASE")
  ) {
    return "Couldn't start a session. Try refreshing the page.";
  }

  return "Could not load concerts right now. Try refreshing the page.";
}

export function ShowList() {
  const [query, setQuery] = useState("");
  const [concerts, setConcerts] = useState<ListingItem[]>([]);
  const [concertsReady, setConcertsReady] = useState(false);
  const [concertsError, setConcertsError] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? concerts.filter((item) => {
        const band = item.title.toLowerCase();
        const venue = item.place.toLowerCase();
        return band.includes(needle) || venue.includes(needle);
      })
    : concerts;

  const trimmedQuery = query.trim();
  const resultLabel = !concertsReady
    ? "Loading concerts\u2026"
    : needle
      ? `${matches.length} matching ${matches.length === 1 ? "show" : "shows"} for \u201c${trimmedQuery}\u201d`
      : `${concerts.length} upcoming ${concerts.length === 1 ? "concert" : "concerts"}`;

  useEffect(() => {
    let cancelled = false;

    async function loadListings() {
      try {
        const supabase = getSupabaseBrowserClient();

        try {
          await ensureAnonymousUser(supabase);
        } catch {
          // Published concerts can still load without a session.
        }

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

  async function toggleFavorite(item: ListingItem) {
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
    <div className="mt-6">
      <p className="mb-5 text-sm text-mute">{resultLabel}</p>

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
        <p className="mb-5 rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-foreground" role="alert">
          {concertsError}
        </p>
      ) : null}

      {favoritesError ? (
        <p className="mb-5 rounded-2xl border border-line bg-panel px-4 py-3 text-sm leading-6 text-foreground" role="alert">
          {favoritesError}
        </p>
      ) : null}

      {!concertsReady ? (
        <p className="rounded-2xl border border-line bg-panel px-4 py-6 text-sm leading-6 text-mute sm:text-base">
          Loading concerts\u2026
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
            ? `No shows match \u201c${trimmedQuery}\u201d. Try another band or venue name.`
            : "No concerts are listed yet."}
        </p>
      )}

      <AddConcertForm
        onSubmitted={async () => {
          const supabase = getSupabaseBrowserClient();
          const rows = await loadConcerts(supabase);
          setConcerts(rows);
        }}
      />
    </div>
  );
}
