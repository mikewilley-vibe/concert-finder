export const HOME_EVENT_PAGE_SIZE = 50;
export const FOLLOW_CHUNK = 20;

export type HomeFollowRef = {
  id: string;
  label: string;
};

export type FavoriteArtistSearchJob = {
  attractions: HomeFollowRef[];
  venues: [];
  pageSize: number;
};

type FollowSource = {
  item_key: string;
  item_label: string;
};

function chunkRefs(refs: HomeFollowRef[]) {
  const chunks: HomeFollowRef[][] = [];
  for (let index = 0; index < refs.length; index += FOLLOW_CHUNK) {
    chunks.push(refs.slice(index, index + FOLLOW_CHUNK));
  }
  return chunks;
}

function toFollowedRef(item: FollowSource): HomeFollowRef {
  return { id: item.item_key, label: item.item_label };
}

/**
 * Ticketmaster jobs for followed artists. Intentionally omits postal code,
 * coordinates, radius, and endDateTime so Home can take the next dates
 * anywhere on a tour.
 */
export function favoriteArtistSearchJobs(
  artists: readonly FollowSource[],
): FavoriteArtistSearchJob[] {
  return chunkRefs(artists.map(toFollowedRef)).map((chunk) => ({
    attractions: chunk,
    venues: [],
    pageSize: HOME_EVENT_PAGE_SIZE,
  }));
}
