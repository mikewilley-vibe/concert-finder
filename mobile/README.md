# Local Shows

Expo / React Native client for Concert Finder. Display name is **Local Shows**.

The Next.js website at the repository root stays the public site, Ticketmaster
gateway, Supabase-backed service, and community submission UI. The app does
**not** wrap that site in a WebView.

Product scope: [`docs/native-mvp.md`](../docs/native-mvp.md).

## Run

```bash
cd mobile
cp .env.example .env
# Add publishable Supabase values. Leave secrets off this machine.
npx expo start
```

Then open Expo Go, an emulator, or the web target from the CLI.

Ticketmaster search from Expo web on localhost may fail CORS. Native
iOS/Android builds do not use CORS. Point `EXPO_PUBLIC_API_BASE_URL` at a
same-origin host if you need the web target to search.

```bash
npm run typecheck
```

## Environment

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Website origin for the versioned `/api/v1` routes. Defaults to the production site. |
| `EXPO_PUBLIC_SUPABASE_URL` | Publishable Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable / anon key only |

Ticketmaster, cron, and the Supabase secret key stay on the Vercel app. Do not
put `TICKETMASTER_API_KEY`, `SUPABASE_SECRET_KEY`, or `CRON_SECRET` in Expo
config, app code, `.env`, logs, or examples.

## What works now

- **Discover** — artist and venue search through the website Ticketmaster
  proxy, with loading / empty / error / retry
- **Follow / unfollow** — `saved_items` rows (`ticketmaster_attraction` /
  `ticketmaster_venue`) under RLS
- **Save / remove** — Ticketmaster concerts in `saved_events` using Phase 1
  live columns only (no Phase 2 `venue_id` / `date_status` / `attractions`)
- **Home** — upcoming shows for follows, plus a new-show inbox when
  `ticketmaster_watch_state.new_event_ids` is readable
- **Saved** — saved events and follows with remove actions
- **Profile** — guest bootstrap, email/password sign-in and sign-up, sign-out,
  password recovery (reset finishes on the website), and merge-anonymous after
  permanent sign-in
- Concert, artist, and venue stack screens with follow/save and Ticketmaster
  links
- Two-step permanent account deletion through the authenticated website API

Push, location radius, calendar, and community submission are not in the app.
Auth sessions still use AsyncStorage until `expo-secure-store` can be added and
verified in a device build.

## What this client talks to

- Fetch helpers in `lib/api.ts` aimed at the website API
- Browser/mobile Supabase client in `lib/supabase.ts` (publishable key only)
- Anonymous session bootstrap and merge helpers in `lib/auth.ts`
