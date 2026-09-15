export const FAVORITE_ARTIST_GOAL = 5;
export const FAVORITE_VENUE_GOAL = 3;

export type FavoritesProgress = {
  artistCount: number;
  venueCount: number;
  artistGoal: number;
  venueGoal: number;
  artistsMet: boolean;
  venuesMet: boolean;
  complete: boolean;
  artistLabel: string;
  venueLabel: string;
};

export function favoritesProgress(
  artistCount: number,
  venueCount: number,
): FavoritesProgress {
  const artists = Math.max(0, artistCount);
  const venues = Math.max(0, venueCount);
  const artistsMet = artists >= FAVORITE_ARTIST_GOAL;
  const venuesMet = venues >= FAVORITE_VENUE_GOAL;
  return {
    artistCount: artists,
    venueCount: venues,
    artistGoal: FAVORITE_ARTIST_GOAL,
    venueGoal: FAVORITE_VENUE_GOAL,
    artistsMet,
    venuesMet,
    complete: artistsMet && venuesMet,
    artistLabel: `Artists: ${Math.min(artists, FAVORITE_ARTIST_GOAL)} of ${FAVORITE_ARTIST_GOAL}`,
    venueLabel: `Venues: ${Math.min(venues, FAVORITE_VENUE_GOAL)} of ${FAVORITE_VENUE_GOAL}`,
  };
}
