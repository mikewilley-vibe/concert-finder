import { useLocalSearchParams } from "expo-router";

import { EmptyState } from "@/components/EmptyState";
import { Screen, ScreenBlock } from "@/components/Screen";
import { Body, Eyebrow, Title } from "@/components/Typography";

export default function VenueScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();

  return (
    <Screen>
      <ScreenBlock>
        <Eyebrow>Venue</Eyebrow>
        <Title>{name ?? "Venue"}</Title>
        <Body>
          Follow/unfollow and this room’s upcoming dates will open here instead
          of expanding inside Discover.
        </Body>
      </ScreenBlock>

      <EmptyState
        title="Upcoming shows not loaded yet"
        body={`Venue ${id ?? "unknown"} will use the same website events route as artists. Location radius search is later work.`}
      />
    </Screen>
  );
}
