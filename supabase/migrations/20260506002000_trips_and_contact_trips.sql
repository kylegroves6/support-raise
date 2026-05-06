-- Create trips table — one row per mission per user
CREATE TABLE IF NOT EXISTS public.trips (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_name  text NOT NULL DEFAULT 'My Mission',
  mission_start date,
  mission_end   date,
  trip_cost     numeric(10,2) NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

-- Only one active trip per user
CREATE UNIQUE INDEX trips_one_active_per_user
  ON public.trips (user_id)
  WHERE is_active = true;

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own trips"
  ON public.trips FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create contact_trips — per-trip state for each contact
CREATE TABLE IF NOT EXISTS public.contact_trips (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id               uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  contact_id            uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent                  boolean NOT NULL DEFAULT false,
  letter_printed        boolean NOT NULL DEFAULT false,
  main_envelope_printed boolean NOT NULL DEFAULT false,
  thank_you_sent        boolean NOT NULL DEFAULT false,
  call_made             boolean NOT NULL DEFAULT false,
  responded             boolean NOT NULL DEFAULT false,
  financial_partner     boolean NOT NULL DEFAULT false,
  prayer_partner        boolean NOT NULL DEFAULT false,
  pledged_to_give       boolean NOT NULL DEFAULT false,
  form_of_gift          text,
  gift_amount           numeric(10,2),
  date_received         text,
  UNIQUE (trip_id, contact_id)
);

ALTER TABLE public.contact_trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own contact_trips"
  ON public.contact_trips FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Migrate existing data: create one trip per user from goals table,
-- mark it active, and move all per-trip contact fields into contact_trips.
INSERT INTO public.trips (user_id, mission_name, mission_start, mission_end, trip_cost, is_active)
SELECT
  user_id,
  COALESCE(NULLIF(mission_name, ''), 'My Mission'),
  mission_start,
  mission_end,
  trip_cost,
  true
FROM public.goals
ON CONFLICT DO NOTHING;

-- For each existing contact, create a contact_trips row under that user's active trip
INSERT INTO public.contact_trips (
  trip_id, contact_id, user_id,
  sent, letter_printed, main_envelope_printed, thank_you_sent,
  call_made, responded, financial_partner, prayer_partner,
  pledged_to_give, form_of_gift, gift_amount, date_received
)
SELECT
  t.id,
  c.id,
  c.user_id,
  c.sent, c.letter_printed, c.main_envelope_printed, c.thank_you_sent,
  c.call_made, c.responded, c.financial_partner, c.prayer_partner,
  c.pledged_to_give, c.form_of_gift, c.gift_amount, c.date_received
FROM public.contacts c
JOIN public.trips t ON t.user_id = c.user_id AND t.is_active = true
ON CONFLICT (trip_id, contact_id) DO NOTHING;

-- Strip per-trip columns from contacts (now live in contact_trips)
ALTER TABLE public.contacts
  DROP COLUMN IF EXISTS sent,
  DROP COLUMN IF EXISTS letter_printed,
  DROP COLUMN IF EXISTS main_envelope_printed,
  DROP COLUMN IF EXISTS thank_you_sent,
  DROP COLUMN IF EXISTS call_made,
  DROP COLUMN IF EXISTS responded,
  DROP COLUMN IF EXISTS financial_partner,
  DROP COLUMN IF EXISTS prayer_partner,
  DROP COLUMN IF EXISTS pledged_to_give,
  DROP COLUMN IF EXISTS form_of_gift,
  DROP COLUMN IF EXISTS gift_amount,
  DROP COLUMN IF EXISTS date_received;

-- Strip mission fields from goals (now live in trips)
ALTER TABLE public.goals
  DROP COLUMN IF EXISTS mission_name,
  DROP COLUMN IF EXISTS mission_start,
  DROP COLUMN IF EXISTS mission_end,
  DROP COLUMN IF EXISTS trip_cost;
