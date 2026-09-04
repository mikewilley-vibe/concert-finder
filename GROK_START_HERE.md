# Concert Finder — Grok handoff

## Goal

Turn the existing Concert Finder website into a clean Expo/React Native app
without wrapping the website in a WebView. Keep this Next.js project as the
website, secure Ticketmaster API gateway, Supabase-backed service, cron worker,
and future administration interface.

Original repository: <https://github.com/mikewilley-vibe/concert-finder>

Phase 1 website stabilization and the Phase 2 shared API foundation are in the
repository. The **Local Shows** Expo app is scaffolded in `mobile/`. The
Supabase migrations are still not applied to the live database. Do not treat
unfinished native features as done.

## Work completed in this package

- Removed the three production sample cards
- Fixed the original six lint errors and one warning
- Added a documented Supabase schema and RLS policies
- Added typed Supabase tables and functions
- Added a dedicated `saved_events` model for Ticketmaster events
- Added save/remove controls to Ticketmaster event results
- Added a saved Ticketmaster-shows section
- Added verified anonymous-to-existing-account data transfer
- Replaced broad watch-state updates with a narrow database function
- Added per-client API throttling and five-minute Ticketmaster caching
- Disclosed and enforced the current limit of eight monitored follows
- Added `.env.example` and real project documentation
- Added initial tests for event detection, name matching, and rate limiting
- Defined a recommended four-tab native MVP
- Added shared API v1 contracts and a cross-platform web/Expo client
- Added versioned Ticketmaster and account-transfer endpoints
- Moved the website onto the shared versioned client
- Expanded events and saved snapshots with native-ready time, location,
  coordinate, status, sale, artwork, artist, and ticket fields
- Added keyword, radius, coordinate, and paginated event discovery
- Replaced the eight-follow cap with a bounded rotating cron work queue
- Centralized bearer-token verification for user-specific server operations

## Verification already completed

All of these passed immediately before packaging:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

The test suite currently has eight passing tests. The Next.js production build
includes the new `/api/account/merge-anonymous` route.

## Critical deployment order

Do **not** push or deploy the web changes yet. The new saved-event UI and account
transfer require the database migration first.

1. Run the read-only file `supabase/audit/current-security.sql` in the live
   Supabase SQL Editor.
2. Compare its output with
   `supabase/migrations/20260903000000_initial_schema.sql`.
3. Adjust the additive migration for any differences in the live column types,
   constraints, or existing policy names.
4. Remove any older permissive policies that are not represented safely in the
   migration.
5. Apply the reviewed migration in a development or preview Supabase project.
6. Test RLS ownership, Ticketmaster saving, and anonymous-account transfer with
   real sessions.
7. Only then prepare a commit and deployment.

The database migration has **not** been executed anywhere. No seed rows were
inserted.

## Non-negotiable safety constraints

- Never expose `TICKETMASTER_API_KEY`, `SUPABASE_SECRET_KEY`, or `CRON_SECRET` in
  client code, Expo configuration, logs, screenshots, or commits.
- Do not add or manufacture seed concerts.
- Keep `.env`, `.env.local`, dependencies, build artifacts, and credentials out
  of source control and handoff files.
- Keep Ticketmaster requests server-side. Local Shows must call the Vercel API
  routes, not Ticketmaster Discovery from the device.
- Preserve owner-only access to follows, saved events, watch state, and drafts.
- Do not apply the additive migration blindly to production; its comments and
  README explicitly require comparison with the existing live schema first.
- Do not push or deploy without the user's approval.

## Product decisions

1. Native app name is **Local Shows**. The website remains Concert Finder /
   My Shows until web branding is revisited.
2. Approval of the proposed first native release in `docs/native-mvp.md` is
   still open.

The recommended 1.0 keeps community submission and moderation on the website
while the native app focuses on discovering, following, saving, and tracking
Ticketmaster concerts.

## Important files

- `docs/native-phase-1.md` — Phase 1 status and remaining verification
- `docs/native-phase-2.md` — shared foundation and Expo scaffold status
- `docs/native-mvp.md` — recommended native screens, scope, and acceptance path
- `docs/api-v1.md` — native-ready API routes, request shapes, and limits
- `mobile/README.md` — how to run the Expo app
- `supabase/audit/current-security.sql` — read-only live database inventory
- `supabase/migrations/20260903000000_initial_schema.sql` — proposed baseline
- `lib/supabase/database.types.ts` — typed database contract
- `lib/saved-events.ts` — Ticketmaster saved-event operations
- `lib/account-transfer.ts` — browser-side transfer handoff
- `app/api/account/merge-anonymous/route.ts` — verified server transfer endpoint
- `lib/api-rate-limit.ts` — current application-level throttling
- `tests/core-logic.test.mjs` — initial automated tests

## Phase 2 status

The versioned web/mobile API foundation and the Local Shows Expo navigation
scaffold are both present. The Expo app is still a skeleton: follow/save/inbox,
email auth, push, location, and EAS are not done. See
`docs/native-phase-2.md` and `mobile/README.md`.

## Requested next action

Phase 1 website work is in this repository. The Local Shows Expo scaffold is
the start of the native client. Remaining foundation work still includes applying the
reviewed migration on a **development** Supabase project and testing RLS /
saves / anonymous transfer there. Do not push, deploy, or apply the migration
to production without explicit user approval.
