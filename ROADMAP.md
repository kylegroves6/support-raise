# Support Raising Tracker — Roadmap

## Current State (v0.6 — May 2026)

- Vite + React + TypeScript + Tailwind SPA
- Supabase for database (Postgres), auth, and RLS
- No server-side component — Supabase JS client called directly from React hooks
- Supabase CLI linked for migrations (`supabase db push`)
- Deployed to Vercel; installable as PWA on iOS/Android home screen
- 67 unit tests passing (csvParser + useContacts hook)
- Playwright E2E config written, test user seeded in local Supabase

### Migration hygiene rule (absolute)
Never run DDL directly in Supabase SQL Editor or dashboard. Every schema change must:
1. Be written as a migration file in `supabase/migrations/`
2. Be committed to git alongside the code that depends on it
3. Applied only via `supabase db push` (confirm prompt runs before touching prod)
4. Run `supabase migration list` before any push to verify local/remote are in sync

### Known UI Issues
- Some UI elements don't flow well on small screens (PWA) — layout review needed

---

## Phase 1 — Complete ✓

Core CRUD, auth, RLS, trips, goals, CSV import/export, additional raising items.
See git history for full migration trail.

---

## Phase 1.5 — Deployment + Testing (mostly complete)

- ✅ Vercel deployment with SPA rewrite rule
- ✅ PWA support
- ✅ Google OAuth + email/password auth
- ✅ Vitest unit tests (67 passing)
- ✅ Playwright E2E config + 5 golden-path scenarios written
- ✅ `.env.test` committed (local anon key, safe)
- ✅ `.env.local` pattern documented for local↔prod switching
- ⬜ Playwright e2e — run green against local Supabase stack
- ⬜ Gate Vercel preview deploys on Playwright passing in CI

---

## Phase 1.6 — Contact model + observability (next)

### 1. Name field split
Currently `full_name` is a single text field. Split into:
- `first_name` TEXT NOT NULL DEFAULT ''
- `last_name` TEXT NOT NULL DEFAULT ''
- `organization` TEXT (nullable — for churches, businesses, entities)
- `full_name` becomes a generated/display field: `first_name || ' ' || last_name` (or organization name if set)

**Salutation:** auto-derived as `first_name` in the UI — no separate field needed for single contacts.
For couples/families ("Kevin and Sue Smith", "The Smith Family"), the user can override salutation
or organization. This is a UI decision deferred to the letter-formatting feature in Phase 2.

**Letter address name:** remove from the contact model. It existed for envelope addressing.
With AI letter drafting (Phase 2) and a print formatter, the app will derive envelope lines
from `first_name`, `last_name`, `organization`, and address fields automatically.

**Migration required:**
```sql
ALTER TABLE contacts
  ADD COLUMN first_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN last_name  TEXT NOT NULL DEFAULT '',
  ADD COLUMN organization TEXT;

-- Backfill: attempt to split existing full_name on first space
UPDATE contacts
SET
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name  = NULLIF(TRIM(SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)), '')
WHERE full_name LIKE '% %';

-- Single-word names: put everything in first_name
UPDATE contacts
SET first_name = full_name
WHERE full_name NOT LIKE '% %' AND first_name = '';

ALTER TABLE contacts DROP COLUMN letter_address_name;
```

**App changes:**
- `src/types.ts` — add `firstName`, `lastName`, `organization?`; remove `letterAddressName`
- `src/hooks/useContacts.ts` — update `CONTACT_CAMEL_TO_SNAKE`, `fromContactRow`, `toContactRow`
- `src/components/ContactModal.tsx` — replace single Full Name field with First / Last / Organization
- `src/utils/csvParser.ts` — update column map; handle both old `Full Name` and new `First Name`/`Last Name` for backwards compat
- `src/components/ContactsTable.tsx` — display `firstName + ' ' + lastName` or `organization`

### 2. Sentry — error monitoring
- Install `@sentry/react`
- Init in `src/main.tsx` with `VITE_SENTRY_DSN` from environment
- Wrap app in `Sentry.ErrorBoundary`
- Enable Session Replay (10% sample rate, 100% on errors)
- Add `VITE_SENTRY_DSN` to `.env.example` as placeholder
- Add to Vercel environment variables
- Enable Sentry ↔ GitHub integration → auto-creates issues on new errors
- Enable Sentry Autofix (beta) → Sentry opens PRs against those issues
- This is the "AI watches errors and opens fix PRs" pipeline

