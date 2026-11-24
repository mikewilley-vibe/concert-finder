import { useState } from "react";

import { requestCurrentHomeLocation } from "@/lib/current-location";
import { NEAR_ME_RADIUS_MILES } from "@/lib/geo";
import {
  activeOrigin,
  activePlaceLabel,
} from "@/lib/home-location";
import { getHomeLocation } from "@/lib/home-location-store";
import {
  readShowListFilters,
  rememberShowListFilters,
} from "@/lib/show-list-filters";
import type { ShowDateFilter } from "@/lib/show-date-filter";
import { useHomeLocation } from "@/hooks/useHomeLocation";

export function useShowListFilters(tab: string) {
  const home = useHomeLocation();
  const initial = readShowListFilters(tab);
  const [dateFilter, setDateFilterState] = useState<ShowDateFilter>(
    initial.dateFilter,
  );
  const [nearMe, setNearMeState] = useState(initial.nearMe);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  function remember(nextDate: ShowDateFilter, nextNearMe: boolean) {
    rememberShowListFilters(tab, {
      dateFilter: nextDate,
      nearMe: nextNearMe,
    });
  }

  function setDateFilter(next: ShowDateFilter) {
    setDateFilterState(next);
    remember(next, nearMe);
  }

  function disableNearMe() {
    setNearMeState(false);
    setNotice(null);
    setDenied(false);
    remember(dateFilter, false);
  }

  async function toggleNearMe() {
    if (nearMe) {
      disableNearMe();
      return;
    }

    setNotice(null);
    setDenied(false);
    let origin = activeOrigin(getHomeLocation());
    if (!origin) {
      setLocating(true);
      const result = await requestCurrentHomeLocation();
      if (!result.ok) {
        setLocating(false);
        setDenied(result.code === "denied");
        setNotice(result.message);
        return;
      }
      const saved = await home.save({
        ...getHomeLocation(),
        postalCode:
          result.location.postalCode || getHomeLocation().postalCode,
        latitude: result.location.latitude,
        longitude: result.location.longitude,
        placeLabel:
          result.location.placeLabel || getHomeLocation().placeLabel,
        source: "current",
      });
      setLocating(false);
      if (!saved) {
        setNotice("Could not save your current location. Try again.");
        return;
      }
      origin = activeOrigin(getHomeLocation());
      if (!origin) {
        setNotice("Could not read a location to measure distance from.");
        return;
      }
    }

    setNearMeState(true);
    remember(dateFilter, true);
  }

  function clearFilters() {
    setDateFilterState("all");
    setNearMeState(false);
    setNotice(null);
    setDenied(false);
    remember("all", false);
  }

  const origin = activeOrigin(home.location);
  const place = activePlaceLabel(home.location);
  const nearLabel = place
    ? `Within ${NEAR_ME_RADIUS_MILES} miles of ${place}`
    : `Within ${NEAR_ME_RADIUS_MILES} miles`;
  const displayedNotice =
    notice ??
    (home.ready && nearMe && !origin && !locating
      ? "Near me needs a location, so distance filtering is paused."
      : null);

  return {
    dateFilter,
    setDateFilter,
    nearMe,
    toggleNearMe,
    clearFilters,
    locating,
    notice: displayedNotice,
    denied,
    origin,
    nearLabel,
    radiusMiles: NEAR_ME_RADIUS_MILES,
  };
}
