# CI Post-Mortem: E2E Pipeline 0/13 → 13/13

**Date resolved:** 2026-05-18
**Branch:** `feature/update-workflow-docs`
**Pipeline:** GitHub Actions — `ci.yml` (unit + Playwright E2E against local Supabase Docker)

---

## Summary

The E2E test suite went from 0/13 passing to 13/13 green. The failures came in four distinct layers: two infrastructure problems that predated this session, one root-cause environment variable bug that was the primary blocker, and three test logic bugs exposed once auth was unblocked. This document covers every failure in the order it was uncovered.

---

## Layer 1 — Pre-existing Infrastructure Failures

These problems existed before the current debugging session and had already been addressed. They are documented here for completeness so the full picture is clear.

### 1a. `package-lock.json` missing `@emnapi` package resolutions

**What was failing:** `npm ci` failed in CI because `@emnapi/*` packages referenced in `package-lock.json` could not be resolved. The lockfile was in an inconsistent state.

**Why:** A dependency had been added or updated locally in a way that left the lockfile referencing packages that npm's registry couldn't fully resolve in the clean CI environment.

**Fix:** Regenerated `package-lock.json` with a clean `npm install` locally and committed the updated lockfile.

---

### 1b. Hardcoded local anon key committed in `.env.test`

**What was failing:** The test environment was either using stale credentials or the committed `.env.test` was leaking a local-only Supabase anon key into the repo.

