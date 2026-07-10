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

// Shown for a registered feed instead of its full URL, consistent with the
// admin calendar-management panel — the URL itself is a secret (whoever has
// it can read that person's calendar), so the list view doesn't re-display
// the plaintext on every load.
function maskIcsUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}/••••`;
  } catch {
    return '••••';
  }
}

function myFeedRowTemplate(feed) {
  return `
    <div class="feed-row" data-feed-id="${feed.id}">
      <span class="feed-label">${feed.label ? `${escapeHtml(feed.label)} — ` : ''}${escapeHtml(maskIcsUrl(feed.icsUrl))}</span>
      <button type="button" class="secondary icon-btn remove-my-feed-btn" data-feed-id="${feed.id}">Supprimer</button>
    </div>
  `;
}

async function loadMyFeeds() {
  const feeds = await api.get('/api/calendar/my-feeds');
  const container = document.getElementById('my-feeds-list');
  container.innerHTML = feeds.length
    ? feeds.map(myFeedRowTemplate).join('')
    : '<p class="empty">Aucun calendrier configuré.</p>';
  container.querySelectorAll('.remove-my-feed-btn').forEach((btn) => {
    btn.addEventListener('click', () => onRemoveMyFeed(parseInt(btn.dataset.feedId, 10)));
  });
}

async function onAddMyFeed(e) {
  e.preventDefault();
  const form = e.target;
  const label = form.label.value.trim();
  const icsUrl = form.icsUrl.value.trim();
  try {
    await api.post('/api/calendar/my-feeds', { label, icsUrl });
    form.reset();
    await loadMyFeeds();
  } catch (err) {
    showError(err.message);
  }
}

async function onRemoveMyFeed(feedId) {
  try {
    await api.del(`/api/calendar/my-feeds/${feedId}`);
    await loadMyFeeds();
  } catch (err) {
    showError(err.message);
  }
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

      <h2>Mes calendriers</h2>
      <p class="note">
        Ajoutez le lien ICS (iCal) d'un ou plusieurs de vos calendriers (Google, Outlook, Apple...) pour
        apparaître dans les disponibilités du groupe sur <a href="/calendar.html">la page Disponibilités</a>.
        L'application ne conserve jamais le contenu de vos calendriers — seul un statut disponible/occupé
        par créneau est déduit et enregistré.
      </p>
      <div class="panel">
        <div id="my-feeds-list"><p class="empty">Chargement…</p></div>
        <form id="add-my-feed-form" class="inline-form">
          <input name="label" placeholder="Libellé (optionnel)">
          <input name="icsUrl" type="url" placeholder="URL du calendrier (.ics)" required>
          <button type="submit" class="secondary icon-btn">+ Ajouter</button>
        </form>
        <p class="note"><a href="/calendar-ics-help.html">Comment trouver mon lien ICS ?</a></p>
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
    document.getElementById('add-my-feed-form').addEventListener('submit', onAddMyFeed);
    await loadMyFeeds();
  } catch (err) {
    showError(err.message);
  }
})();
