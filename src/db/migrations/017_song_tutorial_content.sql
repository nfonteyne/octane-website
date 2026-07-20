ALTER TABLE song_tutorials
    ALTER COLUMN url DROP NOT NULL,
    ADD COLUMN content TEXT;
