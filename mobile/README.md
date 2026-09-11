# ShowSignal

Expo / React Native client for Concert Finder. Display name is **ShowSignal**.
The public tagline is **Never miss your next show.**

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

Remote push needs a development or production build, not Expo Go.

First iOS device build (interactive, because Apple has to create signing credentials):

```bash
cd mobile
npx eas-cli@latest build --profile development --platform ios
```

Install the build with the QR code Expo prints, then start Metro with `npx expo start --dev-client`.

Production and preview profiles set `"autoIncrement": true` so EAS bumps the
remote iOS `buildNumber` (and Android `versionCode`) on each build. That
avoids TestFlight rejections when App Store Connect already has the same
version + build, such as `0.1.0` build `3`. The development profile is left
manual.

After this lands, ship a new TestFlight binary with:

```bash
cd mobile
# Once, if EAS remote versions are behind App Store Connect:
# npx eas-cli@latest build:version:set --platform ios
# then initialize iOS with 3 (the last used App Store Connect build).
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production
```

`eas init` writes `extra.eas.projectId` into `app.json`. Apple push credentials
are created during the first iOS build. Android also needs an FCM /
google-services setup before store or device Android push will work.

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
| `EXPO_PUBLIC_WEB_BASE_URL` | Stable public website origin for email verification and password-reset links. Use the development domain with the development Supabase project. |
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
- **Save / remove** — Ticketmaster concerts in `saved_events`
- **Home** — upcoming shows for follows, plus a new-show inbox
- **Saved** — saved events and follows with remove actions
- **Profile** — guest bootstrap, email/password sign-in and sign-up, sign-out,
  password recovery (reset finishes on the website), and merge-anonymous after
  permanent sign-in
- Concert, artist, and venue stack screens with follow/save, share, Ticketmaster
  links, and add to Calendar
- Two-step permanent account deletion through the authenticated website API
- **Push alerts (device build)** — Profile can request notification permission
  and store an Expo push token. The daily show check sends a ping when a
  followed artist or venue gets a new date. This does **not** work in Expo Go.

Community submission stays on the website. Auth sessions still use AsyncStorage
until `expo-secure-store` can be added and verified in a device build.

For development email verification, set the development Supabase project's
Site URL to `https://concert-finder-dev.vercel.app` and allow
`https://concert-finder-dev.vercel.app/**` under Authentication → URL
Configuration. Keep temporary Vercel deployment URLs out of Supabase Auth
redirect settings because Vercel may protect them with a login screen.

## What this client talks to

- Fetch helpers in `lib/api.ts` aimed at the website API
- Browser/mobile Supabase client in `lib/supabase.ts` (publishable key only)
- Anonymous session bootstrap and merge helpers in `lib/auth.ts`
