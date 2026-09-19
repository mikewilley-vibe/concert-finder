import { useMemo } from "react";

import { ActionLink } from "@/components/ActionLink";
import { EmptyState } from "@/components/EmptyState";
import { GoingButton } from "@/components/GoingButton";
import { Screen, ScreenBlock } from "@/components/Screen";
import { ShowRow } from "@/components/ShowRow";
import { Body, Eyebrow, Strong, Title } from "@/components/Typography";
import { useInteractionSignals } from "@/hooks/useInteractionSignals";
import { useSavedEvents } from "@/hooks/useSavedEvents";
import { homeShowMeta } from "@/lib/home-feed";
import { getRememberedHomeFeed } from "@/lib/home-feed-cache";

export default function NearbyShowsScreen() {
  const saved = useSavedEvents();
  const interactions = useInteractionSignals();
  const feed = useMemo(() => getRememberedHomeFeed(), []);
  const cards = feed?.nearYou ?? [];

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Near you</Eyebrow>
        <Title>This week, close by.</Title>
        <Body>
          Shows within your radius over the next 7 days, soonest first.
        </Body>
      </ScreenBlock>
      {cards.length === 0 ? (
        <EmptyState
          title="No nearby list yet"
          body="Open Discover first so ShowSignal can load this week’s shows."
          action={
            <ActionLink
              href="/(tabs)"
              label="Back to Discover"
              accessibilityLabel="Back to Discover"
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
                key={card.show.id}
                show={card.show}
                kicker={card.scanDate}
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
