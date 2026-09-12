export type NextUpcomingShow = {
  id: string;
  startsAt?: string | null;
  localDate?: string | null;
  venueId?: string | null;
  attractions: Array<{ id: string }>;
};

export type NextUpcomingFollows = {
  attractionIds: readonly string[];
  venueIds: readonly string[];
};

function trimmedId(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function showSortKey(show: NextUpcomingShow) {
  const startsAt = trimmedId(show.startsAt);
  if (startsAt) {
    return startsAt;
  }
  const localDate = trimmedId(show.localDate);
  if (localDate) {
    return localDate;
  }
  return "\uFFFF";
}

function followIdSet(ids: readonly string[]) {
  return new Set(ids.map(trimmedId).filter(Boolean));
}

/**
 * Keep the soonest upcoming show for each followed artist and venue.
 * Results are sorted by date, soonest first. The same event is listed once
 * when it is the next date for more than one follow.
 */
export function pickNextUpcomingShows<T extends NextUpcomingShow>(
  shows: readonly T[],
  followed: NextUpcomingFollows,
): T[] {
  const remainingArtists = followIdSet(followed.attractionIds);
  const remainingVenues = followIdSet(followed.venueIds);
  if (remainingArtists.size === 0 && remainingVenues.size === 0) {
    return [];
  }

  const sorted = [...shows].sort((left, right) => {
    const byDate = showSortKey(left).localeCompare(showSortKey(right));
    return byDate !== 0 ? byDate : left.id.localeCompare(right.id);
  });

  const picked: T[] = [];
  const pickedIds = new Set<string>();

  for (const show of sorted) {
    const artistHits = show.attractions
      .map((artist) => trimmedId(artist.id))
      .filter((id) => remainingArtists.has(id));
    const venueId = trimmedId(show.venueId);
    const venueHit = Boolean(venueId) && remainingVenues.has(venueId);

    if (artistHits.length === 0 && !venueHit) {
      continue;
    }

    if (!pickedIds.has(show.id)) {
      picked.push(show);
      pickedIds.add(show.id);
    }
    for (const id of artistHits) {
      remainingArtists.delete(id);
    }
    if (venueHit) {
      remainingVenues.delete(venueId);
    }
  }

  return picked;
}
