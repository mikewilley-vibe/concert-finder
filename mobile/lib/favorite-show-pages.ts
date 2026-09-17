import type {
  FollowedRef,
  TicketmasterShow,
  UpcomingShowsPage,
} from "./api";
import type { FollowedItem } from "./follows";
import {
  FOLLOW_CHUNK,
  HOME_EVENT_PAGE_SIZE,
} from "./home-event-searches.ts";

export type FavoriteShowCursor = {
  key: string;
  refs: FollowedRef[];
  page: number;
};

export type FavoriteShowPageSearch = (input: {
  attractions: FollowedRef[];
  venues: FollowedRef[];
  page: number;
  pageSize: number;
}) => Promise<{ shows: TicketmasterShow[]; page?: UpcomingShowsPage }>;

export function initialFavoriteShowCursors(
  kind: "artist" | "venue",
  follows: readonly FollowedItem[],
) {
  const refs = follows.map((item) => ({
    id: item.item_key,
    label: item.item_label,
  }));
  const cursors: FavoriteShowCursor[] = [];
  for (let index = 0; index < refs.length; index += FOLLOW_CHUNK) {
    const chunk = refs.slice(index, index + FOLLOW_CHUNK);
    cursors.push({
      key: `${kind}:${index / FOLLOW_CHUNK}`,
      refs: chunk,
      page: 0,
    });
  }
  return cursors;
}

function mergeShows(batches: readonly TicketmasterShow[][]) {
  const seen = new Set<string>();
  const shows: TicketmasterShow[] = [];
  for (const batch of batches) {
    for (const show of batch) {
      if (seen.has(show.id)) {
        continue;
      }
      seen.add(show.id);
      shows.push(show);
    }
  }
  return shows;
}

export async function loadFavoriteShowPage(input: {
  kind: "artist" | "venue";
  cursors: readonly FavoriteShowCursor[];
  search: FavoriteShowPageSearch;
}) {
  const results = await Promise.all(
    input.cursors.map(async (cursor) => {
      const result = await input.search({
        attractions: input.kind === "artist" ? cursor.refs : [],
        venues: input.kind === "venue" ? cursor.refs : [],
        page: cursor.page,
        pageSize: HOME_EVENT_PAGE_SIZE,
      });
      return { cursor, result };
    }),
  );

  const nextCursors: FavoriteShowCursor[] = [];
  for (const { cursor, result } of results) {
    const nextPage = result.page?.nextPage;
    if (
      result.page?.hasMore &&
      typeof nextPage === "number" &&
      nextPage > cursor.page
    ) {
      nextCursors.push({ ...cursor, page: nextPage });
    }
  }

  return {
    shows: mergeShows(results.map(({ result }) => result.shows)),
    nextCursors,
  };
}

export function mergeFavoriteShowPages(
  existing: readonly TicketmasterShow[],
  incoming: readonly TicketmasterShow[],
) {
  return mergeShows([[...existing], [...incoming]]);
}
