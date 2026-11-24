import assert from "node:assert/strict";
import test from "node:test";

import {
  NEAR_ME_RADIUS_MILES,
  formatDistanceMiles,
  isShowWithinRadius,
  showDistanceLabel,
  showDistanceMiles,
  venueCoordinates,
} from "../mobile/lib/geo.ts";
import {
  filterShowsByDate,
  showMatchesDateFilter,
  weekendBounds,
} from "../mobile/lib/show-date-filter.ts";
import {
  applyShowListFilters,
  readShowListFilters,
  rememberShowListFilters,
} from "../mobile/lib/show-list-filters.ts";
import { cardFollowArtist } from "../mobile/lib/show-follow.ts";

const TUESDAY = new Date(2026, 10, 24, 15, 30, 0);
const FRIDAY = new Date(2026, 10, 27, 9, 0, 0);
const SATURDAY = new Date(2026, 10, 28, 21, 0, 0);
const SUNDAY = new Date(2026, 10, 29, 11, 0, 0);
const MONDAY = new Date(2026, 10, 23, 8, 0, 0);

function dated(localDate) {
  return { localDate, startsAt: null };
}

test("weekend window is the coming Friday through Sunday before the weekend", () => {
  assert.equal(TUESDAY.getDay(), 2);
  assert.equal(MONDAY.getDay(), 1);
  assert.deepEqual(weekendBounds(TUESDAY), {
    start: "2026-11-27",
    end: "2026-11-29",
  });
  assert.deepEqual(weekendBounds(MONDAY), {
    start: "2026-11-27",
    end: "2026-11-29",
  });
});

test("weekend window starts today once Friday, Saturday, or Sunday has begun", () => {
  assert.equal(FRIDAY.getDay(), 5);
  assert.equal(SATURDAY.getDay(), 6);
  assert.equal(SUNDAY.getDay(), 0);
  assert.deepEqual(weekendBounds(FRIDAY), {
    start: "2026-11-27",
    end: "2026-11-29",
  });
  assert.deepEqual(weekendBounds(SATURDAY), {
    start: "2026-11-28",
    end: "2026-11-29",
  });
  assert.deepEqual(weekendBounds(SUNDAY), {
    start: "2026-11-29",
    end: "2026-11-29",
  });
});

test("date filter keeps all shows, the weekend window, or the next 30 days", () => {
  const shows = [
    dated("2026-11-23"),
    dated("2026-11-24"),
    dated("2026-11-26"),
    dated("2026-11-27"),
    dated("2026-11-29"),
    dated("2026-12-23"),
    dated("2026-12-24"),
  ];

  assert.deepEqual(
    filterShowsByDate(shows, "all", TUESDAY).map((show) => show.localDate),
    shows.map((show) => show.localDate),
  );
  assert.deepEqual(
    filterShowsByDate(shows, "weekend", TUESDAY).map((show) => show.localDate),
    ["2026-11-27", "2026-11-29"],
  );
  assert.deepEqual(
    filterShowsByDate(shows, "weekend", SUNDAY).map((show) => show.localDate),
    ["2026-11-29"],
  );
  assert.equal(showMatchesDateFilter(dated("2026-11-24"), "next30", TUESDAY), true);
  assert.equal(showMatchesDateFilter(dated("2026-12-23"), "next30", TUESDAY), true);
  assert.equal(showMatchesDateFilter(dated("2026-12-24"), "next30", TUESDAY), false);
  assert.equal(showMatchesDateFilter(dated("2026-11-23"), "next30", TUESDAY), false);
  assert.deepEqual(
    filterShowsByDate(shows, "next30", TUESDAY).map((show) => show.localDate),
    ["2026-11-24", "2026-11-26", "2026-11-27", "2026-11-29", "2026-12-23"],
  );
});

test("date filter prefers a local date over a timestamp", () => {
  const show = {
    localDate: "2026-11-28",
    startsAt: "2026-12-01T05:00:00Z",
  };
  assert.equal(showMatchesDateFilter(show, "weekend", TUESDAY), true);
});

