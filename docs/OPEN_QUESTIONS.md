# Open Questions

Questions that are unresolved and block or inform upcoming work. Resolve each before writing code that depends on it. Append new questions at the bottom with a date.

---

## Active

### [2026-05-15] Staging Supabase project ref
**Status:** Pending — user needs to create the project.
**Blocks:** `migrate-staging.yml` going live; CLI re-link; Vercel staging env vars.
**Action:** Create project at supabase.com/dashboard, then:
1. Add `STAGING_PROJECT_REF` and `STAGING_DB_PASSWORD` to GitHub secrets
2. Add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` to Vercel (scoped to `staging` branch)
3. Run `supabase link --project-ref <staging-ref>` locally
4. Run `supabase migration list` to confirm all 16 migrations apply cleanly

### [2026-05-15] Production DB password in GitHub secrets
**Status:** Pending — needed for `migrate-prod.yml`.
**Blocks:** Automated prod migration on merge to `main`.
**Action:** Add `PROD_PROJECT_REF=wzfrfgqnjkvgadsqtgvb` and `PROD_DB_PASSWORD` to GitHub repo secrets at github.com/kylegroves6/support-raise/settings/secrets/actions.

### [2026-05-15] GitHub branch protection rules
**Status:** Pending — must be applied manually in GitHub UI.
**Blocks:** Enforcement of the no-direct-push policy.
**Action:** In GitHub → Settings → Branches → Add ruleset:
- Branch `main`: require PR, require `test` job green, no direct pushes, no force push
- Branch `staging`: require PR, require `test` job green, no direct pushes

### [2026-05-15] Sentry DSN not in Vercel env vars
**Status:** Pending.
**Blocks:** Error tracking in production.
**Action:** Add `VITE_SENTRY_DSN` to Vercel project settings (production environment).

---

## Deferred (not urgent)

### [2026-05-15] Group / parent trip model
**Context:** Current schema: one active trip per user. Multi-person mission teams (e.g. Cru summer mission) may need a shared parent trip.
**Options:**
- A: `parent_trip_id` FK on `trips` — each student's trip links to a parent mission; coach dashboard aggregates across members
- B: Org-level trip template — trip owned by org, students join it; more complex, only needed for Phase 3
**Blocks:** Any multi-user trip feature or coach dashboard.
**Decision needed before:** Writing any schema migration for Phase 3.

### [2026-05-15] International phone UX
**Context:** `normalizePhoneString` handles US + pass-through international but digit-count ambiguity is unresolved.
**Options:** Separate international field, or country prefix selector.
**Blocks:** Phone normalization polish in Phase 2.

---

## Resolved

_(Move resolved items here with the resolution date and outcome.)_

---

## Session Log

### 2026-05-15
- Established three-tier branch + environment model (feature → staging → main)
- Committed couple-fields changeset (migration 20260511200000, 215 tests passing)
- Created docs/DECISIONS.md and docs/OPEN_QUESTIONS.md
- Set up CI workflows for staging and prod migration gating
- Pending: user to create staging Supabase project, set GitHub secrets, apply branch protection
