-- Baseline schema — captures the initial state that existed before migration tracking began.
-- The cloud project was built incrementally via the Supabase dashboard; this file
-- reconstructs that starting point so the local stack can apply all subsequent migrations.

CREATE TABLE IF NOT EXISTS public.contacts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name             text NOT NULL DEFAULT '',
  relationship          text NOT NULL DEFAULT '',
  "returning"           boolean NOT NULL DEFAULT false,
  top_priority          integer,
  address_status        text NOT NULL DEFAULT '',
  sent                  boolean NOT NULL DEFAULT false,
  letter_address_name   text NOT NULL DEFAULT '',
  salutation            text NOT NULL DEFAULT '',
  letter_printed        boolean NOT NULL DEFAULT false,
  main_envelope_printed boolean NOT NULL DEFAULT false,
  thank_you_sent        boolean NOT NULL DEFAULT false,
  notes                 text NOT NULL DEFAULT '',
  street_address        text NOT NULL DEFAULT '',
  city                  text NOT NULL DEFAULT '',
  state                 text NOT NULL DEFAULT '',
  zip                   text NOT NULL DEFAULT '',
  concatenated_address  text NOT NULL DEFAULT '',
  phone                 text NOT NULL DEFAULT '',
  call_made             boolean NOT NULL DEFAULT false,
  email                 text NOT NULL DEFAULT '',
  financial_partner     boolean NOT NULL DEFAULT false,
  prayer_partner        boolean NOT NULL DEFAULT false,
  pledged_to_give       boolean NOT NULL DEFAULT false,
  form_of_gift          text NOT NULL DEFAULT '',
  gift_amount           numeric(10,2) NOT NULL DEFAULT 0,
  date_received         text NOT NULL DEFAULT '',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own contacts"
  ON public.contacts FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.goals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_cost          numeric(10,2) NOT NULL DEFAULT 5525,
  food_reimbursement numeric(10,2) NOT NULL DEFAULT 400,
  sf_flight          numeric(10,2) NOT NULL DEFAULT 400,
  updated_at         timestamptz DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own goals"
  ON public.goals FOR ALL
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
