import type { SupabaseClient } from "@supabase/supabase-js";

import { apiFetch } from "./api";
import { getSupabaseClient } from "./supabase";
import type { EntitySignals, InteractionSignals } from "./interaction-signals";
import type { HomeLocation } from "./home-location";

export type SuggestionPill = {
  id: string;
  name: string;
  reason: string;
  source: "similar" | "nearby" | "activity" | "hosts";
  imageUrl: string | null;
  city: string | null;
  state: string | null;
};

export type SuggestionsData = {
  artists: SuggestionPill[];
  venues: SuggestionPill[];
  lastfm: "ok" | "skipped" | "error";
};

const EMPTY: SuggestionsData = {
  artists: [],
  venues: [],
  lastfm: "skipped",
};

function signalFor(row: EntitySignals) {
  if (row.going > 0) {
    return "going" as const;
  }
  if (row.interested > 0) {
    return "interested" as const;
  }
  if (row.saves > 0) {
    return "saved" as const;
  }
  if (row.taps > 0 || row.ticketOpens > 0) {
    return "opened" as const;
  }
  return null;
}

function activityFrom(
  bucket: Record<string, EntitySignals>,
) {
  return Object.entries(bucket)
    .flatMap(([id, row]) => {
      const signal = signalFor(row);
      if (!signal) {
        return [];
      }
      return [{ id, signal }];
    })
    .sort((left, right) => {
      const rightAt = bucket[right.id]?.lastAt ?? 0;
      const leftAt = bucket[left.id]?.lastAt ?? 0;
      return rightAt - leftAt;
    })
    .slice(0, 30);
}

export function suggestionActivity(signals: InteractionSignals) {
  return {
    openedArtists: activityFrom(signals.artists),
    openedVenues: activityFrom(signals.venues),
  };
}

export function suggestionLocation(location: HomeLocation) {
  const body: {
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    radiusMiles: number;
  } = { radiusMiles: location.radiusMiles };
  const postalCode = location.postalCode.trim();
  if (postalCode) {
    body.postalCode = postalCode;
  }
  if (
    typeof location.latitude === "number" &&
    typeof location.longitude === "number"
  ) {
    body.latitude = location.latitude;
    body.longitude = location.longitude;
  }
  return body;
}

export async function loadSuggestions(input: {
  location: HomeLocation;
  signals: InteractionSignals;
}) {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    return EMPTY;
  }
  const activity = suggestionActivity(input.signals);
  return apiFetch<SuggestionsData>("/api/v1/suggestions", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      location: suggestionLocation(input.location),
      openedArtists: activity.openedArtists,
      openedVenues: activity.openedVenues,
    }),
  });
}

export async function dismissSuggestion(
  supabase: SupabaseClient,
  userId: string,
  itemType: "ticketmaster_attraction" | "ticketmaster_venue",
  item: { id: string; name: string },
) {
  const { error } = await supabase.from("suggestion_dismissals").insert({
    user_id: userId,
    item_type: itemType,
    item_key: item.id,
    item_label: item.name,
  });
  if (error && error.code !== "23505") {
    return false;
  }
  return true;
}
