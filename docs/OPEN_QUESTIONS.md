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

### 2026-05-19 (issue #35)
- Bumped all GitHub Actions in `deploy.yml` to Node.js 24-compatible versions ahead of June 2, 2026 cutover: checkout v4→v6, setup-node v4→v6, cache v4→v5, upload-artifact v4→v7, supabase/setup-cli v1→v2
- No code changes, no tests required — workflow-only change on current sync branch

### 2026-05-20
- PWA icon fully working on Android — solid blue square, chevron+stem arrow, no white fringe
- Fixed manifest 401: index.html now points to /manifest.webmanifest (VitePWA-generated), removed redundant public/manifest.json
- Added aria-label to bottom nav buttons (Lighthouse accessibility fix)
- Added iOS PWA meta tags (apple-mobile-web-app-capable, status-bar-style, title) — PR #34 staging→main pending merge
- Discovered staging/main git graph divergence caused by merge commits after staging→main PRs — documented fix in CLAUDE.md: always open a sync PR (feature/sync-main-into-staging) immediately after every prod deploy
- Open discussion: considering switching to trunk-based development (feature→main directly) to eliminate the sync headache. Blocked on Supabase branching — PR preview URLs have no database without it. Supabase branching is a paid feature.
- GitHub issues created: #19–#25 (from notes), #27 (auto-delete branches), #29 (bundle size), #30 (Vercel CLI cache)
- GitHub issues closed: #7, #9, #19, #21, #23, #25 (all resolved or duplicate)
- Remaining open issues: #8, #12, #15, #16, #20, #22, #24, #27, #29, #30
- Next session: merge PR #34 (iOS tags to prod), then decide on trunk-based vs staging workflow, then work on open issues (suggest starting with #15 gift field validation or #12 NameStorm keyboard)

### 2026-05-19
- Added `allowedHosts` ngrok entry to vite.config.ts for local mobile testing
- Built feature/ux-polish branch: mobile bottom nav (#9), header tab title (#9), PWA manifest + icons (#7)
- #8 (NameStorm mobile) deferred — needs staging URL review on real device after this branch merges
- Branch protection gap closed: added "Require deployments to succeed → staging" to main ruleset in GitHub UI
- Global CLAUDE.md updated with required promotion path (feature → staging → main)
- Next: open PR feature/ux-polish → staging, verify on staging URL on phone, then promote to main


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
