ALTER TABLE contacts ADD COLUMN IF NOT EXISTS responded boolean NOT NULL DEFAULT false;
