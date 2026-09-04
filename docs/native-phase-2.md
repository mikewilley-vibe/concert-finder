# Native conversion: Phase 2

Phase 2 prepares the Next.js project to support both the existing website and
the **Local Shows** Expo application. It includes the shared backend contract
and the initial Expo Router scaffold, but does not change the live deployment.

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
- [x] Scaffold the Local Shows Expo SDK app in `mobile/`
- [x] Add four-tab navigation: Home, Discover, Saved, and Profile
- [x] Add concert, artist, and venue detail routes
- [x] Add a native Supabase client using publishable values and secure session
      persistence
- [x] Add anonymous-session bootstrap and account-transfer helpers

## Shared-backend blockers (repository only)

A follow-up additive migration,
`20260905000000_transactional_imports_and_rls.sql`, hardens public-data RLS
and makes cron/account-transfer watch writes transactional. See
`docs/shared-backend-blockers.md`.

Apply that file on a **development** project first. Do not push it to
production Concert Finder (`cihldmomtbunpdrsbrms`). Production migration
history still needs a separate reconciliation.

## Verification still required before deployment

- [x] Run and reconcile `supabase/audit/current-security.sql` against the live
      Supabase project
- [x] Review the expanded migration after that comparison
- [ ] Apply the reviewed migrations to a development Supabase project
      (including `20260905000000_transactional_imports_and_rls.sql`)
- [ ] Test the work-queue RPC, apply RPC, and follow trigger with real rows
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

## Continued in Phase 3

- Follow, save, and new-show inbox implementations are now present
- Email/password sign-in, recovery, account transfer, and account deletion are
  now present
- Push notifications, location radius, calendar, and sharing
- Community submission UI
- Supabase migrations, Vercel deploys, or EAS builds

## Safety

Ticketmaster stays on the website API. Never put `TICKETMASTER_API_KEY`,
`SUPABASE_SECRET_KEY`, or `CRON_SECRET` in Expo config, app code, committed
`.env` files, logs, or README examples.

See `docs/native-mvp.md` for the version 1.0 acceptance journey.

## Gate before database-dependent native features

Apply the reviewed migrations to a development Supabase project and complete
the real-session RLS, save, queue, and account-transfer tests before wiring
those features into the Expo client or deploying the web changes.
