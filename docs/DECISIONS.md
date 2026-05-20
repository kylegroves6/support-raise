# Architecture Decisions

Canonical record of decisions made during development. New decisions go here; do not append to ROADMAP.md.

---

## Environment & Deployment

### GitHub Actions bumped to Node.js 24-compatible versions (May 2026)
All actions in `deploy.yml` pinned to versions that run on the Node.js 24 runtime ahead of GitHub's June 2, 2026 forced cutover: `actions/checkout@v6`, `actions/setup-node@v6`, `actions/cache@v5`, `actions/upload-artifact@v7`, `supabase/setup-cli@v2`. Resolves issue #35.

### CI env var extraction uses `tr -d '"\r'` on `supabase status` output (May 2026)
`supabase status --output env` produces shell-assignment syntax: `API_URL="http://..."\r`. The surrounding double-quotes and CRLF line ending must be stripped before writing to `$GITHUB_ENV`. Failure to do so produces a malformed URL that returns an empty HTTP body, which causes `JSON.parse('')` to throw in Playwright's `beforeAll` and kills all 13 tests at 0ms. Fix: pipe through `| tr -d '"\r'`. A smoke-test step in `ci.yml` now validates the URL format and auth reachability immediately after extraction. Full root-cause analysis: `docs/CI_POSTMORTEM.md`.

### Staging seed data is automatic on every staging merge (May 2026, revised)
`deploy.yml` runs `psql ... -f supabase/seed.sql` as part of `deploy-staging` after every merge to `staging`. Staging data is intentionally ephemeral — treat it as a disposable test environment, not a place to accumulate manual test state. Secrets are scoped to the `staging` GitHub Environment so the prod DB password is physically unreadable from the staging job. Original decision (manual-only via `workflow_dispatch`) was reversed when the pipeline was consolidated into a single `deploy.yml`.

### Sentry replay requires `worker-src blob:` in CSP (May 2026)
Sentry's replay integration spawns blob: workers. Without `worker-src blob:` explicitly in the CSP, browsers fall back to `script-src` which blocks blob: URLs. Added to `vercel.json`. `VITE_SENTRY_DSN` is intentionally scoped to the production environment in Vercel only — staging does not run Sentry.

### Single unified deploy.yml replaces four separate workflow files (May 2026)
`ci.yml`, `migrate-staging.yml`, `migrate-prod.yml`, and `seed-staging.yml` replaced by a single `deploy.yml` with three jobs: `test`, `deploy-staging`, `deploy-prod`. Jobs are chained via `needs: test` so deployment is blocked until tests pass. `deploy-prod` targets the `production` GitHub Environment which requires manual approval before the job runs. Vercel auto-deploy is disabled in Vercel project settings; both environments deploy via `vercel deploy` inside CI so the frontend and DB migrations are always in sync and both gated together.

### After every staging→main merge, sync main back into staging (May 2026)
Merging staging→main creates a merge commit on main that staging doesn't have, causing graph divergence. Fix: immediately after every prod deploy, open `feature/sync-main-into-staging` off staging, merge main into it, PR to staging. Skip this and the next staging→main PR will show "out of date" with "Update branch" blocked by branch protection.

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
