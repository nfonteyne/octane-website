INSERT INTO calendar_people (name, color) VALUES
    ('Nathan', '#4285f4'),
    ('Raphaël', '#fbbc05'),
    ('Yann', '#34a853'),
    ('Jules', '#a142f4'),
    ('AK', '#24c1e0')
ON CONFLICT (name) DO NOTHING;
