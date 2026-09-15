import { useRouter } from "expo-router";

import { ActionLink } from "@/components/ActionLink";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { GoingButton } from "@/components/GoingButton";
import { ListRow } from "@/components/ListRow";
import { LoadingBlock } from "@/components/LoadingBlock";
import { Screen, ScreenBlock } from "@/components/Screen";
import { ShowRow } from "@/components/ShowRow";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { useFollows } from "@/hooks/useFollows";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import {
  FOLLOWED_ATTRACTION_TYPE,
  FOLLOWED_VENUE_TYPE,
  MAX_MONITORED_FOLLOWS,
} from "@/lib/follows";

export default function SavedScreen() {
  const router = useRouter();
  const follows = useFollows();
  const saved = useSavedEvents();
  const loading = !follows.ready || !saved.ready;
  const hasShows = saved.goingShows.length > 0 || saved.interestedShows.length > 0;
  const hasFavorites =
    follows.artists.length > 0 || follows.venues.length > 0;

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>My Shows</Eyebrow>
        <Title>Going, interested, and favorites.</Title>
        <Body>
          Shows you’re going to, shows you’re considering, and the artists and
          venues you follow.
        </Body>
      </ScreenBlock>

      {loading ? <LoadingBlock label="Loading your shows…" /> : null}

      {saved.error ? (
        <EmptyState
          title="Shows didn’t load"
          body={saved.error}
          action={
            <Button
              label="Try again"
              onPress={() => {
                void saved.refresh();
              }}
            />
          }
        />
      ) : null}

      {follows.error ? (
        <EmptyState
          title="Follows didn’t load"
          body={follows.error}
          action={
            <Button
              label="Try again"
              onPress={() => {
                void follows.refresh();
              }}
            />
          }
        />
      ) : null}

      {!loading && !hasShows ? (
        <EmptyState
          title="No shows yet"
          body="Mark I’m Going or Interested on a concert to keep it here."
          action={
            <ActionLink
              href="/discover"
              label="Find artists and venues"
              accessibilityLabel="Find artists and venues"
            />
          }
        />
      ) : null}

      {saved.goingShows.length > 0 ? (
        <ScreenBlock>
          <Strong>Going</Strong>
          {saved.goingShows.map((show) => (
            <ShowRow
              key={show.id}
              show={show}
              kicker="✓ Going"
              trailing={
                <GoingButton
                  going
                  pending={saved.isPending(show.id)}
                  name={show.name}
                  onPress={() => {
                    void saved.tapStatus(show, "going");
                  }}
                />
              }
            />
          ))}
        </ScreenBlock>
      ) : null}

      {saved.interestedShows.length > 0 ? (
        <ScreenBlock>
          <Strong>Interested</Strong>
          {saved.interestedShows.map((show) => (
            <ShowRow
              key={show.id}
              show={show}
              kicker="♡ Interested"
              trailing={
                <Button
                  label="♡ Interested"
                  variant="secondary"
                  disabled={saved.isPending(show.id)}
                  accessibilityLabel={`Clear interested for ${show.name}`}
                  onPress={() => {
                    void saved.tapStatus(show, "interested");
                  }}
                />
              }
            />
          ))}
        </ScreenBlock>
      ) : null}

      {!loading && !hasFavorites ? (
        <EmptyState
          title="No favorite artists or venues"
          body={`Follow from Discover. Tracking currently supports ${MAX_MONITORED_FOLLOWS} artists and venues combined.`}
          action={
            <ActionLink
              href="/discover"
              label="Find artists and venues"
              accessibilityLabel="Find artists and venues"
            />
          }
        />
      ) : null}

      {follows.artists.length > 0 ? (
        <ScreenBlock>
          <Strong>Favorite artists</Strong>
          {follows.artists.map((artist) => (
            <ListRow
              key={artist.item_key}
              title={artist.item_label}
              subtitle="See upcoming shows"
              accessibilityLabel={`View upcoming shows for ${artist.item_label}`}
              onPress={() =>
                router.push({
                  pathname: "/artist/[id]",
                  params: { id: artist.item_key, name: artist.item_label },
                })
              }
              trailing={
                <Button
                  label="Unfollow"
                  variant="secondary"
                  disabled={follows.isPending(
                    FOLLOWED_ATTRACTION_TYPE,
                    artist.item_key,
                  )}
                  accessibilityLabel={`Unfollow ${artist.item_label}`}
                  onPress={() => {
                    void follows.toggleFollow(
                      FOLLOWED_ATTRACTION_TYPE,
                      artist,
                      true,
                    );
                  }}
                />
              }
            />
          ))}
        </ScreenBlock>
      ) : null}

      {follows.venues.length > 0 ? (
        <ScreenBlock>
          <Strong>Favorite venues</Strong>
          {follows.venues.map((venue) => (
            <ListRow
              key={venue.item_key}
              title={venue.item_label}
              subtitle="See upcoming shows"
              accessibilityLabel={`View upcoming shows at ${venue.item_label}`}
              onPress={() =>
                router.push({
                  pathname: "/venue/[id]",
                  params: { id: venue.item_key, name: venue.item_label },
                })
              }
              trailing={
                <Button
                  label="Unfollow"
                  variant="secondary"
                  disabled={follows.isPending(
                    FOLLOWED_VENUE_TYPE,
                    venue.item_key,
                  )}
                  accessibilityLabel={`Unfollow ${venue.item_label}`}
                  onPress={() => {
                    void follows.toggleFollow(
                      FOLLOWED_VENUE_TYPE,
                      venue,
                      true,
                    );
                  }}
                />
              }
            />
          ))}
        </ScreenBlock>
      ) : null}
    </Screen>
  );
}
