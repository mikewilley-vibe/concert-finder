import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DISCOVERY_SEEDS_STORAGE_KEY,
  parseDiscoverySeeds,
  rememberDiscoverySeed,
  serializeDiscoverySeeds,
  type DiscoverySeed,
} from "./discovery-seeds";

export async function loadDiscoverySeeds() {
  const raw = await AsyncStorage.getItem(DISCOVERY_SEEDS_STORAGE_KEY);
  return parseDiscoverySeeds(raw);
}

export async function saveDiscoverySeed(
  next: Omit<DiscoverySeed, "savedAt"> & { savedAt?: number },
) {
  const current = await loadDiscoverySeeds();
  const seeds = rememberDiscoverySeed(current, next);
  await AsyncStorage.setItem(
    DISCOVERY_SEEDS_STORAGE_KEY,
    serializeDiscoverySeeds(seeds),
  );
  return seeds;
}
