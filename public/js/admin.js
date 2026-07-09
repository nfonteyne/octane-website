function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function showError(message) {
  document.getElementById('error').innerHTML = `<div class="error-banner">${escapeHtml(message)}</div>`;
}

function statTile(value, label) {
  return `
    <div class="stat-tile">
      <div class="stat-value">${value}</div>
      <div class="stat-label">${escapeHtml(label)}</div>
    </div>
  `;
}

function adminUserRowTemplate(u) {
  return `
    <div class="admin-user-row">
      <div class="admin-user-identity">
        ${avatarHtml(u, 'avatar-sm')}
        <div>
          <div class="card-title">${escapeHtml(u.name)}${u.isAdmin ? ' <span class="badge">admin</span>' : ''}</div>
          <div class="card-subtitle">Membre depuis ${formatDate(u.createdAt)} · Dernière connexion ${formatDate(u.lastSeenAt)}</div>
        </div>
      </div>
      <div class="admin-user-counts">
        <span title="Morceaux ajoutés">🎵 ${u.songsAdded}</span>
        <span title="Suggestions proposées">💡 ${u.suggestionsProposed}</span>
        <span title="Votes exprimés">✔ ${u.votesCast}</span>
      </div>
    </div>
  `;
}

(async function init() {
  const me = await initNav('admin');
  if (!me.isAdmin) {
    window.location.href = '/index.html';
    return;
  }

  try {
    const stats = await api.get('/api/admin/stats');
    const container = document.getElementById('content');
    container.innerHTML = `
      <h1>Administration</h1>
      <p class="page-subtitle">Vue d'ensemble de l'activité et des données de l'application.</p>

      <h2>Vue d'ensemble</h2>
      <div class="stat-grid">
        ${statTile(stats.userCount, 'Utilisateurs')}
        ${statTile(stats.songs.totalSongs, 'Morceaux au répertoire')}
        ${statTile(stats.songs.distinctArtists, 'Artistes différents')}
        ${statTile(stats.songs.tutorialsAdded, 'Tutoriels ajoutés')}
        ${statTile(stats.suggestions.pending, 'Suggestions en attente')}
        ${statTile(stats.suggestions.approved, 'Suggestions approuvées')}
        ${statTile(stats.suggestions.totalVotes, 'Votes exprimés')}
        ${statTile(stats.concerts.pastConcerts, 'Concerts passés')}
        ${statTile(stats.concerts.upcomingConcerts, 'Concerts à venir')}
        ${statTile(stats.concerts.avgSongsPerConcert, 'Morceaux / concert (moy.)')}
      </div>

      <h2>Activité des utilisateurs</h2>
      <p class="note">La date de dernière connexion est approximative (dernière synchronisation du profil, pas un journal de connexion précis).</p>
      <div class="panel admin-user-list">
        ${stats.users.map(adminUserRowTemplate).join('')}
      </div>
    `;
  } catch (err) {
    showError(err.message);
  }
})();
