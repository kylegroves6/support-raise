# Support Raising Tracker — Roadmap

## Current State (v0.1 — April 2026)
- Vite + React + Tailwind SPA
- All data in browser `localStorage` (keys: `tokyo-mission-contacts`, `tokyo-mission-goals`)
- CSV import/export for manual backups
- **Risk:** data is browser-local; clearing site data or switching devices loses everything

---

## Phase 1 — Docker Compose + Postgres (priority: high)

Replace localStorage with a real database running locally in Docker. No cloud dependency, data survives browser clears.

### Stack
- **API layer:** Express (Node) or Fastify — thin REST layer over Postgres
  - keeps the frontend untouched for now
  - endpoints mirror current hook surface: contacts CRUD, goals CRUD
- **Database:** Postgres 16 in Docker
- **Migrations:** `node-pg-migrate` or `db-migrate` — keeps schema versioned in git
- **Auth:** single-user HTTP Basic Auth (or a static API key in `.env`) — enough for personal use, sufficient foundation for multi-user later

### docker-compose.yml services
```
web        Vite dev server (or built static files via nginx)
api        Node/Express API on port 3001
db         postgres:16-alpine, volume-mounted at ./data/postgres
```

### Data model (Postgres)
```sql
-- contacts
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
full_name   TEXT NOT NULL
relationship TEXT
phone       TEXT
email       TEXT
sent        BOOLEAN DEFAULT false
call_made   BOOLEAN DEFAULT false
financial_partner BOOLEAN DEFAULT false
gift_amount NUMERIC(10,2)
pledged_to_give   BOOLEAN DEFAULT false
prayer_partner    BOOLEAN DEFAULT false
top_priority      INT
thank_you_sent    BOOLEAN DEFAULT false
notes       TEXT
created_at  TIMESTAMPTZ DEFAULT now()
updated_at  TIMESTAMPTZ DEFAULT now()

-- goals
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
trip_cost         NUMERIC(10,2) NOT NULL DEFAULT 5525
food_reimbursement NUMERIC(10,2) NOT NULL DEFAULT 400
sf_flight         NUMERIC(10,2) NOT NULL DEFAULT 400
updated_at  TIMESTAMPTZ DEFAULT now()
```

### Migration path from localStorage
1. Export current data to CSV from the app
2. Run Docker stack
3. Seed script reads CSV → inserts into Postgres
4. Swap `useContacts.js` and `useGoalSettings.js` to call `fetch('/api/contacts')` instead of localStorage

### .gitignore additions needed
```
data/postgres/   # docker volume mount — never commit DB files
.env             # already ignored
```

---

## Phase 2 — Row-Level Security (RLS) prep (priority: medium)

Do this in Phase 1 so the schema doesn't need to change later.

- Add a `user_id UUID` column to `contacts` and `goals` tables (even if only one user exists now)
- API middleware attaches `user_id` from the auth token to every query (`WHERE user_id = $1`)
- This is exactly the pattern Supabase RLS uses — migration to Supabase later requires no schema changes

---

## Phase 3 — Supabase migration (priority: future / optional)

When ready to move off the local Docker stack:

1. `pg_dump` local Postgres → restore into a Supabase project
2. Replace Express API with Supabase client SDK (`@supabase/supabase-js`)
   - swap `fetch('/api/contacts')` calls with `supabase.from('contacts').select()`
3. Enable Supabase Auth (magic link or email+password) — replace the static API key
4. Enable RLS policies in Supabase dashboard — `user_id` column already in place from Phase 2
5. Deploy frontend to Vercel or Netlify (free tier)

Because RLS was wired in Phase 2, this migration is mostly a client-swap, not a schema rewrite.

---

## Phase 4 — Next.js migration (priority: low / to-do)

Consider if/when the app needs:
- Server-side rendering (SSR) for faster initial load
- API routes co-located with the frontend (eliminates the separate Express service)
- Multi-page routing beyond the current two-tab layout
- Better SEO (less relevant for a private tool)

### Migration approach
- Next.js App Router replaces Vite
- API routes (`app/api/contacts/route.ts`) replace the Express service
- Components are mostly copy-paste — Tailwind classes and JSX are identical
- `useContacts` and `useGoalSettings` hooks become server-action or fetch-based hooks

**Verdict:** Not worth doing before Phase 1–2. Vite works fine as a frontend talking to an Express API. Revisit if the app grows into a multi-user SaaS product.

---

## Phase 5 — SaaS / multi-user (priority: future)

If this becomes a product for other missionaries/support-raisers:
- Supabase Auth handles sign-up/login
- RLS already enforces per-user data isolation
- Stripe for billing (if needed)
- `organization_id` column for team use (e.g. a mission agency managing multiple raisers)
- Branding / theming: replace "Tokyo Mission" hardcoded strings with user-configurable project names

---

## Immediate next step

Before starting Phase 1, export a CSV backup of current localStorage data as a safety net.
