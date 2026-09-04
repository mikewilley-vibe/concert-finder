import { useLocalSearchParams } from "expo-router";

import { FollowedDetailScreen } from "@/components/FollowedDetailScreen";

export default function ArtistScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();

  return (
    <FollowedDetailScreen
      kind="artist"
      id={typeof id === "string" ? id : undefined}
      name={typeof name === "string" ? name : undefined}
    />
  );
}
