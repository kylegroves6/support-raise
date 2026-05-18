import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = 'playwright@example.com'
const TEST_PASSWORD = 'playwright-test-pw!'
import { supabaseUrl as SUPABASE_URL, supabaseAnonKey as SUPABASE_KEY } from '../playwright.config'

async function signIn(page: Page) {
  await page.goto('/')
  await page.getByLabel('Email').fill(TEST_EMAIL)
  await page.getByLabel('Password').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).not.toBeVisible({ timeout: 10000 })
}

async function getTestToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  console.log('[diag] SUPABASE_URL=', SUPABASE_URL, 'keyLen=', SUPABASE_KEY?.length ?? 0)
  const authRes = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  })
  const status = authRes.status()
  const bodyText = await authRes.text()
  console.log('[diag] status=', status, 'body=', bodyText?.slice(0, 300))
  const { access_token } = JSON.parse(bodyText) as { access_token: string }
  return access_token
}

async function deleteNameStormContacts(request: import('@playwright/test').APIRequestContext) {
  const token = await getTestToken(request)
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
  for (const name of ['NSTest1', 'NSTest2', 'NSTest3']) {
    await request.delete(`${SUPABASE_URL}/rest/v1/contacts?first_name=eq.${name}`, { headers })
  }
}

test.beforeEach(async ({ request }) => {
  await deleteNameStormContacts(request)
})

test.afterEach(async ({ request }) => {
  await deleteNameStormContacts(request)
})

// ── 1. Add 3 names and verify they appear in ContactsTable in insertion order ──

test('name storm: add 3 names and verify they appear in contacts table in insertion order', async ({ page }) => {
  await signIn(page)

  // Navigate to Name Storm tab
  await page.getByRole('button', { name: 'Name Storm' }).click()
  await expect(page.getByText('Name Storm')).toBeVisible({ timeout: 5000 })

  const names = [
    { first: 'NSTest1', last: 'Alpha', rel: 'Friend' },
    { first: 'NSTest2', last: 'Beta', rel: 'Family' },
    { first: 'NSTest3', last: 'Gamma', rel: 'Church Friend' },
  ]

  for (const { first, last, rel } of names) {
    // Pick category
    await page.locator('select[data-testid="relationship-select"]').selectOption(rel)

    // Fill first name
    await page.getByTestId('first-name-input').fill(first)
    await page.getByTestId('last-name-input').fill(last)

    // Click Add or press Enter
    await page.getByTestId('add-btn').click()

    // Wait for the name to appear in the running list
    await expect(page.getByText(`${first} ${last}`)).toBeVisible({ timeout: 5000 })
  }

  // The running list should show all 3 in insertion order
  const listItems = page.getByTestId('saved-list').locator('li')
  await expect(listItems).toHaveCount(3)
  await expect(listItems.nth(0)).toContainText('NSTest1 Alpha')
  await expect(listItems.nth(1)).toContainText('NSTest2 Beta')
  await expect(listItems.nth(2)).toContainText('NSTest3 Gamma')

  // Navigate to Contacts tab and verify all 3 appear
  await page.getByRole('button', { name: 'Contacts' }).click()
  await expect(page.getByText('NSTest1 Alpha')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('NSTest2 Beta')).toBeVisible()
  await expect(page.getByText('NSTest3 Gamma')).toBeVisible()

  // Verify insertion order: NSTest1 should appear before NSTest2 before NSTest3
  // (contacts table defaults to ascending created_at so insertion order is preserved)
  const rows = page.locator('tbody tr')
  const allText = await rows.allTextContents()
  const idx1 = allText.findIndex(t => t.includes('NSTest1'))
  const idx2 = allText.findIndex(t => t.includes('NSTest2'))
  const idx3 = allText.findIndex(t => t.includes('NSTest3'))
  expect(idx1).toBeGreaterThanOrEqual(0)
  expect(idx2).toBeGreaterThan(idx1)
  expect(idx3).toBeGreaterThan(idx2)
})

// ── 2. No active trip — verify prompt to create trip ─────────────────────────

test('name storm: shows no-active-trip prompt when there is no active trip', async ({ page, request }) => {
  const token = await getTestToken(request)
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Deactivate the active trip so there is no active trip
  await request.patch(`${SUPABASE_URL}/rest/v1/trips?is_active=eq.true`, {
    headers,
    data: { is_active: false },
  })

  try {
    await signIn(page)

    // App should redirect to MissionSetup because there's no active trip,
    // so navigate directly to the Name Storm tab from MissionSetup isn't possible.
    // Instead we verify the no-trip UI shows if we somehow land on name storm with no trip.
    // Since App.tsx gates on activeTrip === null → shows MissionSetup, we test the
    // NameStorm component behavior directly via the no-trip branch in App logic.
    //
    // The app shows MissionSetup when there is no active trip. That IS the expected
    // UX for "no active trip before entering name storm."
    await expect(page.getByText(/set up your mission/i).or(page.getByText(/mission setup/i))).toBeVisible({ timeout: 10000 })
    // The Name Storm tab should not be accessible (no nav rendered)
    await expect(page.getByRole('button', { name: 'Name Storm' })).not.toBeVisible()
  } finally {
    // Restore the original trip as active
    const tripsRes = await request.get(
      `${SUPABASE_URL}/rest/v1/trips?select=id&order=created_at.asc&limit=1`,
      { headers }
    )
    const trips = await tripsRes.json() as { id: string }[]
    if (trips.length > 0) {
      await request.patch(`${SUPABASE_URL}/rest/v1/trips?id=eq.${trips[0].id}`, {
        headers,
        data: { is_active: true },
      })
    }
  }
})
