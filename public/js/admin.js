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

// Shown for a registered feed instead of its full URL — an admin can already
// see the real value via the "add calendar" flow when they set it, but the
// list view doesn't need to keep re-displaying the plaintext on every load.
function maskIcsUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}/••••`;
  } catch {
    return '••••';
  }
}

function feedRowTemplate(feed) {
  return `
    <div class="feed-row" data-feed-id="${feed.id}">
      <span class="feed-label">${feed.label ? `${escapeHtml(feed.label)} — ` : ''}${escapeHtml(maskIcsUrl(feed.icsUrl))}</span>
      <button type="button" class="secondary icon-btn remove-feed-btn" data-feed-id="${feed.id}">Supprimer</button>
    </div>
  `;
}

// Discord webhook URLs carry a secret token — mask it in the list view like
// maskIcsUrl already does for ICS feed URLs.
function maskDiscordUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const webhookId = parts[parts.length - 2];
    return `${u.hostname}/…/${webhookId}/••••`;
  } catch {
    return '••••';
  }
}

function discordWebhookRowTemplate(hook) {
  return `
    <div class="feed-row" data-webhook-id="${hook.id}">
      <span class="feed-label">${hook.label ? `${escapeHtml(hook.label)} — ` : ''}${escapeHtml(maskDiscordUrl(hook.url))}</span>
      <button type="button" class="secondary icon-btn remove-discord-webhook-btn" data-webhook-id="${hook.id}">Supprimer</button>
    </div>
  `;
}

async function loadDiscordWebhooks() {
  const webhooks = await api.get('/api/admin/discord-webhooks');
  const container = document.getElementById('discord-webhooks-list');
  container.innerHTML = webhooks.length
    ? webhooks.map(discordWebhookRowTemplate).join('')
    : '<p class="empty">Aucun webhook configuré.</p>';
  container.querySelectorAll('.remove-discord-webhook-btn').forEach((btn) => {
    btn.addEventListener('click', () => onRemoveDiscordWebhook(parseInt(btn.dataset.webhookId, 10)));
  });
}

async function onAddDiscordWebhook(e) {
  e.preventDefault();
  const form = e.target;
  const label = form.label.value.trim();
  const url = form.url.value.trim();
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Vérification…';
  try {
    await api.post('/api/admin/discord-webhooks', { label, url });
    form.reset();
    await loadDiscordWebhooks();
  } catch (err) {
    showError(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '+ Ajouter';
  }
}

async function onRemoveDiscordWebhook(id) {
  try {
    await api.del(`/api/admin/discord-webhooks/${id}`);
    await loadDiscordWebhooks();
  } catch (err) {
    showError(err.message);
  }
}

function calendarUserRowTemplate(user) {
  return `
    <div class="admin-user-row calendar-person-row" data-user-id="${user.id}">
      <div class="admin-user-identity">
        ${avatarHtml(user, 'avatar-sm')}
        <div class="card-title">${escapeHtml(user.name)}${user.isAdmin ? ' <span class="badge">admin</span>' : ''}</div>
      </div>
      <div class="calendar-feeds">
        ${user.feeds.length ? user.feeds.map(feedRowTemplate).join('') : '<p class="empty">Aucun calendrier configuré.</p>'}
        <form class="inline-form add-feed-form" data-user-id="${user.id}">
          <input name="label" placeholder="Libellé (optionnel)">
          <input name="icsUrl" type="url" placeholder="URL du calendrier (.ics)" required>
          <button type="submit" class="secondary icon-btn">+ Ajouter</button>
        </form>
      </div>
    </div>
  `;
}

async function loadCalendarUsers() {
  const users = await api.get('/api/calendar/people/admin');
  const container = document.getElementById('calendar-people-list');
  container.innerHTML = users.length
    ? users.map(calendarUserRowTemplate).join('')
    : '<p class="empty">Aucun utilisateur pour le moment.</p>';

  container.querySelectorAll('.add-feed-form').forEach((form) => {
    form.addEventListener('submit', (e) => onAddFeed(e, parseInt(form.dataset.userId, 10)));
  });
  container.querySelectorAll('.remove-feed-btn').forEach((btn) => {
    btn.addEventListener('click', () => onRemoveFeed(parseInt(btn.dataset.feedId, 10)));
  });
}

async function onAddFeed(e, userId) {
  e.preventDefault();
  const form = e.target;
  const label = form.label.value.trim();
  const icsUrl = form.icsUrl.value.trim();
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Vérification…';
  try {
    await api.post(`/api/calendar/people/${userId}/feeds`, { label, icsUrl });
    await loadCalendarUsers();
  } catch (err) {
    showError(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = '+ Ajouter';
  }
}

async function onRemoveFeed(feedId) {
  try {
    await api.del(`/api/calendar/feeds/${feedId}`);
    await loadCalendarUsers();
  } catch (err) {
    showError(err.message);
  }
}

async function loadSlotSettingsForm() {
  const settings = await api.get('/api/calendar/settings');
  const form = document.getElementById('slot-settings-form');
  form.weekdayStart.value = settings.weekdayStart;
  form.weekdayEnd.value = settings.weekdayEnd;
  form.weekendStart.value = settings.weekendStart;
  form.weekendEnd.value = settings.weekendEnd;
  form.marginMinutes.value = settings.marginMinutes;
  form.concertStart.value = settings.concertStart;
  form.concertEnd.value = settings.concertEnd;
}

async function onSaveSlotSettings(e) {
  e.preventDefault();
  const form = e.target;
  const statusEl = document.getElementById('slot-settings-status');
  statusEl.textContent = '';
  try {
    await api.patch('/api/calendar/settings', {
      weekdayStart: form.weekdayStart.value,
      weekdayEnd: form.weekdayEnd.value,
      weekendStart: form.weekendStart.value,
      weekendEnd: form.weekendEnd.value,
      marginMinutes: parseInt(form.marginMinutes.value, 10),
      concertStart: form.concertStart.value,
      concertEnd: form.concertEnd.value,
    });
    statusEl.textContent = 'Horaires enregistrés.';
  } catch (err) {
    showError(err.message);
  }
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

      <h2>Créneaux de répétition</h2>
      <p class="note">Horaires utilisés pour calculer les disponibilités sur <code>/calendar.html</code>.</p>
      <div class="panel">
        <form id="slot-settings-form" class="stacked-form">
          <label>Semaine — début <input type="time" name="weekdayStart" required></label>
          <label>Semaine — fin <input type="time" name="weekdayEnd" required></label>
          <label>Week-end — début <input type="time" name="weekendStart" required></label>
          <label>Week-end — fin <input type="time" name="weekendEnd" required></label>
          <label>Marge de transport (minutes)
            <input type="number" name="marginMinutes" min="0" max="180" step="5" required>
          </label>
          <p class="note">
            La marge élargit uniquement la vérification de disponibilité (avant/après le créneau),
            pour tenir compte du temps de trajet entre deux évènements — le créneau affiché ne change pas.
          </p>
          <label>Concert — début par défaut <input type="time" name="concertStart" required></label>
          <label>Concert — fin par défaut <input type="time" name="concertEnd" required></label>
          <p class="note">
            Comme la date d'un concert n'a pas d'heure enregistrée, ces horaires sont utilisés pour
            pré-remplir les liens « ajouter à mon agenda » sur <code>/calendar.html</code> et <code>/concerts.html</code>.
          </p>
          <p class="note" id="slot-settings-status"></p>
          <button type="submit">Enregistrer</button>
        </form>
      </div>

      <h2>Calendriers des membres</h2>
      <p class="note">
        Chaque utilisateur de l'application peut avoir plusieurs calendriers (Google, Outlook, Apple...).
        Seuls les utilisateurs avec au moins un calendrier configuré apparaissent sur <code>/calendar.html</code>.
        L'application ne conserve jamais le contenu de ces calendriers — seul un statut disponible/occupé
        par créneau est déduit et enregistré.
        <a href="/calendar-ics-help.html">Comment trouver le lien ICS d'un utilisateur ?</a>
      </p>
      <div class="panel admin-user-list" id="calendar-people-list">
        <p class="empty">Chargement…</p>
      </div>

      <h2>Notifications Discord</h2>
      <p class="note">
        Chaque webhook reçoit un message quand une répétition est proposée, retirée, acceptée ou refusée.
        Créer un webhook : sur Discord, Paramètres du salon → Intégrations → Webhooks → Nouveau webhook → Copier l'URL.
      </p>
      <div class="panel" id="discord-webhooks-list">
        <p class="empty">Chargement…</p>
      </div>
      <form id="add-discord-webhook-form" class="inline-form">
        <input name="label" placeholder="Libellé (optionnel)">
        <input name="url" type="url" placeholder="URL du webhook Discord" required>
        <button type="submit" class="secondary icon-btn">+ Ajouter</button>
      </form>
    `;
    document.getElementById('slot-settings-form').addEventListener('submit', onSaveSlotSettings);
    document.getElementById('add-discord-webhook-form').addEventListener('submit', onAddDiscordWebhook);
    await loadSlotSettingsForm();
    await loadCalendarUsers();
    await loadDiscordWebhooks();
  } catch (err) {
    showError(err.message);
  }
})();
