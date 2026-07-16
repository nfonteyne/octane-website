const pool = require('../db/pool');

async function findAll() {
  const { rows } = await pool.query('SELECT id, label, url, created_at FROM discord_webhooks ORDER BY created_at');
  return rows;
}

async function create({ label, url }) {
  const { rows } = await pool.query(
    'INSERT INTO discord_webhooks (label, url) VALUES ($1, $2) RETURNING id, label, url, created_at',
    [label || null, url]
  );
  return rows[0];
}

async function remove(id) {
  await pool.query('DELETE FROM discord_webhooks WHERE id = $1', [id]);
}

module.exports = { findAll, create, remove };
