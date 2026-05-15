# Claude Code — project rules for Support Raising

These rules are permanent and override default behavior every session.

---

## Database safety — non-negotiable

### Never push to remote without explicit confirmation
`supabase db push` writes to the **production Supabase project** (`wzfrfgqnjkvgadsqtgvb`).
Never run it, suggest it, or let it happen automatically. Always stop and ask:
> "Ready to push this migration to the remote (production) database — confirm?"

### Always develop against local first
The correct migration workflow is:
1. Write the `.sql` file in `supabase/migrations/`
2. Apply to **local** via docker:
   ```
   docker exec supabase_db_Support-Raising psql -U postgres -d postgres < supabase/migrations/<file>.sql
   ```
3. Verify the table/column exists locally:
   ```
   supabase db query "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
   ```
4. Run tests (`npx vitest run`) — all must pass
5. **Only then**, with explicit user confirmation, run `supabase db push`

### Take a schema backup before any remote change
Before running `supabase db push`, always dump the current remote schema first:
```
supabase db dump --linked --schema-only > backups/schema-remote-$(date +%Y%m%d-%H%M).sql
```
Keep backups in `backups/`. They are gitignored (add `backups/` to `.gitignore` if not already there).

### Migration hygiene (existing rule — keep it)
1. Every schema change lives in a numbered file in `supabase/migrations/`
2. Migration file is committed to git alongside the code that depends on it
3. Never run DDL in the Supabase dashboard SQL editor or Studio — migrations only
4. Run `supabase migration list` before any push to verify local/remote are in sync

---

## Dev environment

### Two environments — never mix them up

| | Local | Production |
|---|---|---|
| Supabase URL | `http://127.0.0.1:54321` | `https://wzfrfgqnjkvgadsqtgvb.supabase.co` |
| Dev server | `npm run dev:local` | `npm run dev` |
| Postgres container | `supabase_db_Support-Raising` | remote cloud (never touch directly) |
| Data | wiped on `supabase db reset --local` | persistent — real user data |

### Starting local Supabase (requires Docker running)

```bash
supabase start          # boots the local docker stack
supabase db reset --local  # applies all migrations + seed.sql (wipes data)
npm run dev:local       # dev server pointed at local Supabase
```

Local login: `playwright@example.com` / `playwright-test-pw!`

### Stopping local Supabase

```bash
supabase stop
```

### Default dev server points at production

`npm run dev` (no `:local`) connects to the live Supabase project. Never run this for feature development — use `npm run dev:local`.

---

## Testing

- Run `npx vitest run` before starting any feature and after finishing
- All tests must pass before committing
- Never push if tests are failing

**Unit tests:**
```bash
npx vitest run
```

**E2E tests (requires local Supabase running first):**
```bash
supabase start
npm run test:e2e
```
The Playwright suite runs `supabase db reset --local` automatically via `globalSetup` — no manual reset needed.

---

## General coding rules

- No comments unless the WHY is non-obvious
- No modal, no abstraction beyond what the task requires
- Prefer editing existing files over creating new ones
- Do not push to the remote git repository unless explicitly asked

---

## Key facts about this project

- Local Supabase: `http://127.0.0.1:54321` — local postgres container: `supabase_db_Support-Raising`
- Remote Supabase project ID: `wzfrfgqnjkvgadsqtgvb` (production — treat with care)
- Stack: Vite + React + TypeScript + Tailwind, deployed to Vercel
- camelCase ↔ snake_case mapping lives in `src/hooks/useContacts.ts`
- RLS pattern: `(SELECT auth.uid()) = user_id` on all tables, all operations
- `returning` is a Postgres reserved word — always quoted as `"returning"` in SQL
- Couple contacts use flat `is_couple boolean` + `spouse_first_name text` columns on `contacts` (migration `20260511200000`). No separate household table.
