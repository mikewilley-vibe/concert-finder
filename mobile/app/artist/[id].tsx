import { useLocalSearchParams } from "expo-router";

import { FollowedDetailScreen } from "@/components/FollowedDetailScreen";
import { firstRouteParam } from "@/lib/route-params";

export default function ArtistScreen() {
  const params = useLocalSearchParams<{ id: string; name?: string }>();

  return (
    <FollowedDetailScreen
      kind="artist"
      id={firstRouteParam(params.id)}
      name={firstRouteParam(params.name)}
    />
  );
}
