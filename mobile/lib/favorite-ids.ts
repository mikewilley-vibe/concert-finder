export type FavoriteIdSource = {
  item_key: string;
};

export type FavoriteIds = {
  artistIds: ReadonlySet<string>;
  venueIds: ReadonlySet<string>;
};

function idSet(items: readonly FavoriteIdSource[]) {
  return new Set(
    items
      .map((item) => item.item_key.trim())
      .filter((id) => id.length > 0),
  );
}

export function favoriteIdsFromFollows(
  artists: readonly FavoriteIdSource[],
  venues: readonly FavoriteIdSource[],
): FavoriteIds {
  return {
    artistIds: idSet(artists),
    venueIds: idSet(venues),
  };
}

export function showHasFavoriteArtist(
  show: { attractions?: Array<{ id?: string | null }> },
  artistIds: ReadonlySet<string>,
) {
  if (artistIds.size === 0) {
    return false;
  }
  return (show.attractions ?? []).some((artist) => {
    const id = artist.id?.trim() ?? "";
    return Boolean(id) && artistIds.has(id);
  });
}

export function showHasFavoriteVenue(
  show: { venueId?: string | null },
  venueIds: ReadonlySet<string>,
) {
  if (venueIds.size === 0) {
    return false;
  }
  const venueId = show.venueId?.trim() ?? "";
  return Boolean(venueId) && venueIds.has(venueId);
}
