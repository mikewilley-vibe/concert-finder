import { useLocalSearchParams } from "expo-router";

import { EmptyState } from "@/components/EmptyState";
import { Screen, ScreenBlock } from "@/components/Screen";
import { Body, Eyebrow, Title } from "@/components/Typography";

export default function ConcertScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Concert</Eyebrow>
        <Title>{id === "preview" ? "Concert detail" : "Show details"}</Title>
        <Body>
          Artwork, date, venue, status, save/remove, and a Ticketmaster link
          will load here from the website event-details API. This screen is a
          stack route, not an expanded Home row.
        </Body>
      </ScreenBlock>

      <EmptyState
        title={id ? `Event ${id}` : "Missing event"}
        body="Event snapshots come from /api/ticketmaster/event-details on the Concert Finder website. Ticketmaster is never called from the device."
      />
    </Screen>
  );
}
