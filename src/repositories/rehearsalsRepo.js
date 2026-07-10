const pool = require('../db/pool');

async function findUpcoming() {
  const { rows } = await pool.query(`
    SELECT r.id, r.starts_at, r.ends_at, r.location, r.proposed_by, u.name AS proposed_by_name, r.created_at
    FROM rehearsals r
    JOIN users u ON u.id = r.proposed_by
    WHERE r.ends_at >= now()
    ORDER BY r.starts_at
  `);
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query('SELECT id, starts_at, ends_at, location, proposed_by FROM rehearsals WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create({ startsAt, endsAt, location, proposedBy }) {
  const { rows } = await pool.query(
    `INSERT INTO rehearsals (starts_at, ends_at, location, proposed_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, starts_at, ends_at, location, proposed_by, created_at`,
    [startsAt, endsAt, location || null, proposedBy]
  );
  return rows[0];
}

async function remove(id) {
  await pool.query('DELETE FROM rehearsals WHERE id = $1', [id]);
}

module.exports = { findUpcoming, findById, create, remove };
