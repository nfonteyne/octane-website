DROP TABLE calendar_availability;
DROP TABLE calendar_feeds;
DROP TABLE calendar_people;

CREATE TABLE calendar_feeds (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label      TEXT,
    ics_url    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, ics_url)
);
CREATE INDEX idx_calendar_feeds_user_id ON calendar_feeds (user_id);

CREATE TABLE calendar_availability (
    id           SERIAL PRIMARY KEY,
    slot_id      INTEGER NOT NULL REFERENCES calendar_slots(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_available BOOLEAN NOT NULL DEFAULT true,
    checked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (slot_id, user_id)
);
CREATE INDEX idx_calendar_availability_slot_id ON calendar_availability (slot_id);

-- Centralizes "which users appear on the calendar" (anyone with >=1 feed) and
-- their color, so getPeople()/getSlots() stay in sync without duplicating the
-- palette-assignment logic in two places.
CREATE VIEW calendar_active_people AS
SELECT u.id, u.name,
       (ARRAY['#4285f4','#ea4335','#fbbc05','#34a853','#a142f4','#24c1e0','#ff6d00','#795548'])
         [((ROW_NUMBER() OVER (ORDER BY u.id) - 1) % 8) + 1] AS color
FROM users u
WHERE EXISTS (SELECT 1 FROM calendar_feeds f WHERE f.user_id = u.id);
