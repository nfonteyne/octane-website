const pool = require('../db/pool');

async function findUpcoming() {
  const { rows } = await pool.query(`
    SELECT r.id, r.starts_at, r.ends_at, r.location, r.proposed_by, u.name AS proposed_by_name, r.created_at,
           COALESCE(
             json_agg(
               json_build_object('userId', v.user_id, 'name', vu.name, 'avatarUrl', vu.avatar_url, 'vote', v.vote)
             ) FILTER (WHERE v.id IS NOT NULL),
             '[]'
           ) AS votes
    FROM rehearsals r
    JOIN users u ON u.id = r.proposed_by
    LEFT JOIN rehearsal_votes v ON v.rehearsal_id = r.id
    LEFT JOIN users vu ON vu.id = v.user_id
    WHERE r.ends_at >= now()
    GROUP BY r.id, u.name
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

async function upsertVote(rehearsalId, userId, vote) {
  const { rows } = await pool.query(
    `INSERT INTO rehearsal_votes (rehearsal_id, user_id, vote)
     VALUES ($1, $2, $3)
     ON CONFLICT (rehearsal_id, user_id)
     DO UPDATE SET vote = $3, updated_at = now()
     RETURNING id, rehearsal_id, user_id, vote, created_at, updated_at`,
    [rehearsalId, userId, vote]
  );
  return rows[0];
}

async function removeVote(rehearsalId, userId) {
  await pool.query('DELETE FROM rehearsal_votes WHERE rehearsal_id = $1 AND user_id = $2', [
    rehearsalId,
    userId,
  ]);
}

module.exports = { findUpcoming, findById, create, remove, upsertVote, removeVote };
