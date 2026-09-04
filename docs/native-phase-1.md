# Native conversion: Phase 1

## Completed in the first stabilization pass

- [x] Remove production sample cards
- [x] Fix all existing lint errors and warnings
- [x] Add a reproducible Supabase schema and explicit RLS policies
- [x] Add typed Supabase tables and database functions
- [x] Add a dedicated Ticketmaster saved-event model
- [x] Let users save and remove Ticketmaster event results
- [x] Preserve anonymous follows, saves, and drafts when signing in
- [x] Add server-side Ticketmaster request throttling and caching
- [x] Disclose and enforce the current eight-follow tracking limit in the UI
- [x] Add `.env.example` and repository setup documentation
- [x] Add initial tests for matching, event detection, and throttling
- [x] Define the recommended version 1.0 native scope

## Migration reconciliation (2026-09-03)

The packaged migration was rewritten against live project
`cihldmomtbunpdrsbrms` (Concert Finder). It has **not** been applied.

- Keeps `concerts.event_date` as `timestamptz`
- Keeps `concerts.venue` / `city` and label columns nullable where live is
- Drops live policy names before creating replacements
- Preserves permanent-user-only draft update/delete
- Adds missing `user_id` FKs and creates `saved_events` + transfer helpers
- Revokes broad `anon` grants on `saved_items`

## Verification required before production deployment

- [x] Compare the live Supabase schema and every existing policy with the
      migration; remove any older permissive policies before deployment
- [ ] Apply the migration in a development Supabase project
- [ ] Test anonymous-to-existing-account transfer with real sessions
- [ ] Test Ticketmaster save/remove behavior with RLS enabled
- [ ] Confirm the Vercel secret names match `.env.example`

## Product decisions still open

- [x] Native app name: **Local Shows** (website remains Concert Finder / My Shows)
- [ ] Approve the first native release scope in `docs/native-mvp.md`

Phase 2 Expo scaffolding has started in `mobile/`. See `docs/native-phase-2.md`.

## Deferred until later phases

- Pagination beyond the first 20 Ticketmaster events
- Durable, distributed rate-limit counters for higher traffic
- A scalable notification queue beyond the current eight-follow MVP limit
- Location, push notifications, calendar access, deep links, and native sharing
