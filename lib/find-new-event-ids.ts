function uniqueIds(ids: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const raw of ids) {
    const id = raw.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    unique.push(id);
  }

  return unique;
}

export function findNewEventIds(knownIds: string[], currentIds: string[]) {
  const known = new Set(uniqueIds(knownIds));
  const discovered: string[] = [];

  for (const id of uniqueIds(currentIds)) {
    if (known.has(id)) {
      continue;
    }
    known.add(id);
    discovered.push(id);
  }

  return discovered;
}

export function mergeEventIds(existingIds: string[], additions: string[]) {
  return uniqueIds([...existingIds, ...additions]);
}
