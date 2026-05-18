# Tokyo Mission — Support Raising Tracker

A personal support-tracking app for missionaries. Manage contacts, pledge status, mailing workflow, and fundraising goals — all in one place.

**Stack:** Vite + React + TypeScript + Tailwind · Supabase (Postgres, Auth, RLS)

---

## Prerequisites

- Node.js 22+
- A Supabase account and project ([supabase.com](https://supabase.com))
- Supabase CLI (`brew install supabase/tap/supabase`) — for running migrations

---

## First-time setup

**1. Clone the repo and install dependencies:**
```bash
npm install
```

**2. Copy the env template and fill in your Supabase project values:**
```bash
cp .env.example .env
```
Find your values in the Supabase dashboard under **Settings → API**:
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable anon key>
```
These are safe to expose client-side — they are not secrets.

**3. Apply the database schema:**

Link the CLI to your project (one-time):
```bash
supabase link --project-ref <project-ref>
```

Run the migration:
```bash
supabase db push
```

**4. Start the dev server:**
```bash
npm run dev
```
App runs at http://localhost:5173. Sign up for an account on first visit.

---

## Development workflow

### Environments

| | Local | Staging | Production |
|---|---|---|---|
| URL | `http://localhost:5173` | Vercel staging URL | Vercel production URL |
| Database | Local Docker Postgres | Staging Supabase | Prod Supabase |
| Purpose | All active development | Verify before promoting | Live app — never develop here |

### Feature workflow

```bash
# 1. Branch off staging (never off main)
git checkout staging && git pull origin staging
git checkout -b feature/my-feature

# 2. Start local stack (requires Docker)
supabase start
supabase db reset --local   # applies all migrations + seed data
npm run dev:local            # http://localhost:5173
# sign in: playwright@example.com / playwright-test-pw!

# 3. Develop, then run tests before committing
npx vitest run               # unit tests — must pass
npm run test:e2e             # E2E tests (local Supabase must be running)

# 4. Commit and open PR to staging
git push origin feature/my-feature
# GitHub: open PR feature/* → staging
# CI runs automatically — must be green to merge
# After merge: migrations auto-apply to staging Supabase, Vercel builds staging preview

# 5. Open the staging Vercel URL and verify the feature works

# 6. Open PR staging → main to ship to production
# CI runs again — must be green to merge
# After merge: migrations auto-apply to prod, Vercel deploys

supabase stop   # when done for the day
```

> Local data is wiped on every `supabase db reset --local` — intentional. Local is for development, not persistence.

---

## Testing

**Unit tests:**
```bash
npx vitest run
```

**E2E tests (Playwright against local Supabase):**
```bash
supabase start
npm run test:e2e
```
`globalSetup` resets the database automatically before the suite — no manual reset needed.

**CI:** GitHub Actions runs both suites on every push and PR to `main` or `staging`. Spins up its own local Supabase stack — no cloud credentials needed in CI.

---

## Importing contacts

Use **Contacts → Import CSV** to bulk-load contacts from a Google Sheet export. Column headers must match exactly (see `src/utils/csvParser.ts` for the full mapping). Two modes:

- **Append** — adds new contacts, leaves existing ones alone
- **Replace all** — wipes existing contacts and loads the CSV fresh

---

## Database migrations

Schema changes are managed with the Supabase CLI. To apply a new migration:

```bash
supabase db query --linked "ALTER TABLE contacts ADD COLUMN ..."
```

Or create a migration file and push:
```bash
supabase migration new <name>
# edit supabase/migrations/<timestamp>_<name>.sql
supabase db push
```

---

## Project structure

```
.
├── src/
│   ├── App.tsx                   # Root — auth gate + layout
│   ├── types.ts                  # Shared Contact and Goals interfaces
│   ├── components/
│   │   ├── Dashboard.tsx         # Progress, stats, action lists
│   │   ├── ContactsTable.tsx     # Filterable, sortable contact list
│   │   ├── ContactModal.tsx      # Add / edit contact form
│   │   ├── CSVImport.tsx         # Import modal with diagnostics
│   │   ├── GoalSettings.tsx      # Trip cost / goal editor
│   │   ├── TripHistory.tsx       # Past trips list
│   │   ├── TripRollover.tsx      # Create new trip UI
│   │   ├── NameStorm.tsx         # Rapid name-entry brainstorm session
│   │   ├── RelationshipSelect.tsx # Constrained relationship combobox
│   │   └── LoginPage.tsx         # Supabase Auth sign-in / sign-up
│   ├── hooks/
│   │   ├── useContacts.ts        # Supabase CRUD + camelCase↔snake_case mapping
│   │   ├── useTrips.ts           # Trip create/select/history
│   │   ├── useAdditionalRaising.ts # Additional raising items CRUD
│   │   ├── useActivityLog.ts     # Activity log reads (follow-up chip)
│   │   └── useGoalSettings.ts    # Goals upsert
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client
│   │   └── AuthContext.tsx       # Session provider
│   └── utils/
│       ├── csvParser.ts          # CSV import / export + phone/date normalization
│       └── contactValidation.ts  # Field validation (email, phone, gift rules)
├── e2e/                          # Playwright E2E tests
├── supabase/
│   ├── migrations/               # All schema changes — never apply DDL outside this
│   ├── seed.sql                  # Deterministic test baseline for local dev + CI
│   └── config.toml               # Supabase CLI project config
├── .github/workflows/ci.yml      # GitHub Actions: unit + E2E on every push to main
├── .env.example                  # Env template — copy to .env
├── tsconfig.json
├── vite.config.ts
└── ROADMAP.md                    # Architecture decisions and future phases
```

---

## Moving to a new machine

1. Clone the repo
2. `npm install`
3. Copy `.env.example` → `.env` and fill in your Supabase credentials
4. `npm run dev` — data is in Supabase, nothing to migrate locally

---

## Future phases (see ROADMAP.md)

| Phase | What |
|-------|------|
| 2 | Multi-user readiness — quick-add contact form, relationship breakdown report, branch protection, activity heatmap |
| 2.5 | AI writing assistant — email drafts, call scripts, thank-you notes via Claude API + Supabase Edge Function |
| 3 | SaaS / multi-user — Stripe billing, org-level isolation, coach dashboard |
