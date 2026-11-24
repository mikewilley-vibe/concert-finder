import { useEffect, useSyncExternalStore } from "react";

import { useAuth } from "@/components/AuthProvider";
import { followsMessage } from "@/lib/account";
import {
  followPendingKey,
  type ToggleFollowResult,
} from "@/lib/follow-result";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  followItem,
  isAtMonitoredFollowLimit,
  loadFollowedItems,
  maxMonitoredFollowsMessage,
  unfollowItem,
  type FollowedItem,
  type FollowedItemType,
} from "@/lib/follows";
import { getSupabaseClient } from "@/lib/supabase";
import { subscribeUserLibrary } from "@/lib/sync";

const PENDING_TIMEOUT_MS = 20_000;

type Snapshot = {
  artists: FollowedItem[];
  venues: FollowedItem[];
  ready: boolean;
  libraryError: string | null;
  itemErrors: Record<string, string>;
  pendingKeys: Set<string>;
};

const INITIAL_SNAPSHOT: Snapshot = {
  artists: [],
  venues: [],
  ready: false,
  libraryError: null,
  itemErrors: {},
  pendingKeys: new Set(),
};

let snapshot: Snapshot = INITIAL_SNAPSHOT;
let loadGeneration = 0;
const listeners = new Set<() => void>();
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

const authSession = {
  userId: null as string | null,
  ready: false,
  configured: false,
};

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function update(recipe: (prev: Snapshot) => Snapshot) {
  snapshot = recipe(snapshot);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return INITIAL_SNAPSHOT;
}

function applyFollowChange(
  list: readonly FollowedItem[],
  item: FollowedItem,
  remove: boolean,
) {
  if (remove) {
    return list.filter((row) => row.item_key !== item.item_key);
  }
  if (list.some((row) => row.item_key === item.item_key)) {
    return [...list];
  }
  return [...list, item].sort((left, right) =>
    left.item_label.localeCompare(right.item_label),
  );
}

function mergePendingList(
  server: readonly FollowedItem[],
  optimistic: readonly FollowedItem[],
  pendingKeys: Set<string>,
  itemType: FollowedItemType,
) {
  const prefix = `${itemType}:`;
  const pendingIds = new Set(
    [...pendingKeys]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length)),
  );
  if (pendingIds.size === 0) {
    return [...server];
  }
  const kept = server.filter((item) => !pendingIds.has(item.item_key));
  for (const item of optimistic) {
    if (pendingIds.has(item.item_key)) {
      kept.push(item);
    }
  }
  return kept.sort((left, right) =>
    left.item_label.localeCompare(right.item_label),
  );
}

function listPatch(
  prev: Snapshot,
  itemType: FollowedItemType,
  item: FollowedItem,
  remove: boolean,
) {
  if (itemType === FOLLOWED_ATTRACTION_TYPE) {
    return {
      ...prev,
      artists: applyFollowChange(prev.artists, item, remove),
    };
  }
  return {
    ...prev,
    venues: applyFollowChange(prev.venues, item, remove),
  };
}

function markPending(key: string, on: boolean) {
  const existing = pendingTimers.get(key);
  if (existing) {
    clearTimeout(existing);
    pendingTimers.delete(key);
  }
  update((prev) => {
    const pendingKeys = new Set(prev.pendingKeys);
    if (on) {
      pendingKeys.add(key);
    } else {
      pendingKeys.delete(key);
    }
    return { ...prev, pendingKeys };
  });
  if (!on) {
    return;
  }
  pendingTimers.set(
    key,
    setTimeout(() => {
      pendingTimers.delete(key);
      update((prev) => {
        if (!prev.pendingKeys.has(key)) {
          return prev;
        }
        const pendingKeys = new Set(prev.pendingKeys);
        pendingKeys.delete(key);
        return { ...prev, pendingKeys };
      });
    }, PENDING_TIMEOUT_MS),
  );
}

