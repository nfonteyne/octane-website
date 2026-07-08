INSERT INTO instruments (name) VALUES
    ('chant'), ('guitare'), ('basse'), ('batterie'), ('clavier'),
    ('percussions'), ('cuivres'), ('autre')
ON CONFLICT (name) DO NOTHING;
