-- Fix RLS policies: wrap auth.uid() in (SELECT ...) so it is evaluated once per
-- query rather than once per row. No behavior change, materially better at scale.

-- contacts
DROP POLICY IF EXISTS "users manage own contacts" ON public.contacts;
CREATE POLICY "users manage own contacts"
  ON public.contacts FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- goals
DROP POLICY IF EXISTS "users manage own goals" ON public.goals;
CREATE POLICY "users manage own goals"
  ON public.goals FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- trips
DROP POLICY IF EXISTS "users manage own trips" ON public.trips;
CREATE POLICY "users manage own trips"
  ON public.trips FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- additional_raising
DROP POLICY IF EXISTS "Users manage own additional raising" ON public.additional_raising;
CREATE POLICY "Users manage own additional raising"
  ON public.additional_raising FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- contact_trips
DROP POLICY IF EXISTS "users manage own contact_trips" ON public.contact_trips;
CREATE POLICY "users manage own contact_trips"
  ON public.contact_trips FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Fix mutable search_path on set_updated_at trigger function.
-- SET search_path = '' forces fully-qualified names and prevents schema injection.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
