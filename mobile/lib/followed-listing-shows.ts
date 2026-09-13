import type { FollowedRef, TicketmasterShow } from "./api";

export const FOLLOWED_LISTING_PAGE_SIZE = 50;
export const MAX_FOLLOWED_LISTING_PAGES = 4;

export type FollowedListingPage = {
  hasMore?: boolean;
  nextPage?: number | null;
};

export type FollowedListingSearchResult = {
  shows: TicketmasterShow[];
  page?: FollowedListingPage;
};

export type FollowedListingSearch = (input: {
  attractions: FollowedRef[];
  venues: FollowedRef[];
  keyword?: string;
  page?: number;
  pageSize?: number;
}) => Promise<FollowedListingSearchResult>;

function normalizeVenueName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['\u2019`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLeadingArticle(value: string) {
  return value.replace(/^(the|a|an)\s+/, "").trim();
}

export function venueShowMatches(
  show: Pick<TicketmasterShow, "venueId" | "venueName">,
  venueId: string,
  venueLabel: string,
) {
  const id = show.venueId?.trim() ?? "";
  if (id && id === venueId.trim()) {
    return true;
  }

  const query = normalizeVenueName(venueLabel);
  const name = normalizeVenueName(show.venueName);
  if (!query || !name) {
    return false;
  }
  if (query === name || stripLeadingArticle(query) === stripLeadingArticle(name)) {
    return true;
  }
  if (name.startsWith(query) && query.length >= 4) {
    return true;
  }
  if (query.startsWith(name) && name.length >= 4) {
    return true;
  }
  return false;
}

function showSortKey(show: TicketmasterShow) {
  return show.startsAt?.trim() || show.localDate?.trim() || "\uFFFF";
}

function mergeShows(existing: TicketmasterShow[], incoming: TicketmasterShow[]) {
  const shows = [...existing];
  const seen = new Set(existing.map((show) => show.id));
  for (const show of incoming) {
    if (seen.has(show.id)) {
      continue;
    }
    seen.add(show.id);
    shows.push(show);
  }
  return shows.sort((left, right) => {
    const byDate = showSortKey(left).localeCompare(showSortKey(right));
    return byDate !== 0 ? byDate : left.id.localeCompare(right.id);
  });
}

async function collectPages(
  search: FollowedListingSearch,
  input: {
    attractions: FollowedRef[];
    venues: FollowedRef[];
    keyword?: string;
  },
) {
  let shows: TicketmasterShow[] = [];
  let capped = false;

  for (let page = 0; page < MAX_FOLLOWED_LISTING_PAGES; page += 1) {
    const result = await search({
      ...input,
      page,
      pageSize: FOLLOWED_LISTING_PAGE_SIZE,
    });
    shows = mergeShows(shows, result.shows);

    // Server already collected multiple Ticketmaster pages into this response.
    if (result.shows.length > FOLLOWED_LISTING_PAGE_SIZE) {
      capped = Boolean(result.page?.hasMore);
      break;
    }
    if (!result.page?.hasMore) {
      break;
    }
    if (page === MAX_FOLLOWED_LISTING_PAGES - 1) {
      capped = true;
    }
  }

  return { shows, capped };
}

export async function loadFollowedListingShows({
  kind,
  id,
  label,
  search,
}: {
  kind: "artist" | "venue";
  id: string;
  label: string;
  search: FollowedListingSearch;
}) {
  const attractions: FollowedRef[] =
    kind === "artist" ? [{ id, label }] : [];
  const venues: FollowedRef[] = kind === "venue" ? [{ id, label }] : [];

  const byId = await collectPages(search, { attractions, venues });
  if (kind !== "venue" || byId.shows.length > 0) {
    return byId;
  }

  const byName = await collectPages(search, {
    attractions: [],
    venues: [],
    keyword: label,
  });
  return {
    shows: byName.shows.filter((show) => venueShowMatches(show, id, label)),
    capped: byName.capped,
  };
}
