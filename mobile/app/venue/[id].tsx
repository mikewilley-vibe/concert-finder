import { useLocalSearchParams } from "expo-router";

import { FollowedDetailScreen } from "@/components/FollowedDetailScreen";
import { firstRouteParam } from "@/lib/route-params";

export default function VenueScreen() {
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    city?: string;
    state?: string;
  }>();
  const place = [firstRouteParam(params.city), firstRouteParam(params.state)]
    .filter(Boolean)
    .join(", ");

  return (
    <FollowedDetailScreen
      kind="venue"
      id={firstRouteParam(params.id)}
      name={firstRouteParam(params.name)}
      place={place || undefined}
    />
  );
}
