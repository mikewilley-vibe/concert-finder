# Native conversion: Phase 3

Phase 3 turns the Local Shows scaffold into a usable native core while keeping
Ticketmaster secrets and privileged Supabase operations on the Next.js server.

## Implemented

- [x] Anonymous session bootstrap
- [x] Artist and venue search through `/api/v1`
- [x] Follow and unfollow artists and venues under RLS
- [x] Upcoming shows for followed items
- [x] Concert detail screens and Ticketmaster links
- [x] Save and remove Ticketmaster concerts
- [x] Saved concerts and followed-items management
- [x] New-show inbox and mark-as-seen behavior
- [x] Email/password account creation, sign-in, sign-out, and recovery handoff
- [x] Anonymous-to-permanent account transfer
- [x] Two-step in-app permanent account deletion through an authenticated
      server endpoint

## Verification before a device build

- [ ] Apply the reviewed migrations to a development Supabase project
- [ ] Complete real-session RLS, save, watch-state, transfer, and deletion tests
- [ ] Add the public Supabase values to an uncommitted `mobile/.env`
- [ ] Test the release journey on an iPhone through Expo Go or a development
      build

## Still deferred

- Encrypted native auth-token storage (`expo-secure-store` could not be added in
  the current environment; AsyncStorage remains in use)
- Current-location and radius UI
- Push notification delivery in Expo Go
- Calendar and native sharing
- EAS development and production builds (config is started; first device
  build still needs `eas init` and Apple/Google credentials)

Source now includes Profile opt-in, `push_tokens` storage, and Expo Push
sends from the daily check-shows cron. Apply
`supabase/migrations/20260908180459_push_tokens.sql` on a **development**
Supabase project first. Do not apply it to production Concert Finder as part
of this change.

No migration is applied by these source changes.

## Device token claim (second account on one phone)

A later additive migration, `20260912120000_claim_device_push_token.sql`,
adds `public.claim_device_push_token`. Table RLS is unchanged. The helper
lets the signed-in user take over the Expo token this device presents when
that token was previously stored under a different user.

Apply that migration to the Supabase project the app uses before expecting
the Profile toggle to succeed across accounts. The client change is JS-only
(RPC + clearer errors). It does **not** need a native rebuild. A TestFlight
binary that already includes Expo Notifications can pick it up via an EAS
Update, or the next JS bundle in a store/TestFlight build.

### Re-test on one device

1. Apply `20260912120000_claim_device_push_token.sql` to the target
   Supabase project (dev first; production Concert Finder only after review).
2. On a ShowSignal device build, sign in as account A and turn on new-show
   push alerts. Confirm Profile says alerts are on.
3. Sign out, sign in as account B on the same phone, and turn on push
   alerts again. This must succeed (no generic “Try again”).
4. Confirm account B’s Profile shows alerts on. Account A should no longer
   have that device token (one Expo token maps to one user).
5. If enable fails, Profile should show a specific reason: notification
   permission, missing Expo `projectId`, `getExpoPushTokenAsync` error, or
   a Supabase code/message — not only “Could not turn on push alerts.”
