CREATE TABLE rehearsals (
    id          SERIAL PRIMARY KEY,
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ NOT NULL,
    location    TEXT,
    proposed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rehearsals_starts_at ON rehearsals (starts_at);