test("distance labels use miles and hide when coordinates are missing", () => {
  const origin = { latitude: 37.54, longitude: -77.44 };
  assert.equal(formatDistanceMiles(12.4), "12 mi");
  assert.equal(formatDistanceMiles(0.2), "Under 1 mi");
  assert.equal(NEAR_ME_RADIUS_MILES, 50);
  assert.equal(venueCoordinates({ venueLatitude: 91, venueLongitude: 0 }), null);
  assert.equal(
    showDistanceMiles({ venueLatitude: null, venueLongitude: -77.44 }, origin),
    null,
  );
  assert.equal(showDistanceLabel({ venueLongitude: -77.44 }, origin), null);

  const here = { venueLatitude: origin.latitude, venueLongitude: origin.longitude };
  assert.equal(showDistanceLabel(here, origin), "Under 1 mi");
  assert.equal(isShowWithinRadius(here, origin, NEAR_ME_RADIUS_MILES), true);

  const close = { venueLatitude: origin.latitude + 0.1, venueLongitude: origin.longitude };
  const far = { venueLatitude: origin.latitude + 2, venueLongitude: origin.longitude };
  const closeMiles = showDistanceMiles(close, origin);
  const farMiles = showDistanceMiles(far, origin);
  assert.ok(closeMiles != null && closeMiles < NEAR_ME_RADIUS_MILES);
  assert.ok(farMiles != null && farMiles > NEAR_ME_RADIUS_MILES);
  assert.equal(showDistanceLabel(close, origin), formatDistanceMiles(closeMiles));
  assert.equal(isShowWithinRadius(close, origin, NEAR_ME_RADIUS_MILES), true);
  assert.equal(isShowWithinRadius(far, origin, NEAR_ME_RADIUS_MILES), false);
  assert.equal(showDistanceLabel(close, null), null);
});

test("near me hides shows beyond 50 miles and shows with no venue coordinates", () => {
  const origin = { latitude: 37.54, longitude: -77.44 };
  const shows = [
    {
      id: "close",
      localDate: "2026-11-28",
      venueLatitude: origin.latitude + 0.05,
      venueLongitude: origin.longitude,
    },
    {
      id: "far",
      localDate: "2026-11-28",
      venueLatitude: origin.latitude + 2,
      venueLongitude: origin.longitude,
    },
    {
      id: "unknown",
      localDate: "2026-11-28",
      venueLatitude: null,
      venueLongitude: null,
    },
    {
      id: "next-month",
      localDate: "2026-12-20",
      venueLatitude: origin.latitude,
      venueLongitude: origin.longitude,
    },
  ];

  const nearWeekend = applyShowListFilters(shows, {
    dateFilter: "weekend",
    nearMe: true,
    origin,
    now: TUESDAY,
  });
  assert.deepEqual(
    nearWeekend.shows.map((show) => show.id),
    ["close"],
  );
  assert.equal(nearWeekend.hiddenForDistance, 1);
  assert.equal(nearWeekend.hiddenWithoutCoordinates, 1);
  assert.equal(nearWeekend.nearMeApplied, true);

  const datedOnly = applyShowListFilters(shows, {
    dateFilter: "next30",
    nearMe: false,
    origin,
    now: TUESDAY,
  });
  assert.deepEqual(
    datedOnly.shows.map((show) => show.id),
    ["close", "far", "unknown", "next-month"],
  );
  assert.equal(datedOnly.nearMeApplied, false);
});

test("show list filters default to all dates and remember a tab for the session", () => {
  assert.deepEqual(readShowListFilters("artists-test"), {
    dateFilter: "all",
    nearMe: false,
  });
  rememberShowListFilters("artists-test", {
    dateFilter: "weekend",
    nearMe: true,
  });
  rememberShowListFilters("venues-test", {
    dateFilter: "next30",
    nearMe: false,
  });
  assert.deepEqual(readShowListFilters("artists-test"), {
    dateFilter: "weekend",
    nearMe: true,
  });
  assert.deepEqual(readShowListFilters("venues-test"), {
    dateFilter: "next30",
    nearMe: false,
  });
});

test("show card follow targets the preferred artist, then a followed artist", () => {
  const attractions = [
    { id: "headliner", name: "Headliner" },
    { id: "opener", name: "Opener" },
  ];
  assert.deepEqual(
    cardFollowArtist(attractions, ["opener"], null),
    { id: "opener", name: "Opener" },
  );
  assert.deepEqual(
    cardFollowArtist(attractions, ["opener"], "headliner"),
    { id: "headliner", name: "Headliner" },
  );
  assert.equal(cardFollowArtist([{ id: "", name: "Nope" }], [], null), null);
});
