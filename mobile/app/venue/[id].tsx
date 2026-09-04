import { useLocalSearchParams } from "expo-router";

import { FollowedDetailScreen } from "@/components/FollowedDetailScreen";

export default function VenueScreen() {
  const { id, name, city, state } = useLocalSearchParams<{
    id: string;
    name?: string;
    city?: string;
    state?: string;
  }>();
  const place = [city, state].filter(Boolean).join(", ");

  return (
    <FollowedDetailScreen
      kind="venue"
      id={typeof id === "string" ? id : undefined}
      name={typeof name === "string" ? name : undefined}
      place={place || undefined}
    />
  );
}
