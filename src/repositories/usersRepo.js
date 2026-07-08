const pool = require('../db/pool');

const PROFILE_FIELDS = 'id, authentik_sub, name, username, email, avatar_url, groups, is_admin, created_at';

async function findById(id) {
  const { rows } = await pool.query(`SELECT ${PROFILE_FIELDS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function upsertFromClaims({ sub, name, username, email, avatarUrl, groups, isAdmin }) {
  const { rows } = await pool.query(
    `INSERT INTO users (authentik_sub, name, username, email, avatar_url, groups, is_admin)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (authentik_sub)
     DO UPDATE SET name = $2, username = $3, email = $4, avatar_url = $5, groups = $6, is_admin = $7, updated_at = now()
     RETURNING ${PROFILE_FIELDS}`,
    [sub, name, username || null, email, avatarUrl || null, groups || [], isAdmin]
  );
  return rows[0];
}

async function getActivityStats(userId) {
  const [songs, suggestions, votes] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM songs WHERE added_by = $1', [userId]),
    pool.query('SELECT COUNT(*)::int AS count FROM suggestions WHERE suggested_by = $1', [userId]),
    pool.query('SELECT COUNT(*)::int AS count FROM suggestion_votes WHERE user_id = $1', [userId]),
  ]);
  return {
    songsAdded: songs.rows[0].count,
    suggestionsProposed: suggestions.rows[0].count,
    votesCast: votes.rows[0].count,
  };
}

module.exports = { findById, upsertFromClaims, getActivityStats };
