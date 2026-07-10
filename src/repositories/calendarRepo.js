const pool = require('../db/pool');
const { normalizeISO, slotDateParis, dayOfWeekParis } = require('../lib/calendarDates');

// "People" on the calendar are just app users who have registered at least
// one feed — calendar_active_people (a view, see migration 011) centralizes
// that membership + a stable color per user, so this and getSlots() below
// can't disagree with each other.
async function getPeople() {
  const { rows } = await pool.query('SELECT id, name, color FROM calendar_active_people ORDER BY id');
  return rows;
}

// Returns ingestion counts so callers can surface a diagnostic (e.g. "12
// slots but 0 availability rows" points at a payload-shape mismatch — a slot
// with no matching calendar_availability rows is silently excluded from
// getSlots() below, so it would otherwise look like "nothing happened" with
// no error anywhere.
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

      const people = Array.isArray(slot.people) ? slot.people : [];
      if (people.length === 0) {
        slotsWithNoPeople += 1;
        console.warn('[calendar] ingest: slot has no people entries', { lower: slot.lower, upper: slot.upper });
      }

      for (const person of people) {
        if (!person || !person.userId) {
          console.warn('[calendar] ingest: skipped a person entry with no "userId" field', person);
          continue;
        }
        const isAvailable = !!person.available;
        if (isAvailable) availableTrueCount += 1;
        else availableFalseCount += 1;
        await client.query(
          `INSERT INTO calendar_availability (slot_id, user_id, is_available, checked_at)
           VALUES ($1, $2, $3, now())
           ON CONFLICT (slot_id, user_id) DO UPDATE SET
             is_available = excluded.is_available,
             checked_at = excluded.checked_at`,
          [slotId, person.userId, isAvailable]
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
         JOIN calendar_active_people p ON p.id = sa2.user_id
         WHERE sa2.slot_id = ts.id
       ) AS people
     FROM calendar_slots ts
     JOIN (
       SELECT slot_id,
              COUNT(*) FILTER (WHERE is_available) AS available_count,
              COUNT(*) AS total_in_filter
       FROM calendar_availability
       WHERE ($3::int[] IS NULL OR user_id = ANY($3::int[]))
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

// Every registered feed across every user, for the sync job — never returned
// to non-admin API consumers (see getPeople() above, which omits ics_url
// entirely).
async function findAllFeeds() {
  const { rows } = await pool.query(`
    SELECT f.id, f.user_id, u.name AS user_name, f.label, f.ics_url
    FROM calendar_feeds f
    JOIN users u ON u.id = f.user_id
    ORDER BY f.user_id, f.id
  `);
  return rows;
}

async function findFeedsForUser(userId) {
  const { rows } = await pool.query(
    'SELECT id, user_id, label, ics_url FROM calendar_feeds WHERE user_id = $1 ORDER BY id',
    [userId]
  );
  return rows;
}

async function addFeed(userId, { label, icsUrl }) {
  const { rows } = await pool.query(
    `INSERT INTO calendar_feeds (user_id, label, ics_url)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, label, ics_url`,
    [userId, label || null, icsUrl]
  );
  return rows[0];
}

async function removeFeed(feedId) {
  await pool.query('DELETE FROM calendar_feeds WHERE id = $1', [feedId]);
}

// Scoped delete for the self-service "my calendars" endpoints — a user must
// only ever be able to delete their own feeds, never guess another user's
// feed id. Returns whether a row actually matched (both wrong id and
// someone-else's feed look identical from the caller's side: nothing deleted).
async function removeFeedForUser(feedId, userId) {
  const { rowCount } = await pool.query('DELETE FROM calendar_feeds WHERE id = $1 AND user_id = $2', [
    feedId,
    userId,
  ]);
  return rowCount > 0;
}

// Every app user (not just ones already on the calendar) with their
// registered feeds attached — lets an admin give someone their first feed,
// not just manage existing entries. The public getPeople() above deliberately
// never exposes ics_url — it's a secret, effectively granting calendar read
// access to whoever has it.
async function getUsersWithFeeds() {
  const { rows: users } = await pool.query(
    'SELECT id, name, avatar_url, is_admin FROM users ORDER BY name'
  );
  const feeds = await findAllFeeds();
  const feedsByUser = new Map();
  for (const feed of feeds) {
    if (!feedsByUser.has(feed.user_id)) feedsByUser.set(feed.user_id, []);
    feedsByUser.get(feed.user_id).push({ id: feed.id, label: feed.label, icsUrl: feed.ics_url });
  }
  return users.map((u) => ({ ...u, feeds: feedsByUser.get(u.id) || [] }));
}

// TIME columns come back from pg as 'HH:MM:SS' strings — split into numbers
// so callers (calendarAvailability.generateSlots) get plain {hour, minute}.
function parseTime(hhmmss) {
  const [hour, minute] = hhmmss.split(':').map(Number);
  return { hour, minute };
}

async function getSlotSettings() {
  const { rows } = await pool.query(
    'SELECT weekday_start, weekday_end, weekend_start, weekend_end, margin_minutes, concert_start, concert_end FROM calendar_settings WHERE id = 1'
  );
  const row = rows[0];
  const weekdayStart = parseTime(row.weekday_start);
  const weekdayEnd = parseTime(row.weekday_end);
  const weekendStart = parseTime(row.weekend_start);
  const weekendEnd = parseTime(row.weekend_end);
  const concertStart = parseTime(row.concert_start);
  const concertEnd = parseTime(row.concert_end);
  return {
    weekday: { startHour: weekdayStart.hour, startMinute: weekdayStart.minute, endHour: weekdayEnd.hour, endMinute: weekdayEnd.minute },
    weekend: { startHour: weekendStart.hour, startMinute: weekendStart.minute, endHour: weekendEnd.hour, endMinute: weekendEnd.minute },
    marginMinutes: row.margin_minutes,
    concert: { startHour: concertStart.hour, startMinute: concertStart.minute, endHour: concertEnd.hour, endMinute: concertEnd.minute },
  };
}

async function updateSlotSettings({ weekdayStart, weekdayEnd, weekendStart, weekendEnd, marginMinutes, concertStart, concertEnd }) {
  const { rows } = await pool.query(
    `UPDATE calendar_settings
     SET weekday_start = $1, weekday_end = $2, weekend_start = $3, weekend_end = $4, margin_minutes = $5,
         concert_start = $6, concert_end = $7
     WHERE id = 1
     RETURNING weekday_start, weekday_end, weekend_start, weekend_end, margin_minutes, concert_start, concert_end`,
    [weekdayStart, weekdayEnd, weekendStart, weekendEnd, marginMinutes, concertStart, concertEnd]
  );
  return rows[0];
}

module.exports = {
  getPeople,
  ingestSlots,
  getSlots,
  getLastChecked,
  findAllFeeds,
  findFeedsForUser,
  addFeed,
  removeFeed,
  removeFeedForUser,
  getUsersWithFeeds,
  getSlotSettings,
  updateSlotSettings,
};
