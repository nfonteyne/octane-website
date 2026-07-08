const pool = require('../db/pool');

async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, authentik_sub, name, email, is_admin, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}

async function upsertFromClaims({ sub, name, email, isAdmin }) {
  const { rows } = await pool.query(
    `INSERT INTO users (authentik_sub, name, email, is_admin)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (authentik_sub)
     DO UPDATE SET name = $2, email = $3, is_admin = $4, updated_at = now()
     RETURNING id, authentik_sub, name, email, is_admin, created_at`,
    [sub, name, email, isAdmin]
  );
  return rows[0];
}

module.exports = { findById, upsertFromClaims };
