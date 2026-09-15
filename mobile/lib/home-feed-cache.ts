import type { HomeFeed } from "./home-feed";

let remembered: HomeFeed | null = null;

export function rememberHomeFeed(feed: HomeFeed) {
  remembered = feed;
}

export function getRememberedHomeFeed() {
  return remembered;
}
