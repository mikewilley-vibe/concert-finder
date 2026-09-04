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
- Push notifications and notification deep links
- Calendar and native sharing
- EAS development and production builds

No migration is applied by these source changes.
