# Support Raising Tracker — Audit & Remediation Plan
**Audited:** 2026-05-10

---

## Overall Verdict
Clean, well-reasoned codebase. Safe for personal use today. Needs targeted fixes before multi-tenant SaaS launch. ~60% production-ready.

---

## Phase A — Ship It (do first, ~30 min)
*Gets the app deployed to Vercel and usable as a phone home-screen app.*

### A1. Add `vercel.json` — UNBLOCKS DEPLOYMENT
Without this, any page refresh on Vercel returns a 404 (Vite SPA routing breaks).

**Fix:** Create `/vercel.json` at project root:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### A2. Add PWA support (vite-pwa plugin)
Lets users "Add to Home Screen" on iOS/Android for a native-app-like experience (full screen, app icon, no browser chrome).

**Fix:**
1. `npm install -D vite-plugin-pwa`
2. Add to `vite.config.ts`:
```ts
import { VitePWA } from 'vite-plugin-pwa'
// inside defineConfig plugins array:
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Support Tracker',
    short_name: 'Support',
    description: 'Mission fundraising support tracker',
    theme_color: '#6b7c5e',
    background_color: '#f5f0e8',
    display: 'standalone',
    icons: [
      { src: '/icons.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
  },
})
```
3. Verify `public/icons.svg` exists (it does).

### A3. Supabase redirect URL config (dashboard only, no code change)
After deploying to Vercel, add your production URL to Supabase:
- Dashboard → Authentication → URL Configuration → Redirect URLs
- Add: `https://your-app.vercel.app`
- Also add the Vercel preview URL pattern if desired: `https://*-your-project.vercel.app`

Also verify **Authentication → Providers → Email → Confirm email** is ON for the production project.

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

### C1. ESLint doesn't cover TypeScript
**File:** `eslint.config.js`
**Problem:** Config only covers `**/*.{js,jsx}`. All source files are `.ts`/`.tsx`. No TS rules, no React hooks lint is running.
**Fix:** Add `@typescript-eslint` parser and extend config to cover `**/*.{ts,tsx}`.
```bash
npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
```
Then update `eslint.config.js` to add a TS config block alongside the existing JS block.

### C2. No tests
**Problem:** Zero test files. No safety net for regressions.
**Recommended stack (already in ROADMAP):** Vitest + React Testing Library + Playwright
**Priority test targets:**
- `src/utils/csvParser.ts` — pure functions, easy to unit test
- `src/hooks/useContacts.ts` — critical data mutations
- E2E: sign in → add contact → import CSV → view dashboard

### C3. Remove orphaned `NoResponsePage.tsx`
**File:** `src/components/NoResponsePage.tsx`
**Problem:** Defined but never rendered anywhere in the app. Dead code.
**Fix:** Either wire it into the tab navigation in `App.tsx`, or delete it.

### C4. Remove dead Vite proxy config
**File:** `vite.config.ts:13-18`
**Problem:** Proxy to `localhost:3001` — no backend server exists.
**Fix:** Delete the `server.proxy` block.

### C5. Deduplicate `getCurrentUserId()`
**Files:** `src/hooks/useContacts.ts:102-106`, `src/hooks/useTrips.ts:29-33`
**Fix:** Extract to `src/lib/auth.ts` and import in both hooks.

### C6. Remove `uuid` package dependency
**File:** `src/utils/csvParser.ts:2,183`
**Problem:** `uuidv4()` generates IDs for parsed contacts but they're discarded on Supabase insert (server generates real UUIDs). Adds a dependency for no value.
**Fix:** Remove `import { v4 as uuidv4 } from 'uuid'`. Change the contacts.push line to omit `id` (cast to `Contact` after insert, not before). Uninstall with `npm uninstall uuid`.

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
- `npm audit` — 0 vulnerabilities
- `tsc --noEmit` — 0 type errors
- `.gitignore` — correctly excludes `.env`, `*.csv`, `dist/`
- RLS `WITH CHECK` — correctly set on all tables
- OAuth + email share same Supabase user correctly
- No `dangerouslySetInnerHTML` — XSS risk is low
- Supabase anon key correctly identified as non-secret
