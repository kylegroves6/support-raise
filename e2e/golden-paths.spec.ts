import { test, expect, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const TEST_EMAIL = 'playwright@example.com'
const TEST_PASSWORD = 'playwright-test-pw!'

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByLabel('Email').fill(TEST_EMAIL)
  await page.getByLabel('Password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

import { supabaseUrl as SUPABASE_URL, supabaseAnonKey as SUPABASE_KEY } from '../playwright.config'

// Returns a JWT for the test user (used by cleanup helpers).
async function getTestToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const authRes = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  })
  const { access_token } = await authRes.json() as { access_token: string }
  return access_token
}

// Deletes contacts created by these tests via Supabase REST API so runs are idempotent.
async function cleanupTestContacts(request: import('@playwright/test').APIRequestContext) {
  const token = await getTestToken(request)
  for (const firstName of ['PlaywrightTest', 'CSV', 'ValidationTest', 'ValidationTest2', 'AutoContactedTest', 'PhoneTest']) {
    await request.delete(`${SUPABASE_URL}/rest/v1/contacts?first_name=eq.${firstName}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
    })
  }
}

// Deletes trips created by E2E tests (by mission_name prefix) and restores the
// seeded trip as active so subsequent tests start from a known state.
async function cleanupTestTrips(request: import('@playwright/test').APIRequestContext) {
  const token = await getTestToken(request)
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  // Delete any trips created by E2E tests (match by name prefix)
  await request.delete(`${SUPABASE_URL}/rest/v1/trips?mission_name=like.E2ETest*`, { headers })
  // Re-activate the original seeded trip (most recent remaining trip)
  const tripsRes = await request.get(`${SUPABASE_URL}/rest/v1/trips?select=id&order=created_at.asc&limit=1`, { headers })
  const trips = await tripsRes.json() as { id: string }[]
  if (trips.length > 0) {
    await request.patch(`${SUPABASE_URL}/rest/v1/trips?id=eq.${trips[0].id}`, {
      headers,
      data: { is_active: true },
    })
  }
}

async function cleanupGoalState(request: import('@playwright/test').APIRequestContext) {
  const token = await getTestToken(request)
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  await request.delete(`${SUPABASE_URL}/rest/v1/additional_raising?label=eq.E2E Postage`, { headers })
  await request.patch(`${SUPABASE_URL}/rest/v1/trips?is_active=eq.true`, {
    headers,
    data: { trip_cost: 0 },
  })
}

// Clean test data before the suite so each run starts with a predictable state.
test.beforeAll(async ({ request }) => {
  await cleanupTestContacts(request)
  await cleanupTestTrips(request)
  await cleanupGoalState(request)
})

// ── 1. Sign in ─────────────────────────────────────────────────────────────

test('sign in with email and password', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()

  await page.getByLabel('Email').fill(TEST_EMAIL)
  await page.getByLabel('Password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()

  // After sign-in, the login page should disappear and the app loads
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })
})

// ── 2. Add a contact manually ───────────────────────────────────────────────

test('add a contact manually', async ({ page }) => {
  await signIn(page)

  // Wait for app to load past login
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Contacts' }).click()

  const addBtn = page.getByRole('button', { name: /add contact/i })
  await expect(addBtn).toBeVisible({ timeout: 8000 })
  await addBtn.click()

  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()

  await modal.getByLabel(/first name/i).fill('PlaywrightTest')
  await modal.getByLabel(/last name/i).fill('Person')
  await modal.getByRole('button', { name: /add contact|save changes/i }).click()

  await expect(modal).not.toBeVisible({ timeout: 5000 })
  await expect(page.getByText('PlaywrightTest Person')).toBeVisible()
})

// ── 3. Import a CSV ─────────────────────────────────────────────────────────

test('import a valid CSV and verify contact count increases', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Contacts' }).click()

  // Wait for contacts to finish loading
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible({ timeout: 8000 })

  // Build a minimal valid CSV in a temp file
  const csv = [
    'Full Name,Relationship',
    'CSV Import Alpha,Friend',
    'CSV Import Beta,Family',
  ].join('\n')
  const tmpDir = os.tmpdir()
  const csvPath = path.join(tmpDir, 'test-import.csv')
  fs.writeFileSync(csvPath, csv)

  // Open the import dropdown then click "Import CSV"
  const importDropdown = page.getByRole('button', { name: /^import$/i })
  await expect(importDropdown).toBeVisible({ timeout: 8000 })
  await importDropdown.click()
  await page.getByRole('button', { name: /import csv/i }).click()

  // CSVImport modal is now open — set the file directly on the hidden input
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(csvPath)

  // Wait for preview to appear, then confirm import
  await expect(page.getByRole('button', { name: /import \d+ contact/i })).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: /import \d+ contact/i }).click()

  // Verify both imported contacts appear in the table
  await expect(page.getByText('CSV Import Alpha')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('CSV Import Beta')).toBeVisible()
})

// ── 4. Edit gift amount and verify it saves ─────────────────────────────────

test('edit a contact gift amount and verify it saves', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Contacts' }).click()

  // Click the first contact row to open the edit modal
  const firstRow = page.locator('tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 8000 })
  await firstRow.click()

  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()

  // Fill gift amount with all required fields to pass validation
  const giftInput = modal.getByLabel(/gift amount/i)
  await giftInput.clear()
  await giftInput.fill('250')

  // Form of Gift is required when amount > 0
  // The Form of Gift select trigger is inside the label "Form of Gift"
  await modal.locator('label', { hasText: /form of gift/i }).locator('button[role="combobox"]').click()
  await page.locator('[role="option"]', { hasText: 'Check' }).click()

  // Date Received is required when amount > 0
  await modal.getByLabel(/date received/i).fill('2026-01-15')

  // Financial Partner or Pledged to Give is required when amount > 0
  // Toggle Financial Partner on (this also auto-sets Contacted)
  const fpToggle = modal.locator('label').filter({ hasText: /^Financial Partner$/ }).locator('div').first()
  await fpToggle.click()

  await modal.getByRole('button', { name: /save/i }).click()
  await expect(modal).not.toBeVisible({ timeout: 5000 })

  // Re-open same contact and verify saved value
  await firstRow.click()
  await expect(page.getByRole('dialog').getByLabel(/gift amount/i)).toHaveValue('250')
})

// ── 6a. Gift amount with missing Form of Gift is blocked ────────────────────

test('gift amount with missing Form of Gift is blocked', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Contacts' }).click()

  const addBtn = page.getByRole('button', { name: /add contact/i })
  await expect(addBtn).toBeVisible({ timeout: 8000 })
  await addBtn.click()

  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()

  await modal.getByLabel(/first name/i).fill('ValidationTest')
  await modal.getByLabel(/gift amount/i).fill('100')
  // Set date and partner status but NOT form of gift
  await modal.getByLabel(/date received/i).fill('2026-01-15')
  const fpToggle = modal.locator('label').filter({ hasText: 'Financial Partner' }).locator('div').first()
  await fpToggle.click()

  await modal.getByRole('button', { name: /add contact/i }).click()

  // Modal should still be visible (save blocked)
  await expect(modal).toBeVisible()
  // Error message should appear
  await expect(modal.getByText(/form of gift is required/i)).toBeVisible()
})

// ── 6b. Gift amount with no partner status is blocked ───────────────────────

test('gift amount with no partner status is blocked', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Contacts' }).click()

  const addBtn = page.getByRole('button', { name: /add contact/i })
  await expect(addBtn).toBeVisible({ timeout: 8000 })
  await addBtn.click()

  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()

  await modal.getByLabel(/first name/i).fill('ValidationTest2')
  await modal.getByLabel(/gift amount/i).fill('50')
  // Set form of gift and date but NOT partner status
  await modal.locator('label', { hasText: /form of gift/i }).locator('button[role="combobox"]').click()
  await page.locator('[role="option"]', { hasText: 'Cash' }).click()
  await modal.getByLabel(/date received/i).fill('2026-02-20')

  await modal.getByRole('button', { name: /add contact/i }).click()

  // Modal should still be visible (save blocked)
  await expect(modal).toBeVisible()
  await expect(modal.getByText(/mark as financial partner or pledged/i)).toBeVisible()
})

// ── 6c. Financial Partner auto-sets Contacted ───────────────────────────────

test('Financial Partner auto-sets Contacted', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Contacts' }).click()

  const addBtn = page.getByRole('button', { name: /add contact/i })
  await expect(addBtn).toBeVisible({ timeout: 8000 })
  await addBtn.click()

  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()

  await modal.getByLabel(/first name/i).fill('AutoContactedTest')

  // Verify Contacted is initially off by finding its toggle div
  const contactedToggle = modal.locator('label').filter({ hasText: 'Contacted' }).locator('div').first()
  // The toggle background starts as bg-stone-light (not bg-sage-400)
  await expect(contactedToggle).not.toHaveClass(/bg-sage-400/)

  // Toggle Financial Partner on
  const fpToggle = modal.locator('label').filter({ hasText: 'Financial Partner' }).locator('div').first()
  await fpToggle.click()

  // Contacted should now be auto-set (bg-sage-400)
  await expect(contactedToggle).toHaveClass(/bg-sage-400/)
})

// ── 5. Export CSV and verify it round-trips through parseCSV ────────────────

test('export CSV and verify it contains expected columns', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Contacts' }).click()

  const exportBtn = page.getByRole('button', { name: /export/i })
  await expect(exportBtn).toBeVisible({ timeout: 8000 })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportBtn.click(),
  ])

  const tmpPath = path.join(os.tmpdir(), download.suggestedFilename())
  await download.saveAs(tmpPath)

  const content = fs.readFileSync(tmpPath, 'utf-8')
  expect(content).toMatch(/First Name/)
  expect(content).toMatch(/Relationship/)
  expect(content.split('\n').length).toBeGreaterThan(1)
})

// ── 7. Create new trip — verify dashboard trip name + positive days-until ─────

test('create new trip and verify dashboard shows trip name and positive days-until', async ({ page, request }) => {
  // Compute a start date 30 days from today in YYYY-MM-DD
  const missionStart = new Date()
  missionStart.setDate(missionStart.getDate() + 30)
  const startISO = missionStart.toISOString().slice(0, 10)
  const tripName = 'E2ETest New Trip'

  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })

  // Open the trip menu in the header and click "New trip"
  await page.locator('header').getByRole('button').first().click()
  await page.getByRole('button', { name: 'New trip' }).click()

  // TripRollover modal should appear
  const modal = page.getByRole('dialog').filter({ hasText: 'Start a new trip' })
    .or(page.locator('.fixed.inset-0').filter({ hasText: 'Start a new trip' }))
  await expect(page.getByText('Start a new trip')).toBeVisible({ timeout: 5000 })

  // Fill in the new trip form
  await page.getByPlaceholder(/e.g. Tokyo Mission 2027/i).fill(tripName)
  // Start date input (label: "Start date" in the rollover modal)
  const startInputs = page.locator('input[type="date"]')
  await startInputs.first().fill(startISO)

  await page.getByRole('button', { name: /start new trip/i }).click()

  // Wait for the modal to close and the dashboard to reflect the new trip
  await expect(page.getByText('Start a new trip')).not.toBeVisible({ timeout: 10000 })

  // Dashboard header should show the new trip name
  await expect(page.getByText(tripName)).toBeVisible({ timeout: 8000 })

  // Dashboard should show a positive "days until departure" count
  await expect(page.getByText('days until departure')).toBeVisible({ timeout: 8000 })
  const daysText = await page.locator('text=days until departure').locator('..').locator('p').first().textContent()
  const days = parseInt(daysText ?? '0', 10)
  expect(days).toBeGreaterThan(0)

  // Cleanup: remove the test trip and restore original
  await cleanupTestTrips(request)
})

// ── 8. Set trip cost + additional raising item — verify total goal math ────────

test('trip cost + additional raising item sum equals total goal on dashboard', async ({ page, request }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })

  // Navigate to Dashboard
  await page.getByRole('button', { name: 'Dashboard' }).click()

  // Open GoalSettings via "Edit goals"
  await expect(page.getByRole('button', { name: /edit goals/i })).toBeVisible({ timeout: 8000 })
  await page.getByRole('button', { name: /edit goals/i }).click()

  // GoalSettings modal should be visible
  await expect(page.getByText('Total Goal')).toBeVisible({ timeout: 5000 })

  // Set trip cost to 3000 — use the label to anchor to the right input
  const tripCostLabel = page.getByText('Trip Cost', { exact: true })
  const tripCostInput = tripCostLabel.locator('~ div input[type="number"]')
  await tripCostInput.clear()
  await tripCostInput.fill('3000')

  // Save button is the sibling of the input's parent div
  await tripCostLabel.locator('~ div button').click()

  // Add an additional raising item: label "E2E Postage", amount 200
  await page.getByPlaceholder(/label/i).fill('E2E Postage')
  const amountInputs = page.locator('input[type="number"]')
  await amountInputs.last().fill('200')
  await page.getByRole('button', { name: /^add$/i }).click()

  // Verify the computed total in GoalSettings shows 3,200
  await expect(page.getByText('$3,200').first()).toBeVisible({ timeout: 5000 })

  // Close the modal
  await page.getByRole('button', { name: /close/i }).click()
  await expect(page.getByText('Total Goal')).not.toBeVisible({ timeout: 5000 })

  // Dashboard should now show "of $3,200" in the support goal card
  await expect(page.getByText(/of \$3,200/)).toBeVisible({ timeout: 8000 })

  // Cleanup: remove all E2E Postage rows (handles duplicates from prior failed runs)
  // and reset trip cost to 0 on the active trip
  const token = await getTestToken(request)
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  await request.delete(`${SUPABASE_URL}/rest/v1/additional_raising?label=eq.E2E Postage`, { headers })
  await request.patch(`${SUPABASE_URL}/rest/v1/trips?is_active=eq.true`, {
    headers,
    data: { trip_cost: 0 },
  })
})

// ── 9. Phone field normalizes on blur in ContactModal ─────────────────────────

test('phone field normalizes to XXX-XXX-XXXX format on blur', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Contacts' }).click()

  const addBtn = page.getByRole('button', { name: /add contact/i })
  await expect(addBtn).toBeVisible({ timeout: 8000 })
  await addBtn.click()

  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()

  await modal.getByLabel(/first name/i).fill('PhoneTest')
  await modal.getByLabel(/last name/i).fill('Person')

  // Type a formatted US phone number into the phone field
  const phoneInput = modal.locator('input[type="tel"]')
  await phoneInput.fill('(555) 867-5309')

  // Tab away to trigger onBlur normalization
  await phoneInput.press('Tab')

  // Field should now show normalized XXX-XXX-XXXX
  await expect(phoneInput).toHaveValue('555-867-5309')

  // Close without saving — no DB cleanup needed
  await modal.getByRole('button', { name: /cancel/i }).click()
  await expect(modal).not.toBeVisible({ timeout: 5000 })
})
