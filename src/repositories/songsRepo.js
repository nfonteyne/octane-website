const pool = require('../db/pool');

async function findAll() {
  const { rows } = await pool.query(`
    SELECT s.id, s.title, s.artist, s.notes, s.created_at,
           COUNT(st.id)::int AS tutorial_count
    FROM songs s
    LEFT JOIN song_tutorials st ON st.song_id = s.id
    GROUP BY s.id
    ORDER BY s.title
  `);
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, title, artist, notes, added_by, created_at, updated_at FROM songs WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function create({ title, artist, notes, addedBy }) {
  const { rows } = await pool.query(
    `INSERT INTO songs (title, artist, notes, added_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, artist, notes, added_by, created_at, updated_at`,
    [title, artist, notes || null, addedBy]
  );
  return rows[0];
}

async function update(id, { title, artist, notes }) {
  const { rows } = await pool.query(
    `UPDATE songs SET title = $2, artist = $3, notes = $4, updated_at = now()
     WHERE id = $1
     RETURNING id, title, artist, notes, added_by, created_at, updated_at`,
    [id, title, artist, notes || null]
  );
  return rows[0] || null;
}

async function remove(id) {
  await pool.query('DELETE FROM songs WHERE id = $1', [id]);
}

async function findTutorials(songId) {
  const { rows } = await pool.query(
    `SELECT st.id, st.song_id, st.instrument_id, i.name AS instrument_name,
            st.url, st.label, st.added_by, st.created_at
     FROM song_tutorials st
     JOIN instruments i ON i.id = st.instrument_id
     WHERE st.song_id = $1
     ORDER BY i.name`,
    [songId]
  );
  return rows;
}

async function addTutorial(songId, { instrumentId, url, label, addedBy }) {
  const { rows } = await pool.query(
    `INSERT INTO song_tutorials (song_id, instrument_id, url, label, added_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, song_id, instrument_id, url, label, added_by, created_at`,
    [songId, instrumentId, url, label || null, addedBy]
  );
  return rows[0];
}

async function removeTutorial(songId, tutorialId) {
  await pool.query('DELETE FROM song_tutorials WHERE id = $1 AND song_id = $2', [
    tutorialId,
    songId,
  ]);
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
  findTutorials,
  addTutorial,
  removeTutorial,
};
