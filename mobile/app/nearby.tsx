import { useMemo } from "react";

import { ActionLink } from "@/components/ActionLink";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
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
          body="Open Home first so ShowSignal can load this week’s shows."
          action={
            <ActionLink href="/(tabs)" label="Back to Home" accessibilityLabel="Back to Home" />
          }
        />
      ) : (
        <ScreenBlock>
          <Strong>{cards.length} shows</Strong>
          {cards.map((card) => {
            const isSaved = saved.savedIds.has(card.show.id);
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
                  <Button
                    label={isSaved ? "Saved" : "Save"}
                    variant={isSaved ? "secondary" : "action"}
                    disabled={saved.isPending(card.show.id)}
                    onPress={() => {
                      void saved.toggleSaved(card.show);
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
