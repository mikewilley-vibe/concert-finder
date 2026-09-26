import type { TicketmasterShow } from "./api";
import type { FollowedItem } from "./follows";
import {
  isUpcomingShow,
  isWithinDays,
  showSortKey,
} from "./show-windows.ts";

export type FavoriteShowKind = "artist" | "venue";
export type FavoriteShowView = "week" | "next";

export const FAVORITE_SHOW_VIEWS: Array<{
  id: FavoriteShowView;
  label: string;
}> = [
  { id: "week", label: "This Week" },
  { id: "next", label: "Next" },
];

export function parseFavoriteShowView(value: string | undefined) {
  return FAVORITE_SHOW_VIEWS.some((item) => item.id === value)
    ? (value as FavoriteShowView)
    : "week";
}

function uniqueChronologicalShows(
  shows: readonly TicketmasterShow[],
  now: Date,
) {
  const seen = new Set<string>();
  return [...shows]
    .filter((show) => {
      if (seen.has(show.id) || !isUpcomingShow(show, now)) {
        return false;
      }
      seen.add(show.id);
      return true;
    })
    .sort((left, right) => {
      const byDate = showSortKey(left).localeCompare(showSortKey(right));
      return byDate !== 0 ? byDate : left.id.localeCompare(right.id);
    });
}

export function favoriteShowsForView(input: {
  kind: FavoriteShowKind;
  view: FavoriteShowView;
  shows: readonly TicketmasterShow[];
  follows: readonly FollowedItem[];
  selectedFollowKey?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const upcoming = uniqueChronologicalShows(input.shows, now);

  if (input.selectedFollowKey) {
    const selected = input.follows.find(
      (item) => item.item_key === input.selectedFollowKey,
    );
    if (!selected) {
      return [];
    }

    return upcoming.filter((show) =>
      showMatchesFollow(show, input.kind, selected),
    );
  }

  if (input.view === "week") {
    return upcoming.filter((show) => isWithinDays(show, 7, now));
  }

  if (input.view === "next") {
    const picked: TicketmasterShow[] = [];
    const seenShows = new Set<string>();
    for (const follow of input.follows) {
      const match = upcoming.find(
        (show) =>
          !seenShows.has(show.id) &&
          showMatchesFollow(show, input.kind, follow),
      );
      if (!match) {
        continue;
      }
      picked.push(match);
      seenShows.add(match.id);
    }
    return picked.sort((left, right) => {
      const byDate = showSortKey(left).localeCompare(showSortKey(right));
      return byDate !== 0 ? byDate : left.id.localeCompare(right.id);
    });
  }

  return upcoming;
}

function normalizedName(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase();
}

export function showMatchesFollow(
  show: TicketmasterShow,
  kind: FavoriteShowKind,
  follow: FollowedItem,
) {
  if (kind === "venue") {
    return (
      show.venueId === follow.item_key ||
      normalizedName(show.venueName) === normalizedName(follow.item_label)
    );
  }

  return show.attractions.some(
    (artist) =>
      artist.id === follow.item_key ||
      normalizedName(artist.name) === normalizedName(follow.item_label),
  );
}

export function favoriteShowViewCopy(
  kind: FavoriteShowKind,
  view: FavoriteShowView,
) {
  const noun = kind === "artist" ? "artists" : "venues";
  if (view === "week") {
    return {
      title:
        kind === "artist"
          ? "Your artists this week"
          : "Your venues this week",
      body:
        kind === "artist"
          ? "Shows from artists you follow over the next seven days."
          : "Shows at venues you follow over the next seven days.",
      empty:
        kind === "artist"
          ? "No artists you follow have a show in the next seven days."
          : "No shows are scheduled at your followed venues in the next seven days.",
    };
  }
  if (view === "next") {
    return {
      title:
        kind === "artist"
          ? "Next up for your artists"
          : "Next up at your venues",
      body:
        kind === "artist"
          ? "The next scheduled show for each artist you follow."
          : "The next scheduled show at each venue you follow.",
      empty: `No upcoming shows were found for your followed ${noun}.`,
    };
  }

  return {
    title:
      kind === "artist" ? "Next up for your artists" : "Next up at your venues",
    body:
      kind === "artist"
        ? "The next scheduled show for each artist you follow."
        : "The next scheduled show at each venue you follow.",
    empty: `No upcoming shows were found for your followed ${noun}.`,
  };
}
