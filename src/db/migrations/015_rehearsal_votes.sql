CREATE TABLE rehearsal_votes (
    id           SERIAL PRIMARY KEY,
    rehearsal_id INTEGER NOT NULL REFERENCES rehearsals(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote         TEXT NOT NULL CHECK (vote IN ('accept', 'reject')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (rehearsal_id, user_id)
);
