# Concert Finder web service

Concert Finder is a Next.js web application for following Ticketmaster artists
and venues, finding upcoming shows, saving events, and submitting community
concert listings. This repository will remain the web, administration, cron,
and secure API service when the Expo mobile client is added.

The website interface still says **My Shows**. The Expo client in `mobile/`
is named **Local Shows**. Community concert submission stays on the website.

## Stack

- Next.js 16 App Router, React 19, and TypeScript
- Supabase authentication and PostgreSQL
- Ticketmaster Discovery API (server-side only)
- Vercel hosting and a daily cron route

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Add your own development values. Never commit `.env.local`.
4. Apply the Supabase migrations in `supabase/migrations` to a development
   project.
5. Run `npm run dev` and open <http://localhost:3002>.

Required configuration:

| Variable | Where used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser; protected by RLS |
| `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` | Server-only account deletion, transfer, and cron work |
| `TICKETMASTER_API_KEY` | Server-only Ticketmaster requests |
| `CRON_SECRET` | Protects the scheduled show-check route |

## Database and security

`supabase/migrations/20260903000000_initial_schema.sql` documents the expected
tables, indexes, ownership rules, and Row Level Security policies. It includes:

- Published community concerts with owner-only draft management
- Owner-only followed artists and venues
- A dedicated `saved_events` table for Ticketmaster event snapshots
- Owner-only notification state
- A narrow function for marking notification rows as seen
- A server-only function for transferring an anonymous user's data after the
  user proves control of both the anonymous and permanent sessions

The migration is additive because the deployed prototype already has tables.
Inspect the live project's existing policies before applying it there; policies
with different names are not removed automatically.

## API protection

All public Ticketmaster routes have fixed-window, per-client rate limits.
Ticketmaster responses are cached for five minutes to reduce quota use. The
in-process limiter protects each warm server instance; move the counter to a
shared durable store before traffic grows across many server instances.

The Ticketmaster API key and Supabase secret key must never be sent to either
the website browser bundle or the future Expo application.

## Shared web and mobile API

The versioned API contract is defined in `shared/api/v1.ts`, and the
cross-platform client is in `shared/api/client.ts`. The existing website now
uses `/api/v1`; the original Ticketmaster routes remain as compatibility
endpoints. See `docs/api-v1.md` for request shapes and limits.

Event responses include native-ready timing, timezone, status, sale, artwork,
artist, venue-address, and coordinate fields. Event discovery accepts keyword,
postal code, latitude/longitude, radius, and pagination inputs.

## Commands

```bash
npm run dev
npm run lint
npm test
npm run build
```

## Current product limits

- A cron run selects up to 40 least-recently checked follows, processes four at
  a time, and stops before the serverless time limit. Later runs continue with
  the oldest unchecked records.
- Event-search requests accept up to 50 results per page and expose `hasMore`
  and `nextPage` metadata.
- A single event request accepts up to 25 followed artist/venue references.
- Native location permission/UI, push notifications, calendar, and sharing are
  later native work. The shared API already accepts postal or coordinate radius
  searches, and the Local Shows Expo scaffold lives in `mobile/`.
