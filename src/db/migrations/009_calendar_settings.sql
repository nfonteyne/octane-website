CREATE TABLE calendar_settings (
    id            SMALLINT PRIMARY KEY DEFAULT 1,
    weekday_start TIME NOT NULL DEFAULT '18:30',
    weekday_end   TIME NOT NULL DEFAULT '21:00',
    weekend_start TIME NOT NULL DEFAULT '15:00',
    weekend_end   TIME NOT NULL DEFAULT '19:00',
    CONSTRAINT calendar_settings_single_row CHECK (id = 1)
);

INSERT INTO calendar_settings (id) VALUES (1);
