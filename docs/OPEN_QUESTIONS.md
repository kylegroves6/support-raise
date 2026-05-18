# Open Questions

Questions that are unresolved and block or inform upcoming work. Resolve each before writing code that depends on it. Append new questions at the bottom with a date.

---

## Active

### [2026-05-18] Sentry replay CSP fix not yet in production
**Status:** Fix committed to `feature/update-workflow-docs` (commit `8459117`), pending merge to staging → main.
**Blocks:** Sentry session replay working in production. Basic error capture (non-replay) may work once DSN confirmed.
**Action:** Merge PR #2 → staging → verify on staging preview → PR staging → main. After prod deploy, throw a test error in the browser console and confirm it appears in Sentry dashboard within 30s. Note: `VITE_SENTRY_DSN` is intentionally production-only in Vercel; replay will not work on staging and that is expected.

### [2026-05-18] Sentry DSN confirmation pending
**Status:** DSN added back to Vercel production env vars (2026-05-18) but not yet verified end-to-end.
**Blocks:** Confidence that error tracking is active in production.
**Action:** After PR #2 merges to main and deploys, open production URL, open browser console, type `allow pasting`, then: `throw new Error("Sentry connection test")`. Check Sentry dashboard → Issues. If it appears within 30s, mark resolved.

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

### [2026-05-15 → 2026-05-18] CI/CD pipeline standing up
**Resolved:** 2026-05-18
**Outcome:** Full three-tier pipeline operational. All items below confirmed done:
- Staging Supabase project created ✅
- All 5 GitHub secrets set (`SUPABASE_ACCESS_TOKEN`, `STAGING_PROJECT_REF`, `STAGING_DB_PASSWORD`, `PROD_PROJECT_REF`, `PROD_DB_PASSWORD`) ✅
- Branch protection on `main` and `staging` confirmed via GitHub API ✅
- CI pipeline fixed: 0/13 → 13/13 E2E passing (see `docs/CI_POSTMORTEM.md` for full root-cause breakdown) ✅
- `migrate-staging.yml` and `migrate-prod.yml` wired and ready ✅
- `seed-staging.yml` manual workflow added — run from GitHub Actions UI to populate staging with test data ✅
- CSP `worker-src blob:` fix added for Sentry replay (in PR #2, not yet in prod) ✅

### [2026-05-15] Production DB password in GitHub secrets
**Resolved:** 2026-05-15
**Outcome:** `PROD_PROJECT_REF` and `PROD_DB_PASSWORD` confirmed present in GitHub secrets.

### [2026-05-15] GitHub branch protection rules
**Resolved:** 2026-05-18
**Outcome:** Both `main` and `staging` confirmed protected via `gh api` — require PR + CI green, no direct pushes.

---

## Session Log

### 2026-05-15
- Established three-tier branch + environment model (feature → staging → main)
- Committed couple-fields changeset (migration 20260511200000, 215 tests passing)
- Created docs/DECISIONS.md and docs/OPEN_QUESTIONS.md
- Set up CI workflows for staging and prod migration gating
- Pending: user to create staging Supabase project, set GitHub secrets, apply branch protection

### 2026-05-18
- Debugged full CI pipeline: root cause was CRLF/quoted env vars from `supabase status` corrupting auth URL → all 13 E2E tests failing at 0ms
- Fixed 9 distinct failures across 4 layers (infra, env parsing, test logic) — full breakdown in `docs/CI_POSTMORTEM.md`
- Added CI env var smoke test step to `ci.yml` — catches quoting bugs before tests run
- Strengthened CLAUDE.md Testing section: E2E required after UI changes, selector maintenance discipline added
- Added `seed-staging.yml` manual workflow — fires only on workflow_dispatch, staging secrets only, no prod path
- Fixed CSP: added `worker-src blob:` to allow Sentry replay workers (commit `8459117`, in PR #2)
- PR #2 open and CI running — next step is merge to staging, verify, then promote to main
