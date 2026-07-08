-- Users, keyed by Authentik OIDC "sub" claim
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    authentik_sub TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    email         TEXT,
    is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Instruments (fixed-ish list)
CREATE TABLE instruments (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Repertoire
CREATE TABLE songs (
    id         SERIAL PRIMARY KEY,
    title      TEXT NOT NULL,
    artist     TEXT NOT NULL,
    notes      TEXT,
    added_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-song, per-instrument tutorial/resource links
CREATE TABLE song_tutorials (
    id            SERIAL PRIMARY KEY,
    song_id       INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    instrument_id INTEGER NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
    url           TEXT NOT NULL,
    label         TEXT,
    added_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_song_tutorials_song_id ON song_tutorials(song_id);

-- Song suggestions
CREATE TABLE suggestions (
    id               SERIAL PRIMARY KEY,
    title            TEXT NOT NULL,
    artist           TEXT,
    youtube_url      TEXT NOT NULL,
    suggested_by     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected')),
    promoted_song_id INTEGER REFERENCES songs(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Votes/comments on suggestions, one per user per suggestion
CREATE TABLE suggestion_votes (
    id            SERIAL PRIMARY KEY,
    suggestion_id INTEGER NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vote          TEXT NOT NULL CHECK (vote IN ('approve', 'reject')),
    comment       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (suggestion_id, user_id)
);

-- Concerts / setlists
CREATE TABLE setlists (
    id           SERIAL PRIMARY KEY,
    name         TEXT,
    venue        TEXT,
    concert_date DATE NOT NULL,
    created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Songs within a setlist, ordered, with per-song note and encore flag
CREATE TABLE setlist_songs (
    id         SERIAL PRIMARY KEY,
    setlist_id INTEGER NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
    song_id    INTEGER NOT NULL REFERENCES songs(id) ON DELETE RESTRICT,
    position   INTEGER NOT NULL,
    note       TEXT,
    is_encore  BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (setlist_id, song_id)
);
CREATE INDEX idx_setlist_songs_setlist_id ON setlist_songs(setlist_id);
CREATE UNIQUE INDEX uq_setlist_position_main
    ON setlist_songs(setlist_id, position) WHERE NOT is_encore;
CREATE UNIQUE INDEX uq_setlist_position_encore
    ON setlist_songs(setlist_id, position) WHERE is_encore;
