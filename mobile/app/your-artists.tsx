import { useMemo } from "react";

import { ActionLink } from "@/components/ActionLink";
import { EmptyState } from "@/components/EmptyState";
import { GoingButton } from "@/components/GoingButton";
import { Screen, ScreenBlock } from "@/components/Screen";
import { ShowRow } from "@/components/ShowRow";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { useInteractionSignals } from "@/hooks/useInteractionSignals";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { homeArtistKicker, homeShowMeta } from "@/lib/home-feed";
import { getRememberedHomeFeed } from "@/lib/home-feed-cache";

export default function YourArtistsScreen() {
  const saved = useSavedEvents();
  const interactions = useInteractionSignals();
  const feed = useMemo(() => getRememberedHomeFeed(), []);
  const cards = feed?.yourArtists ?? [];

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Your artists</Eyebrow>
        <Title>Coming up from favorites.</Title>
        <Body>
          The next two upcoming shows for each artist you follow, in any city.
          Nearby dates can sort higher when two shows are equally soon.
        </Body>
      </ScreenBlock>
      {cards.length === 0 ? (
        <EmptyState
          title="No artist list yet"
          body="Open Home first, or add favorite artists in Discover."
          action={
            <ActionLink
              href="/discover"
              label="Add favorites"
              accessibilityLabel="Add favorite artists and venues"
            />
          }
        />
      ) : (
        <ScreenBlock>
          <Strong>{cards.length} shows</Strong>
          {cards.map((card) => {
            const going = saved.statusFor(card.show.id) === "going";
            return (
              <ShowRow
                key={`${card.artistId ?? "artist"}:${card.show.id}`}
                show={card.show}
                kicker={homeArtistKicker(card)}
                subtitle={homeShowMeta(card)}
                onOpen={() => {
                  void interactions.track({
                    kind: "tap",
                    eventId: card.show.id,
                    artistIds: card.show.attractions.map((artist) => artist.id),
                    venueId: card.show.venueId,
                  });
                }}
                trailing={
                  <GoingButton
                    going={going}
                    pending={saved.isPending(card.show.id)}
                    name={card.show.name}
                    onPress={() => {
                      void saved.tapGoingFromCard(card.show);
                    }}
                  />
                }
              />
            );
          })}
        </ScreenBlock>
      )}
    </Screen>
  );
}
