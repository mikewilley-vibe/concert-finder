# Concert Finder API v1

The website uses this contract now. The future Expo app can use the same client
by passing its deployed API origin to `createConcertFinderApiClient`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/ticketmaster/attractions?keyword=` | Artist search and typo suggestions |
| `GET` | `/api/v1/ticketmaster/venues?keyword=` | Venue search |
| `POST` | `/api/v1/ticketmaster/events` | Event discovery, followed-item shows, location, and pagination |
| `POST` | `/api/v1/ticketmaster/recommendations` | Related artists and venues from upcoming genre-matched events |
| `GET` | `/api/v1/ticketmaster/event-details?ids=` | Details for up to eight event IDs |
| `POST` | `/api/v1/account/merge-anonymous` | Authenticated anonymous-account transfer |

Every response contains `apiVersion`, either `data` or `error`, and a
`meta.requestId` for troubleshooting. User-specific server operations require a
Supabase access token in `Authorization: Bearer <token>`.

## Event search

The request body can combine followed artist/venue references with a keyword
and location. A keyword or location can also be used alone for Discover.

```json
{
  "keyword": "indie rock",
  "location": {
    "latitude": 37.5407,
    "longitude": -77.436,
    "radiusMiles": 75
  },
  "page": 0,
  "pageSize": 20
}
```

Postal-code search is also supported:

```json
{
  "attractions": [{ "id": "artist-id", "label": "Artist name" }],
  "location": { "postalCode": "23220", "radiusMiles": 50 }
}
```

Limits are 25 followed references per request, 50 events per page, and pages 0
through 49. Location coordinates are sent in a `POST` body rather than a URL.

A **single** followed artist or venue with no location (artist/venue detail) is
collected across up to four Ticketmaster pages (200 events) so the listing is
not truncated to the first page or Home’s “next date only” view. If a venue id
returns no upcoming events, the API retries with the venue name as a keyword
and keeps dates whose venue id or name matches. That covers Ticketmaster
partner/alias venue ids that do not work with `venueId`.

### Ticketmaster location quirks

Ticketmaster Discovery `postalCode` is an **exact venue-zip text match**, not a
center point for `radius`. Official docs: “This is text-based search, not
location-based search. Use lat/long + radius search for nearby events.”

That is why Home showed “Within 250 miles of 23505” with no results for
followed attraction `Z7r9jZa4W_` (One Irish Rover) while the same query without
location returned event `Z7r9jZ1A7J3Q3` at The National, Richmond VA 23219
(~80–90 miles from Norfolk 23505). Sending `postalCode=23505&radius=250` (or
even 500) dropped the show. The same request with Norfolk `latlong` + `radius`
returned it.

This API therefore:

1. Geocodes a postal-only home location (Zippopotam, cached) to coordinates.
2. Queries Ticketmaster with `latlong` + `radius` + `unit=miles`, never
   `postalCode`, when a radius search is intended.
3. Applies a local haversine filter on venue coordinates.
4. If a followed-artist/venue search still comes back empty after Ticketmaster
   geo-filtering, refetches **without** TM location params and keeps events
   whose venue coordinates are inside the requested radius. Events with no
   venue coordinates are kept so a missing geo field cannot wipe a match.

`latlong` itself is marked deprecated on Discovery in favor of `geoPoint`
(geohash). It still works for this product path; if TM removes it, resolve the
origin the same way and switch the query param, keeping the local filter.

## Related artists and venues

`POST /api/v1/ticketmaster/recommendations` accepts recent seed artists (Ticketmaster
genre/subgenre IDs), IDs to exclude, and an optional home location. The server
looks up upcoming **music** events for that genre (at most two Ticketmaster
event searches, cached for five minutes) and returns up to six artists and six
venues. If a seed has no genre IDs, the response is empty rather than invented
matches. This endpoint is rate-limited like other Ticketmaster routes.

```json
{
  "seeds": [
    {
      "id": "K8vZ9171J7f",
      "label": "Phish",
      "genreId": "KnvZfZ7vAv6",
      "genreName": "Rock",
      "subGenreId": "KnvZfZ7vAev",
      "subGenreName": "Pop"
    }
  ],
  "excludeAttractionIds": ["K8vZ9171J7f"],
  "excludeVenueIds": [],
  "location": { "postalCode": "23220", "radiusMiles": 50 }
}
```

## Expo configuration

The future mobile client will instantiate the shared client with an absolute
URL:

```ts
const api = createConcertFinderApiClient({
  baseUrl: process.env.EXPO_PUBLIC_CONCERT_FINDER_API_URL,
});
```

The API URL is public configuration. Ticketmaster and Supabase secret keys must
never be placed in Expo environment variables.
