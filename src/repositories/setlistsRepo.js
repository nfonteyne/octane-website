const pool = require('../db/pool');

async function findNext() {
  const { rows } = await pool.query(
    `SELECT id, name, venue, concert_date, created_by, created_at, updated_at
     FROM setlists
     WHERE concert_date >= CURRENT_DATE
     ORDER BY concert_date ASC
     LIMIT 1`
  );
  return rows[0] || null;
}

async function findHistory() {
  const { rows } = await pool.query(
    `SELECT id, name, venue, concert_date, created_by, created_at, updated_at
     FROM setlists
     WHERE concert_date < CURRENT_DATE
     ORDER BY concert_date DESC`
  );
  return rows;
}

async function findHistoryWithSongs() {
  const { rows } = await pool.query(
    `SELECT sl.id, sl.name, sl.venue, sl.concert_date, sl.created_by, sl.created_at, sl.updated_at,
            COALESCE(
              (
                SELECT json_agg(
                         json_build_object(
                           'id', ss.id, 'song_id', ss.song_id, 'title', s.title, 'artist', s.artist,
                           'youtube_url', s.youtube_url, 'spotify_url', s.spotify_url,
                           'position', ss.position, 'note', ss.note, 'is_encore', ss.is_encore
                         )
                         ORDER BY ss.is_encore, ss.position
                       )
                FROM setlist_songs ss
                JOIN songs s ON s.id = ss.song_id
                WHERE ss.setlist_id = sl.id
              ), '[]'
            ) AS songs
     FROM setlists sl
     WHERE sl.concert_date < CURRENT_DATE
     ORDER BY sl.concert_date DESC`
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT id, name, venue, concert_date, created_by, created_at, updated_at
     FROM setlists WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findSongs(setlistId) {
  const { rows } = await pool.query(
    `SELECT ss.id, ss.setlist_id, ss.song_id, s.title, s.artist, ss.position, ss.note, ss.is_encore
     FROM setlist_songs ss
     JOIN songs s ON s.id = ss.song_id
     WHERE ss.setlist_id = $1
     ORDER BY ss.is_encore, ss.position`,
    [setlistId]
  );
  return rows;
}

async function create({ name, venue, concertDate, createdBy }) {
  const { rows } = await pool.query(
    `INSERT INTO setlists (name, venue, concert_date, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, venue, concert_date, created_by, created_at, updated_at`,
    [name || null, venue || null, concertDate, createdBy]
  );
  return rows[0];
}

async function update(id, { name, venue, concertDate }) {
  const { rows } = await pool.query(
    `UPDATE setlists SET name = $2, venue = $3, concert_date = $4, updated_at = now()
     WHERE id = $1
     RETURNING id, name, venue, concert_date, created_by, created_at, updated_at`,
    [id, name || null, venue || null, concertDate]
  );
  return rows[0] || null;
}

async function remove(id) {
  await pool.query('DELETE FROM setlists WHERE id = $1', [id]);
}

async function replaceSongs(setlistId, songEntries) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM setlist_songs WHERE setlist_id = $1', [setlistId]);
    for (const entry of songEntries) {
      await client.query(
        `INSERT INTO setlist_songs (setlist_id, song_id, position, note, is_encore)
         VALUES ($1, $2, $3, $4, $5)`,
        [setlistId, entry.songId, entry.position, entry.note || null, !!entry.isEncore]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function addSong(setlistId, { songId, position, note, isEncore }) {
  const { rows } = await pool.query(
    `INSERT INTO setlist_songs (setlist_id, song_id, position, note, is_encore)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, setlist_id, song_id, position, note, is_encore`,
    [setlistId, songId, position, note || null, !!isEncore]
  );
  return rows[0];
}

async function removeSong(setlistId, setlistSongId) {
  await pool.query('DELETE FROM setlist_songs WHERE id = $1 AND setlist_id = $2', [
    setlistSongId,
    setlistId,
  ]);
}

module.exports = {
  findNext,
  findHistory,
  findHistoryWithSongs,
  findById,
  findSongs,
  create,
  update,
  remove,
  replaceSongs,
  addSong,
  removeSong,
};
