import { useRouter } from "expo-router";

import { ActionLink } from "@/components/ActionLink";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
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

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Saved</Eyebrow>
        <Title>Shows you kept and people you follow.</Title>
        <Body>
          Saved concerts and followed artists and venues live here. Remove them
          whenever you want.
        </Body>
      </ScreenBlock>

      {loading ? <LoadingBlock label="Loading saved items…" /> : null}

      {saved.error ? (
        <EmptyState
          title="Saved shows didn’t load"
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

      {!loading && saved.shows.length === 0 ? (
        <EmptyState
          title="No saved events"
          body="Save a concert from a detail screen to keep the date, venue, and Ticketmaster link."
          action={
            <ActionLink
              href="/discover"
              label="Find artists and venues"
              accessibilityLabel="Find artists and venues"
            />
          }
        />
      ) : null}

      {saved.shows.length > 0 ? (
        <ScreenBlock>
          <Strong>Saved events</Strong>
          {saved.shows.map((show) => (
            <ShowRow
              key={show.id}
              show={show}
              trailing={
                <Button
                  label="Remove"
                  variant="secondary"
                  disabled={saved.isPending(show.id)}
                  accessibilityLabel={`Remove ${show.name} from saved`}
                  onPress={() => {
                    void saved.toggleSaved(show);
                  }}
                />
              }
            />
          ))}
        </ScreenBlock>
      ) : null}

      {!loading &&
      follows.artists.length === 0 &&
      follows.venues.length === 0 ? (
        <EmptyState
          title="No followed artists or venues"
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
          <Strong>Followed artists</Strong>
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
          <Strong>Followed venues</Strong>
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
