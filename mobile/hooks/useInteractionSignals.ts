import { useCallback, useEffect, useState } from "react";

import {
  applyInteraction,
  type AttendanceSignalStatus,
  type InteractionKind,
  type InteractionSignals,
} from "@/lib/interaction-signals";
import {
  ensureInteractionSignalsLoaded,
  getInteractionSignals,
  isInteractionSignalsReady,
  recordInteraction,
  subscribeInteractionSignals,
} from "@/lib/interaction-signals-store";

export function useInteractionSignals() {
  const [signals, setSignals] = useState<InteractionSignals>(getInteractionSignals);
  const [ready, setReady] = useState(isInteractionSignalsReady);

  useEffect(() => {
    const sync = () => {
      setSignals(getInteractionSignals());
      setReady(isInteractionSignalsReady());
    };
    const unsubscribe = subscribeInteractionSignals(sync);
    sync();
    void ensureInteractionSignalsLoaded();
    return unsubscribe;
  }, []);

  const track = useCallback(
    async (input: {
      kind: InteractionKind;
      eventId: string;
      artistIds?: readonly string[];
      venueId?: string | null;
      genreIds?: readonly string[];
      fromStatus?: AttendanceSignalStatus;
      toStatus?: AttendanceSignalStatus;
    }) => {
      setSignals((current) => applyInteraction(current, input));
      await recordInteraction(input);
    },
    [],
  );

  return { signals, ready, track };
}
