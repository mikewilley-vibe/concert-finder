import { useEffect, useState } from "react";

import type { InteractionSignals } from "@/lib/interaction-signals";
import type { HomeLocation } from "@/lib/home-location";
import { loadSuggestions, type SuggestionsData } from "@/lib/suggestions";

const EMPTY: SuggestionsData = {
  artists: [],
  venues: [],
  lastfm: "skipped",
};

export function useSuggestionPills(input: {
  enabled: boolean;
  locationKey: string;
  signalsKey: string;
  followsKey: string;
  location: HomeLocation;
  signals: InteractionSignals;
}) {
  const [data, setData] = useState<SuggestionsData>(EMPTY);

  useEffect(() => {
    if (!input.enabled) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void loadSuggestions({
        location: input.location,
        signals: input.signals,
      })
        .then((next) => {
          if (!cancelled) {
            setData(next);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setData(EMPTY);
          }
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input.enabled, input.followsKey, input.location, input.locationKey, input.signals, input.signalsKey]);

  return data;
}
