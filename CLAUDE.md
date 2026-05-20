# Claude Code — project rules for Support Raising

These rules are permanent and override default behavior every session.

---

## Session startup checklist

1. Read this file
2. Read `docs/DECISIONS.md` and `docs/OPEN_QUESTIONS.md`
3. Summarize active state and open questions
4. Ask if there is a spec before touching any code

---

## Daily development workflow

### Starting a feature

```bash
git checkout staging && git pull origin staging
git checkout -b feature/my-feature-name

supabase start
supabase db reset --local   # clean slate with seed data
npm run dev:local            # http://localhost:5173
```

Sign in: `playwright@example.com` / `playwright-test-pw!`

### While developing

```bash
npx vitest run      # must pass before every commit
npm run test:e2e    # optional but recommended (local Supabase must be running)
```

### Push to staging for review

```bash
git add <specific files>
git commit -m "feat(scope): description"
git push origin feature/my-feature-name
```

Open PR on GitHub: `feature/*` → `staging`. CI runs automatically (unit + E2E). Must be green to merge. After merge, `migrate-staging.yml` applies any new migrations to staging Supabase automatically.

### Verify on staging

Open the Vercel staging URL (Vercel dashboard → the `staging` branch deployment). Sign in and confirm the feature works. If something is wrong, fix it on a new `feature/*` branch — never push directly to `staging`.

### Promote to production

Open PR on GitHub: `staging` → `main`. CI runs again. After merge, `migrate-prod.yml` applies migrations to prod and Vercel deploys to the production URL.

**After every staging→main merge:** immediately open a `feature/sync-main-into-staging` branch off staging, merge main into it, and PR it back to staging. This keeps the git graphs in sync and prevents divergence on the next staging→main PR. If you skip this step, the next staging→main PR will show as "out of date" and the "Update branch" button will be blocked by branch protection.

```bash
supabase stop   # when done for the day
```

---

## Branch model

```
feature/* → PR to staging → CI green → merge → verify on staging → PR to main → CI green → merge → prod
```

| Branch | Environment | Database | Deploy |
|--------|-------------|----------|--------|
| `feature/*` | local only | local Docker Postgres | never deployed |
| `staging` | staging | staging Supabase project | Vercel (staging preview) via CI |
| `main` | production | prod Supabase `wzfrfgqnjkvgadsqtgvb` | Vercel (production) via CI |

- Always branch `feature/*` off `staging`, not `main`
- Never commit directly to `staging` or `main`
- Both `staging` and `main` require PR + CI green (branch protection — see OPEN_QUESTIONS.md for setup steps)

---

## Environment variables

