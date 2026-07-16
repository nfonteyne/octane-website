CREATE TABLE discord_webhooks (
    id         SERIAL PRIMARY KEY,
    label      TEXT,
    url        TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
