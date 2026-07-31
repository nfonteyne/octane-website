ALTER TABLE calendar_settings ADD COLUMN IF NOT EXISTS rehearsal_confirm_threshold SMALLINT NOT NULL DEFAULT 4;
