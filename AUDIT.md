# Support Raising Tracker — Audit & Remediation Plan
**Originally audited:** 2026-05-10  
**Last updated:** 2026-05-10 (CI pipeline + seed infrastructure added; migration history repaired; code pushed to main)

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

### B1. `replaceAll` is not atomic — ✅ Fixed
Insert-first pattern implemented: new contacts and contact_trips are inserted before any deletion. If insert fails, existing data is untouched. If contact_trips insert fails, the new contacts are rolled back. Old contacts are deleted only after all new data is safely written (`useContacts.ts:281-309`).

### B2. Hardcoded personal email in seed migration — ✅ Fixed
`supabase/migrations/20260506005000_seed_daytona_2025_trip.sql` no longer exists. Personal seed data removed from migrations entirely.

### B3. Client-side queries missing explicit `user_id` filter — ✅ Fixed
All three hooks filter by `user_id` on initial SELECT:
- `useContacts.ts:122` — `.eq('user_id', userId)`
- `useTrips.ts:38` — `.eq('user_id', userId)`
- `useAdditionalRaising.ts:20` — `.eq('user_id', userId)`

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
- **Next step:** Enable GitHub branch protection on `main` — require `test` job to pass before any push or merge lands. See ROADMAP Phase 1.5 for details.

### C3. Remove orphaned `NoResponsePage.tsx` — ✅ Fixed
File deleted. No longer present in `src/components/`.

### C4. Remove dead Vite proxy config — ✅ Done (removed in earlier session).

### C5. Deduplicate `getCurrentUserId()` — ✅ Fixed
Extracted to `src/lib/auth.ts`. All three hooks (`useContacts`, `useTrips`, `useAdditionalRaising`) import from there.

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

### E2. No audit log — ✅ Done
`activity_log` table is live in production. `useActivityLog` hook drives the "Follow-up Needed" chip in ContactsTable. Old/new value diff (change data capture) deferred to Phase 2/3.

### E3. Seed migration has personal data — ✅ Fixed
Same as B2 — file removed.

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
