-- Fix RLS policies on contacts and goals to enforce ownership on writes (WITH CHECK),
-- not just reads (USING). The prior policies only filtered SELECT queries.

-- contacts
DROP POLICY IF EXISTS "users see own contacts" ON public.contacts;
CREATE POLICY "users manage own contacts"
  ON public.contacts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- goals
DROP POLICY IF EXISTS "users see own goals" ON public.goals;
CREATE POLICY "users manage own goals"
  ON public.goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
