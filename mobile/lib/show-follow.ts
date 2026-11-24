export type FollowableArtist = {
  id: string;
  name: string;
};

export function cardFollowArtist(
  attractions: readonly FollowableArtist[],
  followedIds: readonly string[],
  preferredId?: string | null,
): FollowableArtist | null {
  const artists = attractions.filter(
    (artist) => artist.id.trim() && artist.name.trim(),
  );
  if (artists.length === 0) {
    return null;
  }
  if (preferredId) {
    const preferred = artists.find((artist) => artist.id === preferredId);
    if (preferred) {
      return preferred;
    }
  }
  const followed = new Set(followedIds);
  return artists.find((artist) => followed.has(artist.id)) ?? artists[0] ?? null;
}
