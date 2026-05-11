# Support Raising Tracker — Audit & Remediation Plan
**Originally audited:** 2026-05-10  
**Last updated:** 2026-05-10 (CI pipeline + seed infrastructure added)

---

## Overall Verdict
Clean, well-reasoned codebase. Safe for personal use today. Needs targeted fixes before multi-tenant SaaS launch.

## Phase 2 Security Hardening — Complete ✓
*(Completed 2026-05-10 — items below are closed)*

- **npm audit** — 0 high/critical CVEs. No action needed.
- **RLS audit** — All 6 public tables audited via `pg_policies`. Every policy uses `(SELECT auth.uid() AS uid) = user_id` on ALL operations with both `qual` and `with_check` set. This is the efficient subquery form (evaluated once per query, not per row). No cross-user reads possible.
- **CSP header** — `Content-Security-Policy` added to `vercel.json`: restricts `script-src` to self + `unsafe-inline` (required for Vite/React), `connect-src` to self + Supabase project URL + Sentry, `frame-ancestors 'none'`.
- **eslint-plugin-security** — Installed and wired into `eslint.config.js` for all JS/TS files. Lint runs clean: 0 errors. 25 warnings remain — all are `security/detect-object-injection` false positives on typed `Record<string, T>` bracket access (e.g. `c[key]` where `key: keyof Contact`, `row[csvCol]` where `csvCol` comes from a known `COLUMN_MAP`). The plugin cannot resolve TypeScript's type constraints statically, so it flags all bracket notation on objects whose key came from a variable. No actual injection risk — all keys are program-controlled strings, not user input.
- **Pre-existing lint errors fixed** as a side effect of adding the plugin: `React.` type references without import, unused variable in `RelationshipSelect`, useless escape in `validatePhone`, inline component in `TripHistory`, and the eslint config not covering `e2e/`/`vite.config.ts`/`playwright.config.ts` files.

---

## Phase A — Ship It ✓ (Complete — deployed to Vercel)

### A1. `vercel.json` — ✅ Done. SPA rewrite rule + CSP header now live.
### A2. PWA support — ✅ Done. `vite-plugin-pwa` installed.
### A3. Supabase redirect URL config — ✅ Done (applied to production project).

---

## Phase B — Dangerous Bugs (before sharing with others)

### B1. `replaceAll` is not atomic — DATA LOSS RISK
**File:** `src/hooks/useContacts.ts:249-274`
**Problem:** Deletes all contacts first, then inserts. If insert fails mid-way (network error), user loses all data with no recovery.
**Fix:** Wrap in a Supabase RPC function that does both operations in a single transaction, OR add optimistic backup: store the deleted rows in memory and re-insert them if the subsequent insert throws.

### B2. Hardcoded personal email in seed migration
**File:** `supabase/migrations/20260506005000_seed_daytona_2025_trip.sql:14`
**Problem:** `WHERE email = 'kylegroves6@gmail.com'` — this migration fails loudly (or silently no-ops) for every other user.
**Fix:** Move this seed data out of migrations entirely. Either:
- Delete the migration file and re-apply the data manually via `supabase db query --linked`
- Or wrap the migration in a conditional that checks an env var so it only runs locally

### B3. Client-side queries missing explicit `user_id` filter
**Files:** `src/hooks/useContacts.ts:121-125`, `src/hooks/useTrips.ts:39-46`, `src/hooks/useAdditionalRaising.ts:14-22`
**Problem:** Initial data loads rely entirely on RLS with no client-side `user_id` filter. A RLS misconfiguration would silently expose all users' data.
**Fix:** Add `.eq('user_id', userId)` to each initial SELECT. Requires fetching userId first (already done in other callbacks — extract to a shared util).

---

## Phase C — Code Quality (before opening to more users)

### C1. ESLint TypeScript coverage — ✅ Done.
`@typescript-eslint` wired in for all `.ts`/`.tsx` files. `eslint-plugin-security` also added. 0 errors.

### C2. Tests — ✅ Done.
- 162 Vitest unit tests passing across 4 files (csvParser, useContacts, contactValidation, property/fuzz)
- 11 Playwright E2E tests passing against local Supabase
- GitHub Actions CI runs both suites on every push to `main` against a fresh local Supabase stack
- `supabase/seed.sql` provides a deterministic baseline (test user + 8 realistic contacts + active trip)
- Playwright `globalSetup` runs `supabase db reset --local` before each E2E suite — no manual cleanup needed

### C3. Remove orphaned `NoResponsePage.tsx`
**File:** `src/components/NoResponsePage.tsx`
**Problem:** Defined but never rendered anywhere in the app. Dead code.
**Fix:** Either wire it into the tab navigation in `App.tsx`, or delete it.

### C4. Remove dead Vite proxy config — ✅ Done (removed in earlier session).

### C5. Deduplicate `getCurrentUserId()`
**Files:** `src/hooks/useContacts.ts:102-106`, `src/hooks/useTrips.ts:29-33`
**Fix:** Extract to `src/lib/auth.ts` and import in both hooks.

### C6. Remove `uuid` package dependency — ✅ Done (removed in earlier session).

### C7. `returning` field reads stale DB column
**File:** `src/hooks/useContacts.ts:51`
**Problem:** `fromContactRow()` reads `returning` from the DB, but line 136 immediately overwrites it with a derived value from trip history. The DB column read is dead code and misleading.
**Fix:** Remove `returning` from `fromContactRow()` — it's always overridden two lines later.

---

## Phase D — Security Hardening (before public launch)

### D1. Weak password policy
**File:** `supabase/config.toml:175`
**Problem:** `minimum_password_length = 6`, `password_requirements = ""`
**Fix:** Set `minimum_password_length = 8`, `password_requirements = "letters_digits"`

### D2. MFA unavailable
**File:** `supabase/config.toml`
**Fix:** Enable TOTP: `[auth.mfa.totp] enroll_enabled = true`, `verify_enabled = true`

### D3. No CAPTCHA on signup
**Fix:** Enable Cloudflare Turnstile in Supabase config for abuse protection on public launch.

### D4. Error messages expose internals
**Files:** `src/App.tsx:75,84,96,206`
**Problem:** `alert((err as Error).message)` — Supabase errors can contain schema/table names.
**Fix:** Map known error codes to friendly messages; log full error to console only.

---

## Phase E — Compliance (required for SaaS)

### E1. No data export / account deletion UI
**Problem:** GDPR/CCPA require users to be able to export and delete their data.
**Fix:** Add "Export my data" (already have CSV export — just needs a clear path) and "Delete account" (cascades via `ON DELETE CASCADE` already set up in DB).

### E2. No audit log
**Problem:** No record of who changed what and when. Donor data changes are untrackable.
**Fix:** Implement the `activity_log` table described in ROADMAP Phase 1.6.

### E3. Seed migration has personal data
**File:** `supabase/migrations/20260506005000_seed_daytona_2025_trip.sql`
**Problem:** Contains personal trip data (Daytona Beach, dates, cost) for a specific user.
**Fix:** Same as B2 — remove from migrations, apply manually.

---

## Non-Issues (confirmed safe)
- `npm audit` — 0 vulnerabilities (confirmed Phase 2, 2026-05-10)
- `tsc --noEmit` — 0 type errors
- `.gitignore` — correctly excludes `.env`, `*.csv`, `dist/`
- RLS `WITH CHECK` — correctly set on all 6 tables; uses efficient `(SELECT auth.uid())` subquery pattern
- OAuth + email share same Supabase user correctly
- No `dangerouslySetInnerHTML` — XSS risk is low
- Supabase anon key correctly identified as non-secret
- No service-role key in client bundle
