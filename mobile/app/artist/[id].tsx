import { useLocalSearchParams } from "expo-router";

import { EmptyState } from "@/components/EmptyState";
import { Screen, ScreenBlock } from "@/components/Screen";
import { Body, Eyebrow, Title } from "@/components/Typography";

export default function ArtistScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Artist</Eyebrow>
        <Title>{name ?? "Artist"}</Title>
        <Body>
          Follow/unfollow and this artist’s upcoming Ticketmaster shows will
          live on this stack screen.
        </Body>
      </ScreenBlock>

      <EmptyState
        title="Upcoming shows not loaded yet"
        body={`Artist ${id ?? "unknown"} will request /api/ticketmaster/events through the website API after follows are connected.`}
      />
    </Screen>
  );
}
