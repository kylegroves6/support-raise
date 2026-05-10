-- Clear junk "-" value
UPDATE contact_trips SET date_received = '' WHERE date_received = '-';

-- Convert M/D/YY to YYYY-MM-DD (e.g. 3/12/26 → 2026-03-12)
UPDATE contact_trips
SET date_received = to_char(
  to_date(date_received, 'FMMM/FMDD/YY'),
  'YYYY-MM-DD'
)
WHERE date_received ~ '^\d{1,2}/\d{1,2}/\d{2}$';
