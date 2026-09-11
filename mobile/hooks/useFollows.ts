import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { followsMessage } from "@/lib/account";
import {
  followPendingKey,
  type ToggleFollowResult,
} from "@/lib/follow-result";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  MAX_MONITORED_FOLLOWS,
  followItem,
  loadFollowedItems,
  unfollowItem,
  type FollowedItem,
  type FollowedItemType,
} from "@/lib/follows";
import { getSupabaseClient } from "@/lib/supabase";
import { subscribeUserLibrary } from "@/lib/sync";

const PENDING_TIMEOUT_MS = 20_000;

export function useFollows() {
  const {
    user,
    ready: authReady,
    configured,
    error: authError,
  } = useAuth();
  const [artists, setArtists] = useState<FollowedItem[]>([]);
  const [venues, setVenues] = useState<FollowedItem[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set());
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const pendingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const markPending = useCallback((key: string, on: boolean) => {
    if (on) {
      pendingKeysRef.current.add(key);
      const existing = pendingTimersRef.current.get(key);
      if (existing) {
        clearTimeout(existing);
      }
      pendingTimersRef.current.set(
        key,
        setTimeout(() => {
          pendingKeysRef.current.delete(key);
          pendingTimersRef.current.delete(key);
          setPendingKeys(new Set(pendingKeysRef.current));
        }, PENDING_TIMEOUT_MS),
      );
    } else {
      pendingKeysRef.current.delete(key);
      const existing = pendingTimersRef.current.get(key);
      if (existing) {
        clearTimeout(existing);
        pendingTimersRef.current.delete(key);
      }
    }
    setPendingKeys(new Set(pendingKeysRef.current));
  }, []);

  const refresh = useCallback(async () => {
    if (!configured) {
      setArtists([]);
      setVenues([]);
      setReady(true);
      return;
    }

    const supabase = getSupabaseClient();
    const [nextArtists, nextVenues] = await Promise.all([
      loadFollowedItems(supabase, FOLLOWED_ATTRACTION_TYPE),
      loadFollowedItems(supabase, FOLLOWED_VENUE_TYPE),
    ]);
    setArtists(nextArtists);
    setVenues(nextVenues);
    setError(null);
    setReady(true);
  }, [configured]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      void refresh().catch((loadError: unknown) => {
        if (!cancelled) {
          setError(followsMessage(loadError));
          setReady(true);
        }
      });
    }, 0);

    const unsubscribe = subscribeUserLibrary(() => {
      void refresh().catch((loadError: unknown) => {
        if (!cancelled) {
          setError(followsMessage(loadError));
        }
      });
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [authReady, refresh, user?.id]);

  useEffect(() => {
    const timers = pendingTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  async function toggleFollow(
    itemType: FollowedItemType,
    item: FollowedItem,
    currentlyFollowed: boolean,
  ): Promise<ToggleFollowResult> {
      const pendingId = followPendingKey(itemType, item.item_key);
      const base = {
        itemKey: item.item_key,
        itemType,
        followed: currentlyFollowed,
      };

      if (pendingKeysRef.current.has(pendingId)) {
        return { ok: false, ...base, code: "pending", message: "" };
      }

      if (!configured) {
        const message =
          "Following is not connected. Check the Supabase values in mobile/.env and restart Expo.";
        setError(message);
        setItemErrors((current) => ({ ...current, [pendingId]: message }));
        return { ok: false, ...base, code: "not_configured", message };
      }

      if (
        !currentlyFollowed &&
        artists.length + venues.length >= MAX_MONITORED_FOLLOWS
      ) {
        const message = `Automatic tracking currently supports up to ${MAX_MONITORED_FOLLOWS} artists and venues combined. Unfollow one before adding another.`;
        setError(message);
        setItemErrors((current) => ({ ...current, [pendingId]: message }));
        return { ok: false, ...base, code: "max_follows", message };
      }

      if (!authReady || !user?.id) {
        const message =
          "Your guest account is still connecting. Wait a moment and tap Follow again.";
        setError(message);
        setItemErrors((current) => ({ ...current, [pendingId]: message }));
        return { ok: false, ...base, code: "not_ready", message };
      }

      markPending(pendingId, true);
      setError(null);
      setItemErrors((current) => {
        const next = { ...current };
        delete next[pendingId];
        return next;
      });

      const applyList =
        itemType === FOLLOWED_ATTRACTION_TYPE ? setArtists : setVenues;
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
        const supabase = getSupabaseClient();
        if (currentlyFollowed) {
          await unfollowItem(supabase, user.id, itemType, item.item_key);
        } else {
          await followItem(supabase, user.id, itemType, item);
        }
        return {
          ok: true,
          followed: !currentlyFollowed,
          itemKey: item.item_key,
          itemType,
        };
      } catch (toggleError) {
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
        const message = followsMessage(toggleError);
        setError(message);
        setItemErrors((current) => ({ ...current, [pendingId]: message }));
        return { ok: false, ...base, code: "error", message };
      } finally {
        markPending(pendingId, false);
      }
    }

  function isFollowed(itemType: FollowedItemType, itemKey: string) {
    const list =
      itemType === FOLLOWED_ATTRACTION_TYPE ? artists : venues;
    return list.some((item) => item.item_key === itemKey);
  }

  function isPending(itemType: FollowedItemType, itemKey: string) {
    return pendingKeys.has(followPendingKey(itemType, itemKey));
  }

  function itemError(itemType: FollowedItemType, itemKey: string) {
    return itemErrors[followPendingKey(itemType, itemKey)] ?? null;
  }

  return {
    artists,
    venues,
    ready,
    error: error ?? authError,
    itemError,
    configured,
    toggleFollow,
    isFollowed,
    isPending,
    refresh,
    followCount: artists.length + venues.length,
  };
}
