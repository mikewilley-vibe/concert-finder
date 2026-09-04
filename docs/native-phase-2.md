# Native conversion: Phase 2

Phase 2 prepares the Next.js project to support both the existing website and
the future Expo application. It does not create the Expo project or change the
live deployment.

## Completed locally

- [x] Add shared, platform-neutral API and concert types
- [x] Add a configurable API client that works with relative web URLs or an
      absolute Vercel URL from Expo
- [x] Add versioned `/api/v1` Ticketmaster routes
- [x] Move the website onto the same shared API client the native app will use
- [x] Preserve the original unversioned routes as compatibility endpoints
- [x] Expand event records with timestamps, local date/time, timezone, status,
      sale window, artwork, artist snapshots, ticket link, venue address, and
      venue coordinates
- [x] Add keyword, postal-code, coordinate, radius, page, and page-size inputs
      to event search
- [x] Add a centralized Supabase bearer-token verifier for authenticated server
      operations
- [x] Move anonymous-account transfer to a versioned authenticated endpoint
- [x] Expand saved-event snapshots to retain the native-ready event fields
- [x] Replace the eight-follow ceiling with a least-recently-checked work queue
- [x] Bound each cron run by batch size, concurrency, and time budget
- [x] Add contract, client-error, and worker-batching tests

## Verification still required before deployment

- [ ] Run and reconcile `supabase/audit/current-security.sql` against the live
      Supabase project
- [ ] Review the expanded migration after that comparison
- [ ] Apply the migration to a development Supabase project
- [ ] Test the work-queue RPC and follow trigger with real rows
- [ ] Test saving and loading a complete Ticketmaster event with RLS enabled
- [ ] Smoke-test every `/api/v1` route with the real development Ticketmaster
      key
- [ ] Test account transfer using real anonymous and permanent sessions

## Phase 2 architecture

- `shared/api/v1.ts` is the stable data contract for web and mobile.
- `shared/api/client.ts` is the cross-platform HTTP client.
- `app/api/v1` is the native-ready public API surface.
- `lib/ticketmaster.ts` remains the server-only Ticketmaster adapter.
- Supabase remains the account and user-data system, protected by RLS.
- The Ticketmaster key and Supabase secret remain server-only.

## Gate before Phase 3

Do not scaffold Expo or deploy these database-dependent changes until the live
Supabase audit has been compared with the migration. After the development
database tests pass, Phase 3 can create the Expo Router application and secure
native Supabase session storage.
