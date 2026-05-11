# Support Raising Tracker — Roadmap

## Current State (v0.9 — May 2026)

- Vite + React + TypeScript + Tailwind SPA
- Supabase for database (Postgres), auth, and RLS
- No server-side component — Supabase JS client called directly from React hooks
- Supabase CLI linked for migrations
- Deployed to Vercel; installable as PWA on iOS/Android home screen
- 162 unit tests passing (csvParser, useContacts, contactValidation, csvParser.property)
- Playwright E2E: 11 golden-path tests green against local Supabase
- GitHub Actions CI: runs unit + E2E on every push against a fresh local Supabase stack
- `supabase/seed.sql` provides deterministic baseline (test user + 4 contacts + active trip)
- Playwright `globalSetup` runs `supabase db reset --local` before each suite — no manual cleanup needed
- Sentry initialized with Session Replay (`VITE_SENTRY_DSN` env var — add to Vercel)
- `activity_log` table live in production, accumulating data
- Phase 2 security hardening complete: npm audit clean, RLS audited, CSP header, eslint-plugin-security, phone normalization, E2E trip/goal tests

### Migration hygiene rule (absolute)
Every schema change must:
1. Be written as a migration file in `supabase/migrations/`
2. Be committed to git alongside the code that depends on it
3. Applied only via `supabase db push` or the Supabase MCP tool
4. Run `supabase migration list` before any push to verify local/remote are in sync

**Known drift (cosmetic only):** Remote has three orphan entries (`20260510192920`, `20260510215326`, `20260511012902`) from migrations that were applied out-of-band during the Phase 1.6 split-name work. Their SQL is identical to the corresponding local migrations. Local/remote schema is fully in sync — `supabase db push` is safe. No action needed.

### Known issues / tech debt
- Remote migration list has three orphan entries — cosmetic only (see Migration hygiene note above).
- Small-screen PWA layout not fully reviewed.

---

## Phase 1 — Complete ✓

Core CRUD, auth, RLS, trips, goals, CSV import/export, additional raising items.

---

## Phase 1.5 — Deployment + Testing ✓

- ✅ Vercel deployment with SPA rewrite rule
- ✅ PWA support
- ✅ Google OAuth + email/password auth
- ✅ Vitest unit tests (162 passing)
- ✅ Playwright E2E: 11 golden-path tests green against local Supabase
- ✅ `.env.example` documents all required env vars
- ✅ GitHub Actions CI: unit + E2E on every push to `main`
- ✅ `supabase/seed.sql`: deterministic test baseline; `globalSetup` resets DB before each E2E run
- ✅ `npm run dev:local`: dev server pointed at local Supabase for offline development
- ⬜ **Branch protection on `main`** — require `test` CI job to pass before any push or PR merge lands. Set up in GitHub → Settings → Branches → Add ruleset. Why: direct pushes currently bypass CI; becomes critical before opening to more users.
- ⬜ Gate Vercel preview deploys on CI green (add Vercel GitHub integration check to the same branch ruleset)

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

## Pre-Phase 2 hardening ✓

- ✅ ContactModal: Organization moved directly after Last Name
- ✅ Relationship field: free-text combobox → constrained Radix Select + "Add new…" escape hatch
- ✅ Country field: free-text → searchable select (~60 countries, default United States, clearable)
- ✅ Email validation: format check on save, inline error, blocks save
- ✅ Phone validation: lenient US + international, inline error, blocks save
- ✅ Gift amount > 0: requires Form of Gift, Date Received, and Financial Partner or Pledged to Give
- ✅ Financial Partner auto-sets Contacted = true
- ✅ `normalizeDateString` expanded: handles ISO, US slash, US dash, European dot, long/short month names
- ✅ Import modal: date format hint shown to users
- ✅ Unit tests: 137 passing (was 72) — contactValidation.test.ts added (32 tests)
- ✅ Property-based fuzz tests: `fast-check` installed; csvParser.property.test.ts added
- ✅ E2E tests: 8 passing (was 5) — gift validation flows and FP auto-set covered
- ✅ Template CSV: auto-derived from COLUMN_MAP, stays in sync; round-trip test guards against drift

### Deferred to Phase 2 backlog
- Phone normalization on import (`normalizePhoneString` — strip formatting to consistent hyphen-delimited form, normalize on blur in ContactModal)
- CI: gate Vercel preview deploys on Playwright passing

---

## Phase 2 — Multi-user readiness + quality of life

Priority order reflects what provides value now, before opening the app to other users.
AI/letter drafting deferred to Phase 2.5 — not needed until active letter-writing season.

### Security hardening ✓
- ✅ `npm audit` — 0 high/critical CVEs
- ✅ `eslint-plugin-security` installed and wired into `eslint.config.js` — 0 errors; warnings are all false-positive object-injection on typed Record access
- ✅ All 6 RLS policies audited: every table uses `(SELECT auth.uid()) = user_id` with `qual` + `with_check` — no cross-user reads possible
- ✅ CSP header added to `vercel.json`: restricts `script-src`/`connect-src` to own domain + Supabase + Sentry
- ✅ Pre-existing lint errors fixed: `React.` type references, unused variable, inline component in TripHistory, useless escape in validatePhone
- Rate limiting: Supabase's built-in auth rate limits are on by default; confirm Edge Functions (when added) are protected
- No secrets in client bundle: Supabase URL + anon key are intentionally public; no service-role key present

