CREATE TABLE calendar_people (
    id    SERIAL PRIMARY KEY,
    name  TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#4285f4'
);

CREATE TABLE calendar_slots (
    id          SERIAL PRIMARY KEY,
    lower       TIMESTAMPTZ NOT NULL,
    upper       TIMESTAMPTZ NOT NULL,
    slot_date   DATE NOT NULL,
    day_of_week SMALLINT NOT NULL,
    UNIQUE (lower, upper)
);

CREATE TABLE calendar_availability (
    id           SERIAL PRIMARY KEY,
    slot_id      INTEGER NOT NULL REFERENCES calendar_slots(id) ON DELETE CASCADE,
    person_id    INTEGER NOT NULL REFERENCES calendar_people(id) ON DELETE CASCADE,
    is_available BOOLEAN NOT NULL DEFAULT true,
    checked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (slot_id, person_id)
);

CREATE INDEX idx_calendar_slots_slot_date ON calendar_slots (slot_date);
CREATE INDEX idx_calendar_availability_slot_id ON calendar_availability (slot_id);
