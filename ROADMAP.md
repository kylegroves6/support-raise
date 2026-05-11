# Support Raising Tracker — Roadmap

## Current State (v0.7 — May 2026)

- Vite + React + TypeScript + Tailwind SPA
- Supabase for database (Postgres), auth, and RLS
- No server-side component — Supabase JS client called directly from React hooks
- Supabase CLI linked for migrations
- Deployed to Vercel; installable as PWA on iOS/Android home screen
- 72 unit tests passing (csvParser + useContacts hook)
- Playwright E2E: 5 golden-path tests written and green against local Supabase
- Sentry initialized with Session Replay (`VITE_SENTRY_DSN` env var — add to Vercel)
- `activity_log` table live in production, accumulating data

### Migration hygiene rule (absolute)
Every schema change must:
1. Be written as a migration file in `supabase/migrations/`
2. Be committed to git alongside the code that depends on it
3. Applied only via `supabase db push` or the Supabase MCP tool
4. Run `supabase migration list` before any push to verify local/remote are in sync

**Known drift:** Remote has an orphan migration `20260510192920` (activity_log applied
out-of-band). It is identical to local `20260510002000_add_activity_log.sql`. No action
needed — schema is correct, just the migration history record is duplicated on remote.

### Known issues / tech debt
- `full_name` column still exists on `contacts` — kept for backwards compat but no longer
  read by the app. Can be dropped in a future cleanup migration once confident.
- Remote migration list has the orphan `20260510192920` entry — cosmetic only.
- Small-screen PWA layout not fully reviewed.

---

## Phase 1 — Complete ✓

Core CRUD, auth, RLS, trips, goals, CSV import/export, additional raising items.

---

## Phase 1.5 — Deployment + Testing ✓

- ✅ Vercel deployment with SPA rewrite rule
- ✅ PWA support
- ✅ Google OAuth + email/password auth
- ✅ Vitest unit tests (72 passing)
- ✅ Playwright E2E: 5 golden-path tests green against local Supabase
- ✅ `.env.example` documents all required env vars
- ⬜ Gate Vercel preview deploys on Playwright passing in CI

---

## Phase 1.6 — Contact model + observability ✓

- ✅ `first_name`, `last_name`, `organization` columns added (migration applied to prod)
- ✅ `letter_address_name` dropped
- ✅ Backfill ran on all existing contacts; user manually corrected edge cases
- ✅ ContactModal: First / Last / Organization / Salutation fields; Top Priority below Salutation
- ✅ CSV parser: backwards-compat for legacy `Full Name` header; new template uses split columns
- ✅ Sentry `@sentry/react` installed, initialized with Session Replay, ErrorBoundary wrapping app
- ✅ `activity_log` table live; `useActivityLog` hook drives "Follow-up Needed" chip in ContactsTable
- ✅ Activity heatmap built (ActivityChart.tsx) then removed from Dashboard — kept hook for follow-up chip
- ⬜ Add `VITE_SENTRY_DSN` to Vercel environment variables (DSN obtained from Sentry, not yet set)
- ⬜ Gate Vercel preview deploys on Playwright in CI

---

## Phase 2 — Print + AI (next)

### Couple / family contact model
Currently a couple like "Cam and Lilly Raines" has to be entered with one person's name split
awkwardly. Options to explore:
- Add a `display_name` override field — shown instead of `firstName + lastName` everywhere
- Use `organization` for couples/families ("Raines Family", "Kevin & Sue Smith")
  and leave `firstName`/`lastName` as the primary contact person
- Salutation already handles the letter greeting; envelope addressing is the main gap
Decision: defer to letter formatter design — whichever approach makes envelope lines clean wins.

### Letter and envelope formatter
- Print-ready letter layout: contact name, address block, body, signature
- Salutation handling for couples/families ("Dear Kevin and Sue," / "Dear Smith Family,")
- Envelope print layout: return address + recipient address block
- Thank-you note formatter (same pipeline, different template)

### AI writing assistant
- Claude API via Supabase Edge Function (keeps API key server-side)
- Inputs: trip details, contact name, relationship, stage (pre-send / follow-up / thank-you), notes
- Outputs: letter draft, email draft, call script bullets
- User always reviews and edits — AI assists structure/tone only
- Anthropic API key stored in Bitwarden Secrets Manager, injected into Edge Function env

### Quick-add contact form
- Minimal inline form in ContactsTable (name + relationship only) for fast list-building
- Needs: active trip ID at insert time, surface DB errors to user, Supabase mock for tests

### Change data capture (old/new values in activity_log)
Add `old_value JSONB` and `new_value JSONB` to `activity_log`.
Deferred: single-user app has no audit conflict risk yet. Do this when Phase 3 ships.

### Multiple follow-ups
`call_made` is boolean — one follow-up per trip. When letter formatting workflow is clearer,
decide: count column vs. deriving count from `activity_log` events.

---

## Phase 3 — SaaS / multi-user (future)

- Stripe billing
- Org isolation (`organization_id` on all tables)
- **Coach dashboard** — admin sees multiple users' progress in real time
  - Who is consistent, who has stalled, who needs a nudge
  - For mission org staff supporting multiple fundraisers
- Admin role: `profiles` table with `role` column (`'user' | 'admin'`)
- Service-role key for cross-user admin reads (server-side only, never in client)
- Change data capture becomes useful for audit disputes
- Consider Next.js at this point for SSR and API routes

---

## Decisions log
- **Skipped Docker/Express** — went straight to Supabase
- **Keeping Vite** — right fit for personal use; reconsider Next.js only at Phase 3
- **TypeScript** — migrated April 2026; shared types catch schema mismatches at compile time
- **Supabase URL + publishable key are not secrets** — go in `.env` and Vercel env vars
- **Bitwarden Secrets Manager** — reserved for Phase 2 Anthropic API key
- **`returning` is a Postgres reserved word** — must be quoted as `"returning"` in SQL
- **camelCase ↔ snake_case mapping** lives in `useContacts.ts`
- **RLS uses `(SELECT auth.uid())` pattern** — evaluated once per query, not per row
- **No SQL Editor / dashboard for DDL** — migrations only
- **`salutation` kept** — useful for letter drafting; auto-populated from `first_name` in UI
- **`full_name` not dropped yet** — still exists in DB, not read by app; drop in future cleanup
- **Activity heatmap removed from Dashboard** — built and reverted; `useActivityLog` hook kept
  for "Follow-up Needed" chip; heatmap can be revisited in Phase 2 alongside print/AI features
- **Couple/family names** — backfill left as-is for existing contacts; new contacts enforce
  separate first/last fields; display_name or organization override approach deferred to Phase 2