### Phone normalization on import ✓
- ✅ `normalizePhoneString` added to `csvParser.ts`: strips parens/dots/spaces/+1 country code → XXX-XXX-XXXX; international numbers pass through
- ✅ Called on `phone` field during CSV import (same pattern as `normalizeDateString`)
- ✅ `onBlur` handler in ContactModal normalizes on focus-leave (not on keystroke)
- ✅ 13 unit tests added to `csvParser.test.ts`
- ✅ 6 property-based fuzz tests added to `csvParser.property.test.ts`
- 159 unit tests passing (was 137)

### Trip creation / goal math E2E tests ✓
- ✅ E2E test 7: create new trip via TripRollover UI with 30-day-future start; verify trip name in header and positive days-until count on dashboard
- ✅ E2E test 8: set trip cost ($3,000) + additional raising item ($200) via GoalSettings; verify total goal $3,200 on dashboard
- ✅ Both tests include REST API cleanup (idempotent across runs)
- ✅ `cleanupTestTrips` added to `beforeAll` so test state resets at suite start

### Phone normalization — international number UX (backlog)
- Consider a separate international phone field or country prefix selector to avoid digit-count ambiguity with US pattern matching
- The `onBlur` path in ContactModal is tested via unit tests but not yet via Playwright interaction

### Quick-add contact form
- Minimal inline form in ContactsTable (name + relationship only) for fast list-building
- Needs: active trip ID at insert time, surface DB errors to user, Supabase mock for tests

### Relationship breakdown report
- Pie/bar chart: gift dollars broken down by relationship category
- Personal insight: "most support came from church friends"
- Requires consistent relationship values — now enforced; unblocked
- Deferred until enough data exists to make it meaningful

### Activity heatmap on Dashboard
- Built and removed in Phase 1.6 (ActivityChart.tsx exists, just not rendered)
- 52-week rolling heatmap, CSS grid, hover tooltip by event type
- Revisit when dashboard feels sparse or user has enough history to make it useful

### Group / parent trip model (architecture decision required)
Current schema: each user has one active `trip` at a time. For multi-person support trips
(e.g. a Cru summer mission team where multiple students fundraise for the same trip):

**Option A — parent trip + member trips (junction table)**
- Add `parent_trip_id` FK on `trips` table (nullable)
- A "parent trip" has no contacts of its own — it's the shared mission
- Each student's trip links to the parent; their contacts and goals are their own
- Coach dashboard (Phase 3) aggregates across all member trips for a given parent
- Enables: "how is the team doing overall?" without merging contact lists

**Option B — org-level trip template**
- Similar to Phase 3 org isolation — a trip template is owned by an org, not a user
- More complex; only needed if the org (Cru) wants to create trips that students join
- Integration with Cru's existing summer mission application is possible here

**Decision deferred** — needs clarity on whether the use case is:
(a) personal tracking by individual students who happen to share a trip, or
(b) a Cru staff member creating and managing a trip that students get added to
Document the answer before writing any schema migration.

### Change data capture (old/new values in activity_log)
Add `old_value JSONB` and `new_value JSONB` to `activity_log`.
Deferred: single-user app has no audit conflict risk yet. Do this when Phase 3 ships.

### Multiple follow-ups
`call_made` is boolean — one follow-up per trip. Count column vs. repeated `activity_log`
events — decide when the workflow is clearer from real use.

---

## Phase 2.5 — Print + AI (deferred — not needed until active letter-writing season)

### Letter and envelope formatter
- Three output formats: mailed letter (one-page), email, text/SMS
- Pre-structured sections user can lock/unlock: opening, personal connection, ask, closing
- Tone controls: formality slider, warmth, length
- Salutation handling for couples/families
- Envelope print layout: return address + recipient address block
- Thank-you note formatter (same pipeline, different template)

### AI writing assistant
- Claude API via Supabase Edge Function (keeps API key server-side)
- Inputs: trip details, contact name, relationship, stage, notes, output format, tone settings
- Relationship field calibrates tone — consistent values now enforced (unblocked)
- User always reviews and edits — AI drafts structure/tone, never writes the final copy
- Anthropic API key stored in Bitwarden Secrets Manager, injected into Edge Function env

### Couple / family contact model refinement
- `organization` for couples/families ("Kevin & Sue Smith", "Raines Family")
- Full envelope addressing design — make tradeoffs concrete here

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
- **`full_name` dropped** — migration `20260510004000_drop_full_name.sql` applied to prod; column is gone
- **Activity heatmap removed from Dashboard** — built and reverted; `useActivityLog` hook kept
  for "Follow-up Needed" chip; heatmap can be revisited in Phase 2 alongside print/AI features
- **Couple/family names** — backfill left as-is for existing contacts; new contacts enforce
  separate first/last fields; display_name or organization override approach deferred to Phase 2
- **Relationship field is now a constrained select** — "Add new…" escape hatch saves custom values; required for consistent AI tone prompting in Phase 2
- **Country field is a searchable select** — ~60 countries inline in ContactModal, no external package; defaults to United States
- **Template CSV is auto-derived from COLUMN_MAP** — no manual sync needed; example row values are the only manual maintenance; round-trip unit test guards against column drift
- **Phone normalization deferred** — `normalizePhoneString` planned for Phase 2 backlog (strip formatting on import + normalize on blur in ContactModal)
- **Playwright Radix Select pattern** — options render in a portal; use `page.locator('[role="option"]', { hasText: '...' })` not `getByRole('option')`
- **Property-based testing with fast-check** — installed as devDep; used for csvParser functions where input space is large and functions are pure
