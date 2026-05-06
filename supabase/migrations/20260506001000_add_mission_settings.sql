ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS mission_name text NOT NULL DEFAULT 'My Mission',
  ADD COLUMN IF NOT EXISTS mission_start date,
  ADD COLUMN IF NOT EXISTS mission_end date;
