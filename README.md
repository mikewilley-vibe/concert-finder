# Concert Finder web service

Concert Finder is a Next.js web application for following Ticketmaster artists
and venues, finding upcoming shows, saving events, and submitting community
concert listings. This repository will remain the web, administration, cron,
and secure API service when the Expo mobile client is added.

The customer-facing name is still **My Shows** in the current interface. The
final choice between **My Shows** and **Concert Finder** is intentionally left
open until branding is selected.

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
| `SUPABASE_SECRET_KEY` | Server-only account transfer and cron work |
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

## Commands

```bash
npm run dev
npm run lint
npm test
npm run build
```

## Current product limits

- Automatic new-show checking supports eight followed artists and venues
  combined and now discloses that limit in the interface.
- Ticketmaster event queries currently return the first 20 matching events.
- Push notifications, location discovery, and the Expo client are later native
  phases.
