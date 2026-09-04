# Native conversion: Phase 2

Phase 2 has started. The customer-facing native app name is **Local Shows**.
The Expo app lives in `mobile/` and uses Expo Router.

The website at the repository root remains Concert Finder / My Shows. It still
owns Ticketmaster proxy routes, Supabase-backed data, cron, and community
concert submission.

## Started in the first Phase 2 scaffold

- [x] Expo SDK app named Local Shows (`slug`: `local-shows`)
- [x] Four-tab navigation: Home, Discover, Saved, Profile
- [x] Stack screens for concert, artist, and venue details
- [x] Thin `lib/api.ts` helpers aimed at `EXPO_PUBLIC_API_BASE_URL`
- [x] Mobile Supabase client using only publishable URL + publishable key
- [x] Anonymous session bootstrap stub (`ensureAnonymousUser`)
- [x] `mobile/.env.example` and `mobile/.gitignore` that keep secrets out

## Not in this scaffold

- Follow, save, and new-show inbox implementations
- Email/password sign-in, recovery, and real account deletion
- Push notifications, location radius, calendar, and sharing
- Community submission UI
- Supabase migrations, Vercel deploys, or EAS builds

## Safety

Ticketmaster stays on the website API. Never put `TICKETMASTER_API_KEY`,
`SUPABASE_SECRET_KEY`, or `CRON_SECRET` in Expo config, app code, committed
`.env` files, logs, or README examples.

See `docs/native-mvp.md` for the version 1.0 acceptance journey.
