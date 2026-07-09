CREATE TABLE calendar_feeds (
    id         SERIAL PRIMARY KEY,
    person_id  INTEGER NOT NULL REFERENCES calendar_people(id) ON DELETE CASCADE,
    label      TEXT,
    ics_url    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_feeds_person_id ON calendar_feeds (person_id);
