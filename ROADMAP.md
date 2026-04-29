# Support Raising Tracker — Roadmap

## Current State (v0.2 — April 2026)
- Vite + React + Tailwind SPA (keeping Vite — no Next.js migration planned)
- All data in browser `localStorage` (keys: `tokyo-mission-contacts`, `tokyo-mission-goals`)
- CSV import and export for manual backups
- **Risk:** data is browser-local; clearing site data or switching devices loses everything

---

## Phase 1 — Docker Compose + Postgres (priority: high)

Replace localStorage with a real database running locally in Docker. No cloud dependency, data survives browser clears.

### Stack
- **API layer:** Express (Node) or Fastify — thin REST layer over Postgres
  - keeps the frontend untouched
  - endpoints mirror current hook surface: contacts CRUD, goals CRUD
- **Database:** Postgres 16 in Docker
- **Migrations:** `node-pg-migrate` or `db-migrate` — keeps schema versioned in git
- **Auth:** static API key in `.env` — enough for personal use, swapped for Supabase Auth in Phase 3

### docker-compose.yml services
```
web        Vite dev server (or built static files via nginx)
api        Node/Express API on port 3001
db         postgres:16-alpine, volume-mounted at ./data/postgres
```

### Data model (Postgres)
```sql
-- contacts
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id             UUID NOT NULL                  -- RLS prep: always filter by this
full_name           TEXT NOT NULL
relationship        TEXT
returning           BOOLEAN DEFAULT false
top_priority        INT
address_status      TEXT
sent                BOOLEAN DEFAULT false
letter_address_name TEXT
salutation          TEXT
letter_printed      BOOLEAN DEFAULT false
main_envelope_printed BOOLEAN DEFAULT false
thank_you_sent      BOOLEAN DEFAULT false
notes               TEXT
street_address      TEXT
city                TEXT
state               TEXT
zip                 TEXT
phone               TEXT
call_made           BOOLEAN DEFAULT false
email               TEXT
financial_partner   BOOLEAN DEFAULT false
prayer_partner      BOOLEAN DEFAULT false
pledged_to_give     BOOLEAN DEFAULT false
form_of_gift        TEXT
gift_amount         NUMERIC(10,2)
date_received       TEXT
created_at          TIMESTAMPTZ DEFAULT now()
updated_at          TIMESTAMPTZ DEFAULT now()

-- goals (one row per user)
id                  UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id             UUID NOT NULL
trip_cost           NUMERIC(10,2) NOT NULL DEFAULT 5525
food_reimbursement  NUMERIC(10,2) NOT NULL DEFAULT 400
sf_flight           NUMERIC(10,2) NOT NULL DEFAULT 400
updated_at          TIMESTAMPTZ DEFAULT now()
```

### Migration path from localStorage
1. Export current data to CSV from the app (Export CSV button in Contacts tab)
2. Run `docker compose up`
3. Seed script reads CSV → inserts into Postgres
4. Swap `useContacts.js` and `useGoalSettings.js` to call `fetch('/api/contacts')` instead of localStorage

### .gitignore additions needed
```
data/postgres/   # docker volume mount — never commit DB files
.env             # already ignored
```

---

## Phase 2 — Row-Level Security (RLS) prep (baked into Phase 1)

Already accounted for in the schema above — `user_id` column on every table from day one.

- API middleware attaches `user_id` from the auth token to every query (`WHERE user_id = $1`)
- This is exactly the pattern Supabase RLS uses — migrating to Supabase later requires no schema changes

---

## Phase 3 — Supabase migration (priority: future / optional)

When ready to move off the local Docker stack:

1. `pg_dump` local Postgres → restore into a Supabase project
2. Replace Express API with Supabase client SDK (`@supabase/supabase-js`)
   - swap `fetch('/api/contacts')` calls with `supabase.from('contacts').select()`
3. Enable **Supabase Auth** (magic link or email+password) — replaces the static API key
4. Enable RLS policies in Supabase dashboard — `user_id` column already in place from Phase 1
5. Deploy frontend to Vercel or Netlify (free tier)

Because RLS was wired in Phase 1, this migration is mostly a client-swap, not a schema rewrite.

---

## Phase 4 — AI writing assistant (priority: future / optional)

Possible use: draft emails, call scripts, text messages, and initial support letters based on contact data.

- Claude API (`claude-sonnet-4-6` or newer) via a serverless function or Supabase Edge Function
- Inputs: contact name, relationship, stage (sent/called/pledged), any notes
- Outputs: suggested email draft, call script bullet points, thank-you note
- Keep AI as a drafting tool only — user always reviews before sending
- Requires Supabase (Phase 3) first so API keys are server-side and never exposed in the browser

---

## Phase 5 — SaaS / multi-user (priority: future)

If this becomes a product for other missionaries/support-raisers:
- Supabase Auth handles sign-up/login (already in place from Phase 3)
- RLS already enforces per-user data isolation
- Stripe for billing (if needed)
- `organization_id` column for team use (e.g. a mission agency managing multiple raisers)
- Branding / theming: replace "Tokyo Mission" hardcoded strings with user-configurable project names

---

## Decisions made
- **Keeping Vite** — Next.js migration not planned; Vite + Express is the right fit for personal use and a potential small SaaS
- **Supabase Auth** for authentication when moving to cloud (not rolling custom auth)
- **AI assistance** deferred until after Supabase is in place (needs server-side key handling)

---

## Immediate next step

Export a CSV backup from the Contacts tab before starting Phase 1. That file is your safety net if anything goes wrong during the database migration.
