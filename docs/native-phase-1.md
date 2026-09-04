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

## Verification required before production deployment

- [ ] Compare the live Supabase schema and every existing policy with the
      migration; remove any older permissive policies before deployment
- [ ] Apply the migration in a development Supabase project
- [ ] Test anonymous-to-existing-account transfer with real sessions
- [ ] Test Ticketmaster save/remove behavior with RLS enabled
- [ ] Confirm the Vercel secret names match `.env.example`

## Product decisions still open

- [ ] Choose the permanent name: `Concert Finder` or `My Shows`
- [ ] Approve the first native release scope

## Deferred until later phases

- Pagination beyond the first 20 Ticketmaster events
- Durable, distributed rate-limit counters for higher traffic
- A durable distributed notification queue for traffic beyond the current
  bounded serverless worker
- Location, push notifications, calendar access, deep links, and native sharing
