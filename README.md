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

## Daily use

```bash
npm run dev
```

The default `npm run dev` points at the **cloud** Supabase project (`.env`). If the cloud project is paused or you want to work offline, use local Supabase instead (see below).

---

## Local development with Supabase

To run the full stack locally (no cloud dependency):

**1. Start the local Supabase Docker stack:**
```bash
supabase start
```

**2. Seed the database:**
```bash
supabase db reset --local
```
This applies all migrations and loads `supabase/seed.sql`, which creates the test user and four sample contacts.

**3. Run the dev server pointed at local Supabase:**
```bash
npm run dev:local
```
App runs at `http://localhost:5173`. Sign in with:
- **Email:** `playwright@example.com`
- **Password:** `playwright-test-pw!`

**To stop:**
```bash
supabase stop
```

> Data added during a local session is wiped the next time you run `supabase db reset --local`. This is intentional — the local stack is for development and testing, not persistent data.

---

## Testing

**Unit tests (162):**
```bash
npm test -- --run
```

**E2E tests (11 Playwright tests against local Supabase):**
```bash
# Supabase must be running first
supabase start

npm run test:e2e
```
The Playwright suite automatically runs `supabase db reset --local` before starting (via `globalSetup`), so the database is always in a clean seed state regardless of what a prior run left behind. You do not need to run `db reset` manually before E2E tests.

**CI:** GitHub Actions runs both test suites on every push to `main` (see `.github/workflows/ci.yml`). The workflow starts its own local Supabase stack — no cloud credentials needed.

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
│   │   └── LoginPage.tsx         # Supabase Auth sign-in / sign-up
│   ├── hooks/
│   │   ├── useContacts.ts        # Supabase CRUD + camelCase↔snake_case mapping
│   │   └── useGoalSettings.ts    # Goals upsert
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client
│   │   └── AuthContext.tsx       # Session provider
│   └── utils/
│       └── csvParser.ts          # CSV import / export logic
├── supabase/                     # Supabase CLI config (linked project)
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
| 2 | AI writing assistant — email drafts, call scripts, thank-you notes via Claude API + Supabase Edge Function |
| 3 | SaaS / multi-user — Stripe billing, org-level isolation, configurable project name |
