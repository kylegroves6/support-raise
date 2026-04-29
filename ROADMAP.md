# Support Raising Tracker — Roadmap

## Current State (v0.4 — April 2026)
- Vite + React + Tailwind SPA
- Supabase for database, auth, and RLS
- No server-side component — Supabase JS client called directly from React hooks

---

## Phase 1 — Supabase ✓ complete

### Stack
- **Database:** Supabase cloud Postgres (free tier)
- **API layer:** `@supabase/supabase-js` client called directly from React hooks
- **Auth:** Supabase Auth (email/password)
- **RLS:** Row-level security so users only see their own data

### Env vars (`.env`)
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-key>
```

### Schema (already applied in Supabase SQL editor)
```sql
-- contacts
CREATE TABLE contacts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name             TEXT NOT NULL,
  relationship          TEXT,
  "returning"           BOOLEAN NOT NULL DEFAULT false,
  top_priority          INT,
  address_status        TEXT,
  sent                  BOOLEAN NOT NULL DEFAULT false,
  letter_address_name   TEXT,
  salutation            TEXT,
  letter_printed        BOOLEAN NOT NULL DEFAULT false,
  main_envelope_printed BOOLEAN NOT NULL DEFAULT false,
  thank_you_sent        BOOLEAN NOT NULL DEFAULT false,
  notes                 TEXT,
  street_address        TEXT,
  city                  TEXT,
  state                 TEXT,
  zip                   TEXT,
  phone                 TEXT,
  call_made             BOOLEAN NOT NULL DEFAULT false,
  email                 TEXT,
  financial_partner     BOOLEAN NOT NULL DEFAULT false,
  prayer_partner        BOOLEAN NOT NULL DEFAULT false,
  pledged_to_give       BOOLEAN NOT NULL DEFAULT false,
  form_of_gift          TEXT,
  gift_amount           NUMERIC(10,2),
  date_received         TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- goals (one row per user)
CREATE TABLE goals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_cost          NUMERIC(10,2) NOT NULL DEFAULT 5525,
  food_reimbursement NUMERIC(10,2) NOT NULL DEFAULT 400,
  sf_flight          NUMERIC(10,2) NOT NULL DEFAULT 400,
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own contacts" ON contacts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users see own goals" ON goals
  FOR ALL USING (auth.uid() = user_id);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## Phase 2 — AI writing assistant (priority: future)

Draft emails, call scripts, texts, and support letters based on contact data.

- Claude API via a Supabase Edge Function (keeps API key server-side)
- Inputs: contact name, relationship, stage, notes
- Outputs: email draft, call script bullets, thank-you note
- User always reviews before sending
- Anthropic API key stored in Bitwarden Secrets Manager, injected into Edge Function env

---

## Phase 3 — SaaS / multi-user (priority: future)

If this becomes a product for other missionaries:
- Supabase Auth already handles sign-up/login
- RLS already enforces per-user data isolation
- Stripe for billing
- `organization_id` for team use (mission agency managing multiple raisers)
- Make project name user-configurable (currently hardcoded "Tokyo Mission")

---

## Decisions made
- **Skipped local Docker phase** — went directly to Supabase since no real data existed yet
- **Keeping Vite** — right fit for personal use; only reconsider Next.js if Phase 3 SaaS happens
- **Supabase URL + publishable key are not secrets** — go in `.env` directly, not Secrets Manager
- **Bitwarden Secrets Manager** — reserved for future server-side secrets (e.g. Anthropic API key in Phase 2 Edge Function)
- **AI assistance** deferred until Phase 2
