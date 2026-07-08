const pool = require('../db/pool');
const { normalizeISO, slotDateParis, dayOfWeekParis } = require('../lib/calendarDates');

const COLOR_PALETTE = [
  '#4285f4', '#ea4335', '#fbbc05', '#34a853',
  '#a142f4', '#24c1e0', '#ff6d00', '#795548',
];

async function getPeople() {
  const { rows } = await pool.query('SELECT id, name, color FROM calendar_people ORDER BY id');
  return rows;
}

// Always called from within the ingestSlots transaction below (needs the
// same client so the color-index count and the insert see a consistent view).
async function upsertPerson(client, name) {
  const existing = await client.query('SELECT id FROM calendar_people WHERE name = $1', [name]);
  if (existing.rows[0]) return existing.rows[0].id;

  const { rows: countRows } = await client.query('SELECT COUNT(*)::int AS count FROM calendar_people');
  const color = COLOR_PALETTE[countRows[0].count % COLOR_PALETTE.length];

  const { rows } = await client.query(
    `INSERT INTO calendar_people (name, color) VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET name = excluded.name
     RETURNING id`,
    [name, color]
  );
  return rows[0].id;
}

// Returns ingestion counts so callers can surface a diagnostic (e.g. "12
// slots but 0 availability rows" points at a payload-shape mismatch from
// n8n, since a slot with no matching calendar_availability rows is silently
// excluded from getSlots() below — it would otherwise look like "nothing
// happened" with no error anywhere.
async function ingestSlots(slots) {
  const client = await pool.connect();
  let availabilityRows = 0;
  let availableTrueCount = 0;
  let availableFalseCount = 0;
  let slotsWithNoPeople = 0;
  try {
    await client.query('BEGIN');
    for (const slot of slots) {
      const lower = normalizeISO(slot.lower);
      const upper = normalizeISO(slot.upper);
      const slotDate = slotDateParis(slot.lower);
      const dayOfWeek = dayOfWeekParis(slot.lower);

      const { rows: slotRows } = await client.query(
        `INSERT INTO calendar_slots (lower, upper, slot_date, day_of_week)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (lower, upper) DO UPDATE SET
           slot_date = excluded.slot_date,
           day_of_week = excluded.day_of_week
         RETURNING id`,
        [lower, upper, slotDate, dayOfWeek]
      );
      const slotId = slotRows[0].id;

      // people may arrive as a JSON string from n8n's Set-node serialization.
      let people = typeof slot.people === 'string' ? JSON.parse(slot.people) : slot.people || [];
      if (!Array.isArray(people)) people = [];

      if (people.length === 0) {
        slotsWithNoPeople += 1;
        console.warn('[calendar] ingest: slot has no people entries', {
          lower: slot.lower,
          upper: slot.upper,
          rawPeopleType: typeof slot.people,
        });
      }

      for (const person of people) {
        if (!person || !person.name) {
          console.warn('[calendar] ingest: skipped a person entry with no "name" field', person);
          continue;
        }
        const personId = await upsertPerson(client, person.name);
        const isAvailable = !!person.available;
        if (isAvailable) availableTrueCount += 1;
        else availableFalseCount += 1;
        await client.query(
          `INSERT INTO calendar_availability (slot_id, person_id, is_available, checked_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (slot_id, person_id) DO UPDATE SET
             is_available = excluded.is_available,
             checked_at = excluded.checked_at`,
          [slotId, personId, isAvailable]
        );
        availabilityRows += 1;
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const summary = {
    slotsProcessed: slots.length,
    availabilityRows,
    slotsWithNoPeople,
    availableTrueCount,
    availableFalseCount,
  };
  console.log('[calendar] ingest summary:', summary);
  return summary;
}

async function getSlots({ minPeople = 0, personIds = null, weeks = 3 } = {}) {
  const cappedWeeks = Math.min(weeks || 3, 3);
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + cappedWeeks * 7);

  const nowStr = now.toISOString().substring(0, 10);
  const endStr = end.toISOString().substring(0, 10);
  const hasPersonFilter = Array.isArray(personIds) && personIds.length > 0;

  const { rows } = await pool.query(
    `SELECT
       ts.id, ts.lower, ts.upper, to_char(ts.slot_date, 'YYYY-MM-DD') AS slot_date, ts.day_of_week,
       filtered.available_count, filtered.total_in_filter,
       (
         SELECT json_agg(
                  json_build_object('id', p.id, 'name', p.name, 'color', p.color,
                                     'is_available', sa2.is_available)
                  ORDER BY p.id
                )
         FROM calendar_availability sa2
         JOIN calendar_people p ON p.id = sa2.person_id
         WHERE sa2.slot_id = ts.id
       ) AS people
     FROM calendar_slots ts
     JOIN (
       SELECT slot_id,
              COUNT(*) FILTER (WHERE is_available) AS available_count,
              COUNT(*) AS total_in_filter
       FROM calendar_availability
       WHERE ($3::int[] IS NULL OR person_id = ANY($3::int[]))
       GROUP BY slot_id
     ) filtered ON filtered.slot_id = ts.id
     WHERE ts.slot_date >= $1 AND ts.slot_date <= $2
       AND filtered.available_count >= $4
     ORDER BY ts.lower`,
    [nowStr, endStr, hasPersonFilter ? personIds : null, minPeople]
  );

  return rows.map((row) => ({ ...row, people: row.people || [] }));
}

async function getLastChecked() {
  const { rows } = await pool.query('SELECT MAX(checked_at) AS ts FROM calendar_availability');
  return rows[0].ts;
}

module.exports = { getPeople, ingestSlots, getSlots, getLastChecked };
