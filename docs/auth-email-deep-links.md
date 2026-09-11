# ShowSignal auth email deep links

Confirmation, email-change, and password-recovery emails should open the
native ShowSignal app when it is installed, then establish the Supabase
session there. The website remains the fallback when the app is missing.

## How the link works

1. The Expo client sends `emailRedirectTo` /
   `resetPasswordForEmail.redirectTo` as
   `https://<web-origin>/auth/callback`.
2. The user taps Confirm in the email. The message still goes through
   Supabase Auth (`…/auth/v1/verify…`), which then redirects to that HTTPS
   URL with a PKCE `code`, `token_hash`, or implicit tokens.
3. On a phone with a current TestFlight / App Store build that includes
   Associated Domains, iOS can open ShowSignal directly (Universal Link).
4. If the link lands in Safari instead, `/auth/callback` immediately tries
   `showsignal://auth/callback?…` so the installed app can still take over.
5. The app exchanges the code or tokens and updates the session. Recovery
   links land on Profile so the user can set a new password.

Website-initiated account emails still use `/account`. That page completes
the session in the browser, then offers **Open ShowSignal** if the URL still
has auth parameters the web client could not consume (typical for emails
started from the app).

## Supabase Auth URL Configuration

Do this in the **Concert Finder** project (`cihldmomtbunpdrsbrms`). Do not
change Local Buzz or other projects.

Authentication → URL Configuration:

| Setting | Value |
|---|---|
| Site URL | `https://concert-finder-eta.vercel.app` |
| Additional Redirect URLs | see list below |

Add every line:

```
https://concert-finder-eta.vercel.app/auth/callback
https://concert-finder-eta.vercel.app/**
showsignal://auth/callback
showsignal://**
```

Development project only (not production Concert Finder):

```
https://concert-finder-dev.vercel.app/auth/callback
https://concert-finder-dev.vercel.app/**
```

Keep temporary Vercel preview URLs out of the allowlist. They may be
login-protected and will break email redirects.

A dashboard change is required for production emails to accept
`/auth/callback`. Shipping this code without the allowlist update will make
new app-originated confirmation emails fail with a redirect error.

## New native build

`associatedDomains` and Android App Link intent filters are native
entitlements. A new EAS production / TestFlight binary is required after
this change. JS-only updates cannot register Universal Links.

```bash
cd mobile
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --profile production
```

Until that binary is installed, email links still open Safari, and the
website page should hand off through `showsignal://` (already in the current
scheme).

## Device test plan

1. Add the redirect URLs above on the matching Supabase project.
2. Deploy the website so `https://concert-finder-eta.vercel.app/auth/callback`
   and `/.well-known/apple-app-site-association` are live.
3. Confirm the association file is JSON, HTTPS, and not a login redirect:
   `https://concert-finder-eta.vercel.app/.well-known/apple-app-site-association`
4. Install a **new** iOS build that includes Associated Domains.
5. In ShowSignal, send a verification email from Profile.
6. Open the email **on that phone** and tap Confirm.
7. Expected: ShowSignal comes to the foreground and Profile shows the
   confirmed account (then the create-password form if needed).
8. Repeat with a password reset email.
9. On a phone without the app, the same HTTPS link should stay on the
   website bridge page.

Apple caches the AASA file at install / App Store update time. Changing
paths later requires another store update.

## Android App Links

`mobile/app.json` already declares HTTPS intent filters. `assetlinks.json`
is hosted at `/.well-known/assetlinks.json`. Digital Asset Links stay
empty until you set `ANDROID_APP_LINK_SHA256` on Vercel to the Play /
upload-key SHA-256 fingerprint (comma-separated if you have more than one).

```bash
# After an Android keystore exists in EAS:
npx eas-cli@latest credentials -p android
```

## Why emails were finishing on the website

Mobile sign-up and reset previously used `EXPO_PUBLIC_WEB_BASE_URL` +
`/account`. That is a normal website page, and the Expo client had
`detectSessionInUrl: false` with no inbound URL handler. Confirming from
Mail/Safari therefore completed only in the browser.
