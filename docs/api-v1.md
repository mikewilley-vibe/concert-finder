# Concert Finder API v1

The website uses this contract now. The future Expo app can use the same client
by passing its deployed API origin to `createConcertFinderApiClient`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/ticketmaster/attractions?keyword=` | Artist search and typo suggestions |
| `GET` | `/api/v1/ticketmaster/venues?keyword=` | Venue search |
| `POST` | `/api/v1/ticketmaster/events` | Event discovery, followed-item shows, location, and pagination |
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