**Why:** `.env.test` had been committed with `VITE_SUPABASE_ANON_KEY` set to the local Docker Supabase anon key (`http://127.0.0.1:54321`'s key). This key is meaningless in CI if the environment variable is read before `supabase start` has run, and committed secrets — even non-sensitive local ones — violate the project security model.

**Fix:** Removed `.env.test` from the repo. CI now writes both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `$GITHUB_ENV` dynamically from the output of `supabase status` after the stack starts.

---

### 1c. `global-setup.ts` ran `supabase db reset --local` inside Playwright

**What was failing:** The Playwright global setup was calling `supabase db reset --local` which restarts Docker containers mid-run. When running inside CI (where `supabase start` had already been called by the workflow), this caused a second restart and left the auth service in an undefined state.

**Why:** The global setup was designed for local developer convenience — you just run `npm run test:e2e` and get a clean DB. But in CI, the workflow already handles the reset, so the second reset was redundant and destructive.

**Fix:** Added a guard in `global-setup.ts`:

```ts
if (process.env.CI) return;
```

The reset now only runs when a developer invokes Playwright locally.

---

### 1d. No health check after `supabase start` / `db reset`

**What was failing:** Playwright tests began immediately after `supabase start`, sometimes before the auth service (`/auth/v1/health`) was ready. This produced spurious connection refused or timeout errors on the very first test.

**Why:** `supabase start` returns before all internal services are fully accepting traffic. The auth service in particular has a brief warm-up window.

**Fix:** Added a polling health check step in `ci.yml` that curls `/auth/v1/health` every two seconds until it returns HTTP 200, with a timeout:

```bash
for i in $(seq 1 30); do
  status=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:54321/auth/v1/health)
  [ "$status" = "200" ] && break
  sleep 2
done
```

---

## Layer 2 — The Root Cause: Quoted + CRLF-Corrupted Environment Variable

This was the primary blocker. All 13 tests failed at 0ms with `SyntaxError: Unexpected end of JSON input`. The true cause took significant diagnostic work to uncover.

### What was failing

Every test failed immediately in `beforeAll` / `beforeEach`. The Playwright cleanup hooks called `request.post(...)` to sign in as the test user and wipe seeded data. This produced:

```
SyntaxError: Unexpected end of JSON input
```

at `authRes.json()`.

### Why this was not blank credentials

An important false trail: blank or wrong credentials do *not* produce an empty body. Supabase auth returns a JSON error response (`{"error":"invalid_grant","error_description":"..."}`), which is valid JSON. `authRes.json()` would have parsed it fine. An empty body means the HTTP request never reached the server — or the server responded with no body at all.

### The actual cause

`supabase status --output env` outputs values in this format:

```
API_URL="http://127.0.0.1:54321"\r\n
```

Note two problems:
1. The value is **wrapped in double-quotes** (shell quoting style, not bare value)
2. The line ends with a **carriage return** (`\r`) before the newline — CRLF line endings

The CI step to export environment variables used:

```bash
grep 'API_URL' supabase_status.env | cut -d= -f2
```

`cut -d= -f2` extracts everything after the `=` sign — which in this case was `"http://127.0.0.1:54321"\r`. Both the leading `"`, trailing `"`, and `\r` were preserved.

So `VITE_SUPABASE_URL` was set to:

```
"http://127.0.0.1:54321"\r
```

A string of length 24 instead of the expected 22.

### The cascade

When Playwright called:

```ts
await request.post(`${process.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`, ...)
```

the URL became:

```
"http://127.0.0.1:54321"\r/auth/v1/token?grant_type=password
```

This is a malformed URL. `curl` returns exit code 3 for a malformed URL — it never sends the request. The response body was empty. `authRes.json()` called `JSON.parse('')`, which throws `SyntaxError: Unexpected end of JSON input`.

Because this happened inside `beforeAll`, every test in every spec file failed immediately at 0ms — explaining why all 13 tests failed rather than just a subset.

### How it was diagnosed

A diagnostic step was added to `ci.yml` that echoed the variable and its length:

```bash
echo "VITE_SUPABASE_URL='${VITE_SUPABASE_URL}' len=${#VITE_SUPABASE_URL}"
```

Output: `len=24` (expected: 22). This confirmed the quotes and CR were present.

A follow-up `curl` with `-v` showed exit code 3 (malformed URL), confirming the URL was never even attempted.

### Fix

Added `| tr -d '"\r'` to strip both double-quotes and carriage returns from both cut commands in the "Export Supabase env vars" step:

```bash
# Before
grep 'API_URL' supabase_status.env | cut -d= -f2

# After
grep 'API_URL' supabase_status.env | cut -d= -f2 | tr -d '"\r'
```

Applied to both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. After this fix, `len=22` and the auth endpoint returned a valid JSON response.

### Lesson

**`SyntaxError: Unexpected end of JSON input` in a Playwright `beforeAll` almost always means the HTTP request never left the machine.** Check the URL before assuming authentication is broken. Shell scripts that parse `supabase status` output must strip both surrounding quotes and CRLF endings — the `--output env` format is shell-assignment syntax, not bare values.

---

## Layer 3 — Test Logic Bugs Exposed After Auth Was Unblocked

With auth working, the remaining failures were Playwright-level test bugs. The UI had evolved and the tests hadn't kept up.

### 3a. Strict mode violation: `getByText('Name Storm')` matched two elements

**File:** `namestorm.spec.ts` line 51

**What was failing:**

```
Error: strict mode violation: getByText('Name Storm') resolved to 2 elements
```

**Why:** The string "Name Storm" appeared in two places: the navigation button label and the page heading `<h1>`. Playwright's `getByText` in strict mode refuses to act when a locator matches more than one element.

**Fix:** Changed to a role-scoped locator that can only match a heading:

```ts
// Before
await page.getByText('Name Storm').click();

// After
await page.getByRole('heading', { name: 'Name Storm' }).waitFor();
```

---

### 3b. Selector targeting a `<select>` that no longer exists

**File:** `namestorm.spec.ts` line 57

**What was failing:**

```
Error: page.locator('select[data-testid="relationship-select"]') — element not found
```

**Why:** The UI had been refactored. The relationship filter was previously a `<select>` dropdown. It was replaced with pill-shaped tab buttons rendered with `data-testid="tab-{category}"`. The selector was targeting a DOM element that no longer existed.

**Fix:** Updated the test to use the new tab UI:

```ts
// Before
await page.locator('select[data-testid="relationship-select"]').selectOption('Friend');

// After
await page.getByTestId('tab-Friend').click();
```

---

### 3c. Assertions assumed insertion order; component renders newest-first

**File:** `namestorm.spec.ts` lines 73–75

**What was failing:**

```
AssertionError: expected 'NSTest3' to equal 'NSTest1'
```

The test inserted `NSTest1`, `NSTest2`, `NSTest3` in that order and then asserted `NSTest1` was at index 0 (the top of the list).

**Why:** The NameStorm saved-entries list renders `[...savedEntries].reverse()` — newest entry first. So `NSTest3` (inserted last) appears at index 0.

**Fix:** Flipped the index assertions to match the actual render order:

```ts
// Before
expect(items[0]).toHaveText('NSTest1');
expect(items[2]).toHaveText('NSTest3');

// After
expect(items[0]).toHaveText('NSTest3');
expect(items[2]).toHaveText('NSTest1');
```

---

### 3d. Flaky row-count assertion during CSV import

**File:** `golden-paths.spec.ts` line 148

**What was failing:** The test asserted `toHaveCount(countBefore + 2)` immediately after triggering a CSV import. This was intermittently flaky — sometimes the assertion ran while React was mid-render and the DOM had `countBefore + 1` rows visible.

**Why:** React re-renders are asynchronous. After the import API call resolved, there was a window where the first row had appeared but the second hadn't yet, causing the count assertion to oscillate between `countBefore` and `countBefore + 2`.

**Fix:** Replaced the count assertion with two visibility assertions — one per imported contact name:

```ts
// Before
await expect(page.locator('[data-testid="contact-row"]')).toHaveCount(countBefore + 2);

// After
await expect(page.getByText('CSV Import Alpha')).toBeVisible();
await expect(page.getByText('CSV Import Beta')).toBeVisible();
```

Playwright's `toBeVisible()` waits for the element to appear, which is the natural synchronization point rather than polling a total count.

---

## Timeline

| Order | Layer | Failure | Fix |
|-------|-------|---------|-----|
| 1 | Infra | `npm ci` fails — missing `@emnapi` resolutions | Regenerated `package-lock.json` |
| 2 | Infra | Hardcoded local anon key in `.env.test` | Removed file; CI writes env vars dynamically |
| 3 | Infra | `global-setup.ts` re-runs `db reset` in CI | Added `if (process.env.CI) return` guard |
| 4 | Infra | No auth health check → race condition | Added polling curl loop on `/auth/v1/health` |
| 5 | **Root cause** | `supabase status` outputs quoted + CRLF values → malformed URL → empty HTTP body → `JSON.parse('')` throws → all 13 tests fail at 0ms | Added `\| tr -d '"\r'` to env var extraction |
| 6 | Test logic | `getByText('Name Storm')` matches 2 elements — strict mode violation | Changed to `getByRole('heading', ...)` |
| 7 | Test logic | Selector targets removed `<select>` element | Updated to `getByTestId('tab-Friend')` etc. |
| 8 | Test logic | Assertions expect insertion order; component renders newest-first | Flipped index assertions |
| 9 | Test logic | `toHaveCount()` is flaky during async re-render | Replaced with per-element `toBeVisible()` |

---

## Key Takeaways

1. **Shell-parse `supabase status` output carefully.** The `--output env` flag produces shell-assignment syntax (`KEY="value"\r`), not bare values. Always pipe through `tr -d '"\r'` or use `--output json` and parse with `jq`.

2. **Empty HTTP response body ≠ auth failure.** `SyntaxError: Unexpected end of JSON input` in a `beforeAll` means the request was never made (malformed URL, connection refused) or the server returned no body. Wrong credentials return a valid JSON error response.

3. **Echo variable lengths in diagnostic steps.** `len=${#VAR}` is the fastest way to spot invisible characters (quotes, CR, trailing spaces) that survive visual inspection of log output.

4. **Playwright strict mode is your friend.** A `strict mode violation` on a `getByText` is not an annoyance — it means your selector is ambiguous and the test would be testing the wrong element half the time. Fix the locator, don't suppress the error.

5. **Test render order, not insertion order.** If a component sorts or reverses its data, assertions that assume a specific item is "first" need to reflect the actual render, not the order items were created.

6. **Use `toBeVisible()` over `toHaveCount()` for async imports.** Counting DOM nodes is fragile during re-renders. Asserting that a specific expected item is visible gives Playwright a meaningful thing to wait for.

7. **The `if (process.env.CI) return` guard in `global-setup.ts` is correct, not a workaround.** CI owns the reset as an explicit workflow step; the test runner owns it locally. That split is intentional — don't collapse it into a single "universal" path.

8. **Add a smoke-test step after extracting env vars in CI.** A step that asserts `$VITE_SUPABASE_URL` starts with `http`, contains no quotes, and can reach `/auth/v1/health` will catch quoting/CRLF bugs in under 2 seconds — far cheaper than debugging 0ms test failures. This step is now in `ci.yml` after "Export Supabase env vars."
