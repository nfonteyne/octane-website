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

(async function init() {
  await initNav(null);
  try {
    const profile = await api.get('/api/users/me/profile');
    const container = document.getElementById('content');
    container.innerHTML = `
      <div class="profile-header">
        ${avatarHtml(profile, 'avatar-lg')}
        <div>
          <h1>${escapeHtml(profile.name)}${profile.isAdmin ? ' <span class="badge">admin</span>' : ''}</h1>
          ${profile.username ? `<div class="card-subtitle">@${escapeHtml(profile.username)}</div>` : ''}
          ${profile.email ? `<div class="card-subtitle">${escapeHtml(profile.email)}</div>` : ''}
          <div class="card-subtitle">Membre depuis ${formatDate(profile.createdAt)}</div>
        </div>
      </div>

      ${profile.groups && profile.groups.length ? `
      <h2>Groupes Authentik</h2>
      <div class="tag-list">
        ${profile.groups.map((g) => `<span class="tag">${escapeHtml(g)}</span>`).join('')}
      </div>` : ''}

      <h2>Votre activité</h2>
      <div class="stat-grid">
        ${statTile(profile.stats.songsAdded, 'Morceaux ajoutés')}
        ${statTile(profile.stats.suggestionsProposed, 'Suggestions proposées')}
        ${statTile(profile.stats.votesCast, 'Votes exprimés')}
      </div>

      <div class="panel">
        <p class="empty">
          Identité gérée par Authentik — pour changer votre nom, email ou mot de passe,
          ${profile.authentikAccountUrl
            ? `rendez-vous sur <a href="${escapeHtml(profile.authentikAccountUrl)}" target="_blank" rel="noopener">votre compte Authentik</a>.`
            : 'rendez-vous sur votre compte Authentik.'}
        </p>
        <a href="/auth/logout"><button type="button" class="danger">Se déconnecter</button></a>
      </div>
    `;
  } catch (err) {
    showError(err.message);
  }
})();
