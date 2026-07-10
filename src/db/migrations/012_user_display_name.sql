ALTER TABLE users ADD COLUMN authentik_name TEXT;
UPDATE users SET authentik_name = name;
ALTER TABLE users ALTER COLUMN authentik_name SET NOT NULL;

ALTER TABLE users ADD COLUMN display_name TEXT;
