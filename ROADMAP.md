# Support Raising Tracker — Roadmap

## Current State (v0.5 — April 2026)

- Vite + React + TypeScript + Tailwind SPA
- Supabase for database (Postgres), auth, and RLS
- No server-side component — Supabase JS client called directly from React hooks
- Supabase CLI linked for migrations (`supabase db push`, `supabase db query --linked`)

---

## Phase 1 — Complete ✓

### Stack
- **Database:** Supabase cloud Postgres
- **Auth:** Supabase Auth (email/password + Google OAuth)
- **API layer:** `@supabase/supabase-js` called directly from React hooks
- **RLS:** Row-level security — full `USING` + `WITH CHECK` on all tables (`contacts`, `goals`, `additional_raising`)
- **Types:** Full TypeScript — shared `Contact` and `Goals` interfaces in `src/types.ts`

### Env vars (`.env`)
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-key>
```

### Live schema (as applied)
```sql
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
  concatenated_address  TEXT,
  phone                 TEXT,
  call_made             BOOLEAN NOT NULL DEFAULT false,
  email                 TEXT,
  financial_partner     BOOLEAN NOT NULL DEFAULT false,
  prayer_partner        BOOLEAN NOT NULL DEFAULT false,
  pledged_to_give       BOOLEAN NOT NULL DEFAULT false,
  form_of_gift          TEXT,
  gift_amount           NUMERIC(10,2),
  date_received         TEXT,
  responded             BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE goals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_cost          NUMERIC(10,2) NOT NULL DEFAULT 5525,
  food_reimbursement NUMERIC(10,2) NOT NULL DEFAULT 400,
  sf_flight          NUMERIC(10,2) NOT NULL DEFAULT 400,
  updated_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own contacts" ON contacts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users see own goals" ON goals
  FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Running migrations
```bash
# One-off query
supabase db query --linked "ALTER TABLE contacts ADD COLUMN ..."

# Migration file workflow
supabase migration new <name>
supabase db push
```

---

## Phase 1.5 — Vercel deployment + mission settings (near-term)

### Vercel deployment
- Add `vercel.json` with SPA rewrite rule so page refresh works on sub-routes
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Vercel environment variables
- Add Vercel preview and production URLs to Supabase **Authentication → URL Configuration → Redirect URLs**
- Consider separate Supabase projects for dev vs prod (or use the same project with env-var switching)

### Google OAuth on Vercel
- In Google Cloud Console → OAuth client, add the Vercel production URL to **Authorized redirect URIs** (e.g. `https://your-app.vercel.app`)
- Add any Vercel preview URL pattern if you want OAuth to work on preview deploys too
- Supabase already handles the callback route (`/auth/v1/callback`) — no app-side route needed

### Mission settings (make the app generic)
Pull hardcoded "Tokyo Mission" branding and dates out into a per-user settings record.

**New fields on `goals` table (or a separate `mission_settings` table):**
```sql
ALTER TABLE goals
  ADD COLUMN mission_name TEXT NOT NULL DEFAULT 'My Mission',
  ADD COLUMN mission_start DATE,
  ADD COLUMN mission_end DATE;
```

**UI changes:**
- Add mission name, start date, and end date fields to the Goal Settings panel
- Replace hardcoded "Tokyo Mission" text in the header/login page with the user's saved mission name
- Dashboard can show the date range and days remaining if dates are set
- Additional reimbursables stay as-is (already flexible)

**Migration:** rename or update `goals` table to `mission_settings` if a clean separation is preferred, or just add columns to `goals` to keep it simple.

---

## Phase 1.6 — Activity heatmap (near-term)

A GitHub-style heatmap showing outreach activity over time — how consistently you're reaching out, sending letters, following up, and logging donations.

### What it tracks
Each square represents one day. Color intensity reflects how many outreach events happened that day across tracked categories:
- **Letter sent** (`sent` flipped to true)
- **Follow-up made** (`call_made` flipped to true)
- **Gift received** (`financial_partner` or `gift_amount > 0` recorded)
- **Contact added** (`created_at`)
- **Thank-you sent** (`thank_you_sent` flipped to true)

### Data model
This requires an `activity_log` table — a new row each time a meaningful field changes on a contact. The contacts table's `updated_at` only tells you *something* changed, not *what*. Options:

1. **App-level logging (simplest):** Write to `activity_log` explicitly in `useContacts.ts` whenever a relevant field is saved. No DB triggers needed.
2. **Postgres trigger (more robust):** A trigger on `contacts` compares OLD vs NEW for each tracked field and inserts log rows automatically.

Recommended: start with option 1. Migrate to triggers if a second platform (e.g., mobile) is added.

```sql
CREATE TABLE activity_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id  UUID REFERENCES contacts(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL, -- 'sent', 'follow_up', 'gift', 'contact_added', 'thank_you'
  occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own activity" ON activity_log
  FOR ALL USING (auth.uid() = user_id);
```

### UI
- Placed on the Dashboard above or below the goal progress bar
- 52-week rolling window (one year back from today)
- Color ramp: cream (0) → sage-200 → sage-400 → sage-600 (4+)
- Hover tooltip: date + count + breakdown by category
- Optional toggle to filter by event type (letters only, follow-ups only, etc.)
- No external charting lib needed — render as a CSS grid of `<div>` squares

### What it tells you
- Are you going in streaks and then going dark for weeks?
- Which weeks had the most outreach?
- Did you follow up promptly after sending letters?

---

## Phase 2 — AI writing assistant (future)

Draft emails, call scripts, and thank-you notes based on contact data.

- Claude API via a Supabase Edge Function (keeps API key server-side)
- Inputs: contact name, relationship, stage, notes
- Outputs: email draft, call script bullets, thank-you note
- User always reviews before sending
- Anthropic API key stored in Bitwarden Secrets Manager, injected into Edge Function env

---

## Phase 3 — SaaS / multi-user (future)

If this becomes a product for other missionaries:
- Supabase Auth already handles sign-up/login
- RLS already enforces per-user data isolation
- Stripe for billing
- `organization_id` for team use (mission agency managing multiple raisers)
- Make project name user-configurable (currently hardcoded "Tokyo Mission")
- Reconsider Next.js at this point for SSR and API routes

---

## Decisions log
- **Skipped Docker/Express entirely** — went straight to Supabase since no real data existed
- **Keeping Vite** — right fit for personal use; reconsider Next.js only at Phase 3
- **TypeScript** — migrated from JS in April 2026; shared `Contact`/`Goals` types catch schema mismatches at compile time
- **Supabase URL + publishable key are not secrets** — go in `.env` directly and as Vercel env vars; store in Vaultwarden for reference
- **Vaultwarden** — self-hosted password/secrets manager; store all env vars (Supabase URL, anon key, future API keys) there for recovery and sharing across machines
- **Bitwarden Secrets Manager** — reserved for future server-side secrets (Phase 2 Anthropic API key)
- **`returning` is a Postgres reserved word** — must be quoted as `"returning"` in SQL
- **camelCase ↔ snake_case mapping** lives in `useContacts.ts` (`CAMEL_TO_SNAKE` / `fromRow` / `toRow`)
- **Google OAuth + email/password share the same user** — Supabase auto-links accounts with the same email, so switching to Google doesn't orphan existing data
- **RLS policies need `WITH CHECK`** — `USING`-only policies filter reads but not writes; all tables now use `FOR ALL USING (...) WITH CHECK (...)` to enforce ownership on inserts and updates too
