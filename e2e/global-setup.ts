import { execSync } from 'child_process'

export default function globalSetup() {
  execSync('supabase db reset --local', { stdio: 'inherit' })
}
