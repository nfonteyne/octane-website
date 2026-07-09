const pool = require('../db/pool');

async function findAll(userId) {
  const { rows } = await pool.query(
    `SELECT sg.id, sg.title, sg.artist, sg.youtube_url, sg.spotify_url, sg.description, sg.status, sg.promoted_song_id,
            sg.created_at, sg.suggested_by, u.name AS suggested_by_name,
            COUNT(*) FILTER (WHERE v.vote = 'approve')::int AS approve_count,
            COUNT(*) FILTER (WHERE v.vote = 'reject')::int AS reject_count,
            mv.vote AS my_vote, mv.comment AS my_vote_comment
     FROM suggestions sg
     JOIN users u ON u.id = sg.suggested_by
     LEFT JOIN suggestion_votes v ON v.suggestion_id = sg.id
     LEFT JOIN suggestion_votes mv ON mv.suggestion_id = sg.id AND mv.user_id = $1
     GROUP BY sg.id, u.name, mv.vote, mv.comment
     ORDER BY sg.created_at DESC`,
    [userId]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await pool.query(
    `SELECT sg.id, sg.title, sg.artist, sg.youtube_url, sg.spotify_url, sg.description, sg.status, sg.promoted_song_id,
            sg.created_at, sg.suggested_by, u.name AS suggested_by_name
     FROM suggestions sg
     JOIN users u ON u.id = sg.suggested_by
     WHERE sg.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findVotes(suggestionId) {
  const { rows } = await pool.query(
    `SELECT v.id, v.user_id, u.name AS voter_name, v.vote, v.comment, v.created_at, v.updated_at
     FROM suggestion_votes v
     JOIN users u ON u.id = v.user_id
     WHERE v.suggestion_id = $1
     ORDER BY v.created_at`,
    [suggestionId]
  );
  return rows;
}

async function create({ title, artist, youtubeUrl, spotifyUrl, description, suggestedBy }) {
  const { rows } = await pool.query(
    `INSERT INTO suggestions (title, artist, youtube_url, spotify_url, description, suggested_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, artist, youtube_url, spotify_url, description, status, promoted_song_id, created_at, suggested_by`,
    [title, artist || null, youtubeUrl, spotifyUrl || null, description || null, suggestedBy]
  );
  return rows[0];
}

async function updateStatus(id, status) {
  const { rows } = await pool.query(
    `UPDATE suggestions SET status = $2, updated_at = now() WHERE id = $1
     RETURNING id, title, artist, youtube_url, spotify_url, description, status, promoted_song_id, created_at, suggested_by`,
    [id, status]
  );
  return rows[0] || null;
}

async function remove(id) {
  await pool.query('DELETE FROM suggestions WHERE id = $1', [id]);
}

async function upsertVote(suggestionId, userId, { vote, comment }) {
  const { rows } = await pool.query(
    `INSERT INTO suggestion_votes (suggestion_id, user_id, vote, comment)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (suggestion_id, user_id)
     DO UPDATE SET vote = $3, comment = $4, updated_at = now()
     RETURNING id, suggestion_id, user_id, vote, comment, created_at, updated_at`,
    [suggestionId, userId, vote, comment || null]
  );
  return rows[0];
}

async function removeVote(suggestionId, userId) {
  await pool.query('DELETE FROM suggestion_votes WHERE suggestion_id = $1 AND user_id = $2', [
    suggestionId,
    userId,
  ]);
}

async function getStats() {
  const { rows } = await pool.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
           COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
           COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
           (SELECT COUNT(*)::int FROM suggestion_votes) AS total_votes
    FROM suggestions
  `);
  return rows[0];
}

async function promoteToSong(suggestionId, addedBy) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: sugRows } = await client.query('SELECT * FROM suggestions WHERE id = $1 FOR UPDATE', [
      suggestionId,
    ]);
    const suggestion = sugRows[0];
    if (!suggestion) {
      await client.query('ROLLBACK');
      return null;
    }
    const { rows: songRows } = await client.query(
      `INSERT INTO songs (title, artist, notes, youtube_url, spotify_url, added_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, artist, notes, youtube_url, spotify_url, added_by, created_at, updated_at`,
      [
        suggestion.title,
        suggestion.artist || suggestion.title,
        suggestion.description,
        suggestion.youtube_url,
        suggestion.spotify_url,
        addedBy,
      ]
    );
    const song = songRows[0];
    await client.query(
      `UPDATE suggestions SET status = 'approved', promoted_song_id = $2, updated_at = now() WHERE id = $1`,
      [suggestionId, song.id]
    );
    await client.query('COMMIT');
    return song;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  findAll,
  findById,
  findVotes,
  create,
  updateStatus,
  remove,
  upsertVote,
  removeVote,
  promoteToSong,
  getStats,
};
