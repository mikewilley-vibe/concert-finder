import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { followsMessage } from "@/lib/account";
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

export function useFollows() {
  const { user, ready: authReady, configured } = useAuth();
  const [artists, setArtists] = useState<FollowedItem[]>([]);
  const [venues, setVenues] = useState<FollowedItem[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const pendingKeysRef = useRef<Set<string>>(new Set());

  const markPending = useCallback((key: string, on: boolean) => {
    if (on) {
      pendingKeysRef.current.add(key);
    } else {
      pendingKeysRef.current.delete(key);
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

  async function toggleFollow(
    itemType: FollowedItemType,
    item: FollowedItem,
    currentlyFollowed: boolean,
  ) {
    const pendingId = `${itemType}:${item.item_key}`;
    if (pendingKeysRef.current.has(pendingId)) {
      return;
    }

    if (!configured) {
      setError(
        "Following is not connected. Check the Supabase values in mobile/.env and restart Expo.",
      );
      return;
    }

    if (
      !currentlyFollowed &&
      artists.length + venues.length >= MAX_MONITORED_FOLLOWS
    ) {
      setError(
        `Automatic tracking currently supports up to ${MAX_MONITORED_FOLLOWS} artists and venues combined. Unfollow one before adding another.`,
      );
      return;
    }

    if (!user?.id) {
      setError(
        "Your guest account is still connecting. Wait a moment and tap Follow again.",
      );
      return;
    }

    markPending(pendingId, true);
    setError(null);

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
      setError(followsMessage(toggleError));
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
    return pendingKeys.has(`${itemType}:${itemKey}`);
  }

  return {
    artists,
    venues,
    ready,
    error,
    configured,
    toggleFollow,
    isFollowed,
    isPending,
    refresh,
    followCount: artists.length + venues.length,
  };
}
