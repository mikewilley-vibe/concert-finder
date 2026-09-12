export const MAX_MONITORED_FOLLOWS = 50;

export function isAtMonitoredFollowLimit(followCount: number) {
  return followCount >= MAX_MONITORED_FOLLOWS;
}

export function maxMonitoredFollowsMessage() {
  return `Automatic tracking currently supports up to ${MAX_MONITORED_FOLLOWS} artists and venues combined. Unfollow one before adding another.`;
}
