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
