# Local Shows

Expo / React Native client for Concert Finder. Display name is **Local Shows**.
This is a Phase 2 navigation scaffold — tabs, detail stacks, and thin API/auth
clients — not the finished native 1.0.

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
| `EXPO_PUBLIC_API_BASE_URL` | Website origin for `/api/ticketmaster/*` and `/api/account/merge-anonymous`. Defaults to the production site. |
| `EXPO_PUBLIC_SUPABASE_URL` | Publishable Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable / anon key only |

Ticketmaster, cron, and the Supabase secret key stay on the Vercel app. Do not
put `TICKETMASTER_API_KEY`, `SUPABASE_SECRET_KEY`, or `CRON_SECRET` in Expo
config, app code, `.env`, logs, or examples.

## What this scaffold includes

- Four tabs: Home, Discover, Saved, Profile
- Stack screens for concert, artist, and venue details
- Fetch helpers in `lib/api.ts` aimed at the website API
- Browser/mobile Supabase client in `lib/supabase.ts`
- Anonymous session bootstrap in `lib/auth.ts`

Community concert submission is website-only.
