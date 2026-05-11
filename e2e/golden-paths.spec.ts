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

// Deletes contacts created by these tests via Supabase REST API so runs are idempotent.
async function cleanupTestContacts(request: import('@playwright/test').APIRequestContext) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY ?? ''

  // Sign in to get a JWT for RLS-authorized deletes
  const authRes = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: supabaseKey, 'Content-Type': 'application/json' },
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  })
  const { access_token } = await authRes.json() as { access_token: string }

  // Delete contacts with test first names
  for (const firstName of ['PlaywrightTest', 'CSV', 'ValidationTest', 'ValidationTest2', 'AutoContactedTest']) {
    await request.delete(`${supabaseUrl}/rest/v1/contacts?first_name=eq.${firstName}`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${access_token}` },
    })
  }
}

// Clean test data before the suite so each run starts with a predictable state.
test.beforeAll(async ({ request }) => {
  await cleanupTestContacts(request)
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

  // Wait for contacts to finish loading then count
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible({ timeout: 8000 })
  const countBefore = await rows.count()

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

  // Table should grow by 2
  await expect(rows).toHaveCount(countBefore + 2, { timeout: 8000 })
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
