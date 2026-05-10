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

  const addBtn = page.getByRole('button', { name: /add contact/i })
  await expect(addBtn).toBeVisible({ timeout: 8000 })
  await addBtn.click()

  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()

  await modal.getByLabel(/full name/i).fill('Playwright Test Person')
  await modal.getByRole('button', { name: /save/i }).click()

  await expect(modal).not.toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Playwright Test Person')).toBeVisible()
})

// ── 3. Import a CSV ─────────────────────────────────────────────────────────

test('import a valid CSV and verify contact count increases', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })

  // Count contacts before import
  const rows = page.locator('tbody tr')
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

  const importBtn = page.getByRole('button', { name: /import/i })
  await expect(importBtn).toBeVisible({ timeout: 8000 })
  await importBtn.click()

  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(csvPath)

  // Confirm in the preview/modal
  await page.getByRole('button', { name: /import/i }).last().click()

  // Table should grow by 2
  await expect(rows).toHaveCount(countBefore + 2, { timeout: 8000 })
})

// ── 4. Edit gift amount and verify it saves ─────────────────────────────────

test('edit a contact gift amount and verify it saves', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })

  // Click the first contact row to open the edit modal
  const firstRow = page.locator('tbody tr').first()
  await expect(firstRow).toBeVisible({ timeout: 8000 })
  await firstRow.click()

  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()

  const giftInput = modal.getByLabel(/gift amount/i)
  await giftInput.clear()
  await giftInput.fill('250')

  await modal.getByRole('button', { name: /save/i }).click()
  await expect(modal).not.toBeVisible({ timeout: 5000 })

  // Re-open same contact and verify saved value
  await firstRow.click()
  await expect(page.getByRole('dialog').getByLabel(/gift amount/i)).toHaveValue('250')
})

// ── 5. Export CSV and verify it round-trips through parseCSV ────────────────

test('export CSV and verify it contains expected columns', async ({ page }) => {
  await signIn(page)
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })

  const exportBtn = page.getByRole('button', { name: /export/i })
  await expect(exportBtn).toBeVisible({ timeout: 8000 })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    exportBtn.click(),
  ])

  const tmpPath = path.join(os.tmpdir(), download.suggestedFilename())
  await download.saveAs(tmpPath)

  const content = fs.readFileSync(tmpPath, 'utf-8')
  expect(content).toMatch(/Full Name/)
  expect(content).toMatch(/Relationship/)
  expect(content.split('\n').length).toBeGreaterThan(1)
})
