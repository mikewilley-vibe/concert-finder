import { useEffect, useState } from "react";

import {
  dismissFavoritesOnboarding,
  ensureFavoritesOnboardingLoaded,
  isFavoritesOnboardingDismissed,
  isFavoritesOnboardingReady,
  subscribeFavoritesOnboarding,
} from "@/lib/favorites-onboarding-store";

export function useFavoritesOnboarding() {
  const [dismissed, setDismissed] = useState(isFavoritesOnboardingDismissed);
  const [ready, setReady] = useState(isFavoritesOnboardingReady);

  useEffect(() => {
    const sync = () => {
      setDismissed(isFavoritesOnboardingDismissed());
      setReady(isFavoritesOnboardingReady());
    };
    const unsubscribe = subscribeFavoritesOnboarding(sync);
    sync();
    void ensureFavoritesOnboardingLoaded();
    return unsubscribe;
  }, []);

  return {
    dismissed,
    ready,
    dismiss: dismissFavoritesOnboarding,
  };
}
