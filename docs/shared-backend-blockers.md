# Shared-backend blockers (dev only)

This note records the RLS and transactional-import fixes in
`supabase/migrations/20260905000000_transactional_imports_and_rls.sql`.
They close gaps from the prior shared-backend audit.

## Do not apply to production

Apply this migration on a **development** Supabase project first. Never run
`supabase db push`, the SQL editor, or `apply_migration` against production
Concert Finder (`cihldmomtbunpdrsbrms`) as part of this change.

Production already has a live schema. Its migration history still needs a
separate, deliberate reconciliation before any of these statements are
considered there.

## Public listings / RLS

- The public listings grid (`loadConcerts`) now filters `is_published = true`,
  so an author's drafts cannot appear next to published community shows.
  `loadOwnConcerts` still loads that author's drafts and published rows.
- `anon` is revoked from leftover `concerts` table privileges, then granted
  `SELECT` only (with `authenticated`).
- `saved_items` and `saved_events` `FOR ALL` policies are split per command.
  Clients may insert/delete `saved_items` (the watch-state trigger is
  insert/delete). They may not `UPDATE` `saved_items`. `saved_events` keeps
  `UPDATE` so event-snapshot upserts still work.

## RPC grants (re-asserted)

| Function | Who may execute |
|---|---|
| `merge_anonymous_account_data` | `service_role` only |
| `get_ticketmaster_watch_batch` | `service_role` only |
| `apply_ticketmaster_watch_check` | `service_role` only |
| `sync_ticketmaster_watch_state` | revoked from `anon` and `authenticated` |
| `mark_ticketmaster_watch_state_seen` | `authenticated`, scoped to `auth.uid()` |

## Transactional watch writes

- `ticketmaster_watch_state.initialized_at` is nullable. The follow trigger
  writes `null` for never-checked rows, and never-checked rows (`last_checked_at`
  is null) are backfilled to `null`.
- Cron updates go through `apply_ticketmaster_watch_check`, which takes a
  `pg_advisory_xact_lock` and applies the baseline or merged IDs in one
  transaction.
- `merge_anonymous_account_data` takes advisory locks on both user IDs and
  treats a null `initialized_at` as "never checked" instead of letting
  `LEAST(ts, null)` wipe the other side's baseline.
