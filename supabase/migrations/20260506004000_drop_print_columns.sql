ALTER TABLE public.contact_trips
  DROP COLUMN IF EXISTS letter_printed,
  DROP COLUMN IF EXISTS main_envelope_printed;
