import assert from "node:assert/strict";
import test from "node:test";

import {
  favoriteShowsForView,
  parseFavoriteShowView,
} from "../mobile/lib/favorite-show-views.ts";
import {
  initialFavoriteShowCursors,
  loadFavoriteShowPage,
  mergeFavoriteShowPages,
} from "../mobile/lib/favorite-show-pages.ts";

const NOW = new Date(2026, 8, 15, 12, 0, 0);

function show(id, date, artistId, venueId) {
  return {
    id,
    name: id,
    dateLabel: date,
    localDate: date,
    startsAt: `${date}T23:30:00Z`,
    venueId,
    venueName: venueId,
    city: "Richmond",
    state: "VA",
    attractions: [{ id: artistId, name: artistId }],
    matchedLabels: [],
  };
}

const artistFollows = [
  { item_key: "artist-a", item_label: "Artist A" },
  { item_key: "artist-b", item_label: "Artist B" },
];
const venueFollows = [
  { item_key: "venue-a", item_label: "Venue A" },
  { item_key: "venue-b", item_label: "Venue B" },
];

const shows = [
  show("past", "2026-09-14", "artist-a", "venue-a"),
  show("a-first", "2026-09-16", "artist-a", "venue-a"),
  show("a-later", "2026-09-20", "artist-a", "venue-b"),
  show("b-first", "2026-09-23", "artist-b", "venue-b"),
  show("b-first", "2026-09-23", "artist-b", "venue-b"),
];

test("favorite show views parse unknown values as This Week", () => {
  assert.equal(parseFavoriteShowView("next"), "next");
  assert.equal(parseFavoriteShowView("all"), "week");
  assert.equal(parseFavoriteShowView("something-else"), "week");
});

test("This Week is a rolling seven-day view and removes duplicates", () => {
  const result = favoriteShowsForView({
    kind: "artist",
    view: "week",
    shows,
    follows: artistFollows,
    now: NOW,
  });
  assert.deepEqual(
    result.map((item) => item.id),
    ["a-first", "a-later"],
  );
});

test("Next keeps one chronological show for every followed artist", () => {
  const result = favoriteShowsForView({
    kind: "artist",
    view: "next",
    shows,
    follows: artistFollows,
    now: NOW,
  });
  assert.deepEqual(
    result.map((item) => item.id),
    ["a-first", "b-first"],
  );
});

test("Next keeps one chronological show for every followed venue", () => {
  const result = favoriteShowsForView({
    kind: "venue",
    view: "next",
    shows,
    follows: venueFollows,
    now: NOW,
  });
  assert.deepEqual(
    result.map((item) => item.id),
    ["a-first", "a-later"],
  );
});

test("Next matches a followed venue when Ticketmaster uses a different venue id", () => {
  const alias = {
    ...show("poe", "2026-09-26", "someone", "event-venue"),
    venueName: "The Norva",
  };
  const result = favoriteShowsForView({
    kind: "venue",
    view: "next",
    shows: [alias],
    follows: [{ item_key: "discovery-venue", item_label: "The Norva" }],
    now: NOW,
  });
  assert.deepEqual(
    result.map((item) => item.id),
    ["poe"],
  );
});

test("selecting an artist shows every unique upcoming date for that artist", () => {
  const result = favoriteShowsForView({
    kind: "artist",
    view: "week",
    shows,
    follows: artistFollows,
    selectedFollowKey: "artist-a",
    now: NOW,
  });
  assert.deepEqual(
    result.map((item) => item.id),
    ["a-first", "a-later"],
  );
});

test("selecting a venue shows every unique upcoming date at that venue", () => {
  const result = favoriteShowsForView({
    kind: "venue",
    view: "next",
    shows,
    follows: venueFollows,
    selectedFollowKey: "venue-b",
    now: NOW,
  });
  assert.deepEqual(
    result.map((item) => item.id),
    ["a-later", "b-first"],
  );
});

test("favorite pagination chunks follows and preserves each Ticketmaster cursor", async () => {
  const follows = Array.from({ length: 21 }, (_, index) => ({
    item_key: `artist-${index}`,
    item_label: `Artist ${index}`,
  }));
  const cursors = initialFavoriteShowCursors("artist", follows);
  assert.equal(cursors.length, 2);
  assert.equal(cursors[0].refs.length, 20);
  assert.equal(cursors[1].refs.length, 1);

  const result = await loadFavoriteShowPage({
    kind: "artist",
    cursors,
    search: async (input) => ({
      shows: [
        show(
          `page-${input.attractions[0].id}`,
          "2026-09-24",
          input.attractions[0].id,
          "venue-a",
        ),
      ],
      page: {
        page: input.page,
        pageSize: input.pageSize,
        resultCount: 1,
        hasMore: input.attractions.length > 1,
        nextPage: input.attractions.length > 1 ? 4 : null,
      },
    }),
  });

  assert.equal(result.shows.length, 2);
  assert.deepEqual(
    result.nextCursors.map((cursor) => cursor.page),
    [4],
  );
});

test("favorite pages merge without repeating a concert", () => {
  assert.deepEqual(
    mergeFavoriteShowPages(
      [show("one", "2026-09-20", "artist-a", "venue-a")],
      [
        show("one", "2026-09-20", "artist-a", "venue-a"),
        show("two", "2026-09-21", "artist-b", "venue-b"),
      ],
    ).map((item) => item.id),
    ["one", "two"],
  );
});
