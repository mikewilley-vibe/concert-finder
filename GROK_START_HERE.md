# Concert Finder — Grok handoff

## Goal

Turn the existing Concert Finder website into a clean Expo/React Native app
without wrapping the website in a WebView. Keep this Next.js project as the
website, secure Ticketmaster API gateway, Supabase-backed service, cron worker,
and future administration interface.

Original repository: <https://github.com/mikewilley-vibe/concert-finder>

The files in this package include a completed **first Phase 1 stabilization
pass** that has not yet been pushed, deployed, or applied to the live database.
Treat the packaged files—not the original GitHub main branch—as the current
source of truth.

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

## Verification already completed

All of these passed immediately before packaging:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

The test suite currently has three passing tests. The Next.js production build
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
- Keep Ticketmaster requests server-side. The future native app should call the
  versioned Vercel API, not Ticketmaster directly.
- Preserve owner-only access to follows, saved events, watch state, and drafts.
- Do not apply the additive migration blindly to production; its comments and
  README explicitly require comparison with the existing live schema first.
- Do not push or deploy without the user's approval.

## Product decisions still needed

1. Permanent customer-facing name: **Concert Finder** or **My Shows**
2. Approval of the proposed first native release in `docs/native-mvp.md`

The recommended 1.0 keeps community submission and moderation on the website
while the native app focuses on discovering, following, saving, and tracking
Ticketmaster concerts.

## Important files

- `docs/native-phase-1.md` — Phase 1 status and remaining verification
- `docs/native-mvp.md` — recommended native screens, scope, and acceptance path
- `supabase/audit/current-security.sql` — read-only live database inventory
- `supabase/migrations/20260903000000_initial_schema.sql` — proposed baseline
- `lib/supabase/database.types.ts` — typed database contract
- `lib/saved-events.ts` — Ticketmaster saved-event operations
- `lib/account-transfer.ts` — browser-side transfer handoff
- `app/api/account/merge-anonymous/route.ts` — verified server transfer endpoint
- `lib/api-rate-limit.ts` — current application-level throttling
- `tests/core-logic.test.mjs` — initial automated tests

## Requested next action for Grok

Package tests/`tsc` were repaired, the live audit was completed, and the
migration was reconciled to the live schema (not applied). Next approved step
should be applying that migration on a **development** Supabase project and
testing RLS / saves / anonymous transfer there. Do not push, deploy, begin
Expo, or apply the migration to production without explicit user approval.