### 3. Playwright e2e — run green
- Ensure `supabase start` running, `.env.local` in place, `npm run dev` running
- Run `npm run test:e2e` — fix any selector mismatches
- Test user: playwright@example.com / playwright-test-pw! (already created in local Supabase)
- Active trip already seeded for that user

### 4. Activity chart on Dashboard
- 52-week rolling bar chart or heatmap (CSS grid, no external charting lib)
- Data source: `activity_log` table (already live, accumulating data)
- Color by event type: contact_added, sent, follow_up, gift, thank_you
- Shows consistency of outreach over time — personal accountability view
- Hover tooltip: date + count + breakdown by event type
- Follow-up timing: highlight contacts where `sent` was logged > 7 days ago but `follow_up` has not occurred yet

---

## Phase 2 — Print + AI (future)

### Letter and envelope formatter
- Print-ready letter layout: contact name, address block, body, signature
- Salutation handling for couples/families ("Dear Kevin and Sue," / "Dear Smith Family,")
- Envelope print layout: return address + recipient address
- QR code at bottom of letter linking to user's personal support-raising page
- Thank-you note formatter (same pipeline, different template)
- Paper size and margin options

### AI writing assistant
- Claude API via Supabase Edge Function (keeps API key server-side)
- Inputs: trip details, contact name, relationship, stage (pre-send / follow-up / thank-you), notes
- Outputs: letter draft, email draft, call script bullets
- User always reviews and edits — AI assists structure/tone, does not write the final letter
- Anthropic API key stored in Bitwarden Secrets Manager, injected into Edge Function env

### Change data capture (old/new values in activity_log)
Add `old_value JSONB` and `new_value JSONB` to `activity_log`.
Deferred because: single-user app has no audit conflict risk yet, and requires passing
previous contact state into every `updateContact` call.
Do this when Phase 3 multi-user ships and a coach needs "who changed what to what."

### Multiple follow-ups
Currently `call_made` is boolean — one follow-up per trip. Some contacts say "reach back out
next month." Options:
- Change `call_made` to a count column
- Log multiple `follow_up` events to `activity_log` and derive count from there
Decision deferred — design when letter formatting workflow is clearer.

---

## Phase 3 — SaaS / multi-user (future)

- Stripe billing
- Org isolation (each org has isolated data, `organization_id` on all tables)
- Configurable project/mission name per org
- **Coach dashboard** — admin sees multiple users' activity in real time
  - Who is consistent, who has stalled, who needs a nudge
  - Designed for mission org staff supporting multiple fundraisers
- Admin role: `profiles` table with `role` column (`'user' | 'admin'`)
- Service-role key for cross-user admin reads (server-side only, never in client)
- Change data capture becomes useful for audit disputes between users
- Consider Next.js at this point for SSR and API routes

---

## Decisions log
- **Skipped Docker/Express entirely** — went straight to Supabase
- **Keeping Vite** — right fit for personal use; reconsider Next.js only at Phase 3
- **TypeScript** — migrated April 2026; shared `Contact`/`Goals` types catch schema mismatches at compile time
- **Supabase URL + publishable key are not secrets** — go in `.env` and Vercel env vars
- **Bitwarden Secrets Manager** — reserved for future server-side secrets (Phase 2 Anthropic API key)
- **`returning` is a Postgres reserved word** — must be quoted as `"returning"` in SQL
- **camelCase ↔ snake_case mapping** lives in `useContacts.ts`
- **RLS uses `(SELECT auth.uid())` pattern** — evaluated once per query, not per row
- **No SQL Editor / Supabase dashboard for DDL** — migrations only, always via CLI
- **`letter_address_name` to be removed** — existed for envelope addressing; will be derived
  from name fields + address in the Phase 2 print formatter
- **`salutation` kept** — useful for letter drafting; auto-populated from `first_name` in UI
- **`full_name` split deferred** — Phase 1.6 migration to `first_name` + `last_name` + `organization`