async function refresh() {
  const generation = ++loadGeneration;
  if (!authSession.configured) {
    if (generation !== loadGeneration) {
      return;
    }
    update((prev) => ({
      ...prev,
      artists: [],
      venues: [],
      ready: true,
      libraryError: null,
    }));
    return;
  }

  try {
    const supabase = getSupabaseClient();
    const [artists, venues] = await Promise.all([
      loadFollowedItems(supabase, FOLLOWED_ATTRACTION_TYPE),
      loadFollowedItems(supabase, FOLLOWED_VENUE_TYPE),
    ]);
    if (generation !== loadGeneration) {
      return;
    }
    update((prev) => ({
      ...prev,
      artists: mergePendingList(
        artists,
        prev.artists,
        prev.pendingKeys,
        FOLLOWED_ATTRACTION_TYPE,
      ),
      venues: mergePendingList(
        venues,
        prev.venues,
        prev.pendingKeys,
        FOLLOWED_VENUE_TYPE,
      ),
      ready: true,
      libraryError: null,
    }));
  } catch (loadError) {
    if (generation !== loadGeneration) {
      return;
    }
    update((prev) => ({
      ...prev,
      ready: true,
      libraryError: followsMessage(loadError),
    }));
  }
}

export async function toggleFollow(
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

  if (snapshot.pendingKeys.has(pendingId)) {
    return { ok: false, ...base, code: "pending", message: "" };
  }

  if (!authSession.configured) {
    const message =
      "Following is not connected. Check the Supabase values in mobile/.env and restart Expo.";
    update((prev) => ({
      ...prev,
      libraryError: message,
      itemErrors: { ...prev.itemErrors, [pendingId]: message },
    }));
    return { ok: false, ...base, code: "not_configured", message };
  }

  if (
    !currentlyFollowed &&
    isAtMonitoredFollowLimit(snapshot.artists.length + snapshot.venues.length)
  ) {
    const message = maxMonitoredFollowsMessage();
    update((prev) => ({
      ...prev,
      libraryError: message,
      itemErrors: { ...prev.itemErrors, [pendingId]: message },
    }));
    return { ok: false, ...base, code: "max_follows", message };
  }

  if (!authSession.ready || !authSession.userId) {
    const message =
      "Your guest account is still connecting. Wait a moment and tap Follow again.";
    update((prev) => ({
      ...prev,
      libraryError: message,
      itemErrors: { ...prev.itemErrors, [pendingId]: message },
    }));
    return { ok: false, ...base, code: "not_ready", message };
  }

  const userId = authSession.userId;
  loadGeneration += 1;
  markPending(pendingId, true);
  update((prev) => {
    const itemErrors = { ...prev.itemErrors };
    delete itemErrors[pendingId];
    return {
      ...listPatch(prev, itemType, item, currentlyFollowed),
      libraryError: null,
      itemErrors,
    };
  });

  try {
    const supabase = getSupabaseClient();
    if (currentlyFollowed) {
      await unfollowItem(supabase, userId, itemType, item.item_key);
    } else {
      await followItem(supabase, userId, itemType, item);
    }
    return {
      ok: true,
      followed: !currentlyFollowed,
      itemKey: item.item_key,
      itemType,
    };
  } catch (toggleError) {
    update((prev) => ({
      ...listPatch(prev, itemType, item, !currentlyFollowed),
      libraryError: followsMessage(toggleError),
      itemErrors: {
        ...prev.itemErrors,
        [pendingId]: followsMessage(toggleError),
      },
    }));
    return {
      ok: false,
      ...base,
      code: "error",
      message: followsMessage(toggleError),
    };
  } finally {
    markPending(pendingId, false);
  }
}

function useFollowLoader() {
  const { user, ready: authReady, configured } = useAuth();

  useEffect(() => {
    authSession.userId = user?.id ?? null;
    authSession.ready = authReady;
    authSession.configured = configured;
    if (!authReady) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) {
        void refresh();
      }
    }, 0);
    const unsubscribe = subscribeUserLibrary(() => {
      if (!cancelled) {
        void refresh();
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [authReady, configured, user?.id]);
}

export function FollowBridge() {
  useFollowLoader();
  return null;
}

export function useFollows() {
  const { error: authError, configured } = useAuth();
  const current = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  function isFollowed(itemType: FollowedItemType, itemKey: string) {
    const list =
      itemType === FOLLOWED_ATTRACTION_TYPE ? current.artists : current.venues;
    return list.some((item) => item.item_key === itemKey);
  }

  function isPending(itemType: FollowedItemType, itemKey: string) {
    return current.pendingKeys.has(followPendingKey(itemType, itemKey));
  }

  function itemError(itemType: FollowedItemType, itemKey: string) {
    return current.itemErrors[followPendingKey(itemType, itemKey)] ?? null;
  }

  return {
    artists: current.artists,
    venues: current.venues,
    ready: current.ready,
    error: current.libraryError ?? authError,
    itemError,
    configured,
    toggleFollow,
    isFollowed,
    isPending,
    refresh,
    followCount: current.artists.length + current.venues.length,
  };
}
