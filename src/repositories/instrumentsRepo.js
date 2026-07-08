const pool = require('../db/pool');

async function findAll() {
  const { rows } = await pool.query('SELECT id, name FROM instruments ORDER BY name');
  return rows;
}

module.exports = { findAll };
