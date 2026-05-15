# Architecture Decisions

Canonical record of decisions made during development. New decisions go here; do not append to ROADMAP.md.

---

## Environment & Deployment

### Three-tier branch + environment model (May 2026)
- `feature/*` branches off `staging`; PR opens against `staging`
- `staging` branch deploys to Vercel staging preview + staging Supabase project
- `main` branch deploys to Vercel production + prod Supabase (`wzfrfgqnjkvgadsqtgvb`)
- CI (unit + E2E against local Supabase) must be green before any merge
- Prod migrations apply only via GitHub Actions `migrate-prod.yml` — no local CLI push to prod ever
- Supabase CLI linked to staging only on the local machine

### Supabase CLI linked to staging only
The CLI (`supabase link`) points at the staging project, not production. Production migrations are applied exclusively via `migrate-prod.yml` using a `PROD_DB_PASSWORD` GitHub secret. This physically prevents accidental `supabase db push` to prod from a local machine.

### No direct pushes to `main` or `staging`
Both branches are protected in GitHub (require PR + CI green). Enforced via GitHub branch rulesets — see CLAUDE.md for exact settings.

### CI uses local Supabase Docker stack (not cloud)
GitHub Actions starts its own local Supabase stack (`supabase start`) to run migrations and seed before every test run. No cloud credentials needed in CI — the test job is fully self-contained.

---

## Database & Schema

### `returning` is a derived field, not stored
A contact is "returning" if they have `financial_partner = true` on any trip other than the current one. The original DB column was dropped (migration `20260510004000`). Value is computed in `useContacts.ts` after `fromContactRow()`.

### `returning` is a Postgres reserved word
Always quote as `"returning"` in SQL queries.

### Couple contacts use flat columns (May 2026)
`is_couple boolean` + `spouse_first_name text` added directly to `contacts` (migration `20260511200000`). The `household_members` table created in `20260511195103` was dropped in the same migration. Reason: simpler schema, no join needed, covers the only real use case (spouse salutation for letter drafting).

### No SQL Editor / dashboard DDL
Every schema change lives in a numbered file in `supabase/migrations/`. No DDL in Supabase Studio or SQL Editor, ever.

### RLS uses `(SELECT auth.uid())` pattern
Evaluated once per query, not per row. All tables use `qual` + `with_check` to prevent cross-user reads and writes.

### `salutation` kept on contacts
Useful for letter drafting. Auto-populated from `first_name` in the UI.

### `full_name` dropped
Migration `20260510004000_drop_full_name.sql` applied to prod. Column is gone; CSV import handles legacy `Full Name` header for backwards compat.

### camelCase ↔ snake_case mapping lives in `useContacts.ts`
`CONTACT_CAMEL_TO_SNAKE` and `TRIP_CAMEL_TO_SNAKE` maps are the single source of truth.

---

## Frontend

### Vite + React (not Next.js)
Right fit for a personal-use SPA. Next.js will be reconsidered only at Phase 3 (SaaS/SSR).

### TypeScript throughout
Migrated April 2026. Shared types in `src/types.ts` catch schema mismatches at compile time.

### Supabase URL + publishable anon key are not secrets
Go in `.env` and Vercel env vars. Never commit service-role key to the repo.

### Template CSV auto-derived from COLUMN_MAP
No manual sync needed. A round-trip unit test guards against column drift.

### Relationship field is a constrained select
"Add new…" escape hatch saves custom values. Required for consistent AI tone prompting in Phase 2.5.

### Country field is a searchable select
~60 countries inline in `ContactModal.tsx`, no external package, defaults to United States.

### Playwright Radix Select pattern
Options render in a portal — use `page.locator('[role="option"]', { hasText: '...' })`, not `getByRole('option')`.

### Property-based testing with fast-check
Installed as devDep. Used for `csvParser` functions where input space is large and functions are pure.

### Activity heatmap removed from Dashboard
Built and reverted in Phase 1.6. `useActivityLog` hook kept for "Follow-up Needed" chip. Heatmap can be revisited in Phase 2 alongside print/AI features.

---

## Auth & Security

### No anonymous sign-ins
Disabled in `supabase/config.toml`.

### Bitwarden Secrets Manager reserved for Phase 2.5
Will hold the Anthropic API key for the AI writing assistant Edge Function.

### Rate limiting
Supabase built-in auth rate limits are on by default. Edge Functions (when added) must be individually protected.

---

## Deferred / Not Yet Decided

- **Group/parent trip model** — Option A (parent_trip_id FK) vs Option B (org-level template). See OPEN_QUESTIONS.md.
- **Multiple follow-ups** — `call_made` is boolean; count column vs. repeated `activity_log` events TBD.
- **Change data capture (old/new values in activity_log)** — deferred to Phase 3.
- **International phone UX** — separate field vs country prefix selector. Deferred to Phase 2.