| Variable | Local | Staging | Production |
|----------|-------|---------|------------|
| `VITE_SUPABASE_URL` | auto from `supabase start` | staging project URL | `https://wzfrfgqnjkvgadsqtgvb.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | auto from `supabase start` | staging anon key | prod anon key |
| `VITE_SENTRY_DSN` | empty / omit | empty / omit | set in Vercel env vars |

- Local values are exported by `supabase start` and written to `$GITHUB_ENV` in CI — never hardcoded
- Staging values go in `.env.staging.local` (gitignored)
- Production values live in Vercel env vars only — never in any `.env` file in this repo

---

## Database safety — non-negotiable

### CLI is linked to staging only
The Supabase CLI (`supabase link`) is linked to the **staging** project. Production migrations are applied exclusively by `migrate-prod.yml` via the `PROD_DB_PASSWORD` GitHub secret. Never re-link to production from a local machine.

### Migration workflow
1. Write `.sql` file in `supabase/migrations/`
2. Apply to **local** via Docker:
   ```
   docker exec supabase_db_Support-Raising psql -U postgres -d postgres < supabase/migrations/<file>.sql
   ```
3. Verify locally:
   ```
   supabase db query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
   ```
4. Run `npx vitest run` — all must pass
5. Commit migration file + code together on a `feature/*` branch
6. Open PR to `staging` → CI runs → merge → `migrate-staging.yml` applies migration to staging Supabase
7. Verify on staging
8. Open PR to `main` → CI runs → merge → `migrate-prod.yml` applies migration to prod Supabase

### Take a schema backup before any manual remote change
```
supabase db dump --linked --schema-only > backups/schema-staging-$(date +%Y%m%d-%H%M).sql
```
Keep backups in `backups/`. Gitignored.

### Migration hygiene
1. Every schema change = a numbered file in `supabase/migrations/`
2. Migration committed to git alongside the code that depends on it
3. Never run DDL in Supabase Studio or SQL Editor — migrations only
4. Run `supabase migration list` before any push to verify local/remote are in sync

---

## Dev environment

### Three environments

| | Local | Staging | Production |
|---|---|---|---|
| Supabase URL | `http://127.0.0.1:54321` | staging project URL | `https://wzfrfgqnjkvgadsqtgvb.supabase.co` |
| Dev server | `npm run dev:local` | `npm run dev:staging` | `npm run dev` (never use for dev) |
| Postgres container | `supabase_db_Support-Raising` | staging cloud | prod cloud (never touch directly) |
| Data | wiped on `supabase db reset --local` | persistent test data | real user data |

### Starting local Supabase (requires Docker running)

```bash
supabase start             # boots the local docker stack
supabase db reset --local  # applies all migrations + seed.sql (wipes data)
npm run dev:local          # dev server pointed at local Supabase
```

Local login: `playwright@example.com` / `playwright-test-pw!`

```bash
supabase stop
```

---

## Testing

- Run `npx vitest run` before starting any feature and after finishing
- All tests must pass before committing
- Never push if tests are failing

**Unit tests:**
```bash
npx vitest run
```

**E2E tests (requires local Supabase running first):**
```bash
supabase start
npm run test:e2e
```
The Playwright suite runs `supabase db reset --local` automatically via `globalSetup` (skipped in CI — the workflow handles the reset as its own step).

### When E2E is required locally

E2E is not optional after UI changes. Run `npm run test:e2e` locally whenever you:
- Touch a component that has a corresponding Playwright spec
- Rename, remove, or replace a DOM element (button, select, input, heading)
- Change sort order, filter logic, or list rendering in any component covered by E2E tests
- Add or remove a page, route, or tab

Unit tests verify logic. E2E tests verify that the UI a real user sees actually works.

### Test maintenance discipline

When you change a component, open `e2e/` and check for tests that reference it before committing:

```bash
grep -r "data-testid\|getByText\|getByRole" e2e/ | grep "<the thing you changed>"
```

If a test references a control you removed or renamed: **update the test in the same commit.** A passing unit suite with a broken E2E spec is not a green build — it is a time-delayed CI failure.

Specific patterns that break E2E tests silently during local development:
- Replacing a `<select>` with tab buttons (selector becomes stale)
- Adding a second element with the same visible text (strict mode violation)
- Reversing or re-sorting a list (index-based assertions flip)
- Adding async re-renders between an action and an assertion (use `toBeVisible()`, not `toHaveCount()`)

---

## General coding rules

- No comments unless the WHY is non-obvious
- No abstraction beyond what the task requires
- Prefer editing existing files over creating new ones
- Do not push to the remote git repository unless explicitly asked

---

## Key facts about this project

- Stack: Vite + React + TypeScript + Tailwind, deployed to Vercel
- Local Supabase container: `supabase_db_Support-Raising`
- Prod Supabase project ID: `wzfrfgqnjkvgadsqtgvb`
- camelCase ↔ snake_case mapping lives in `src/hooks/useContacts.ts`
- RLS pattern: `(SELECT auth.uid()) = user_id` on all tables, all operations
- `returning` is a Postgres reserved word — always quoted as `"returning"` in SQL
- Couple contacts: flat `is_couple boolean` + `spouse_first_name text` on `contacts` (migration `20260511200000`). No separate household table.
- Architecture decisions: `docs/DECISIONS.md`
- Open questions: `docs/OPEN_QUESTIONS.md`

---

## GitHub branch protection settings (apply manually in GitHub UI)

Go to `github.com/kylegroves6/support-raise` → Settings → Branches → Add ruleset:

**Branch: `main`**
- Target: `main`
- Require a pull request before merging: ✅
- Required status checks: `test` (from `ci.yml`)
- Require branches to be up to date: ✅
- Block force pushes: ✅
- Restrict deletions: ✅

**Branch: `staging`**
- Target: `staging`
- Require a pull request before merging: ✅
- Required status checks: `test` (from `ci.yml`)
- Require branches to be up to date: ✅
- Block force pushes: ✅
