import { execSync } from 'child_process'

export default function globalSetup() {
  // CI runs `supabase db reset --local` as its own step before invoking Playwright.
  // Running it again here would restart containers a second time and leave the auth
  // service briefly unavailable when the first test fires. Skip it in CI.
  if (process.env.CI) return

  execSync('supabase db reset --local', { stdio: 'inherit' })
}
