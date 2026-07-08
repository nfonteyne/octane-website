let me = null;
let instruments = [];
let songs = [];
const expanded = new Set();
const editing = new Set();

async function loadInstruments() {
  instruments = await api.get('/api/instruments');
}

async function loadSongs() {
  songs = await api.get('/api/songs');
  renderSongs();
}

function instrumentOptions() {
  return instruments.map((i) => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('');
}

function songThumbTemplate(song) {
  const thumb = song.youtube_url ? youtubeThumbnailUrl(song.youtube_url) : null;
  if (thumb) {
    return `
      <div class="song-thumb">
        <img src="${thumb}" alt="${escapeHtml(song.title)}" loading="lazy">
        <a class="play-overlay" href="${escapeHtml(song.youtube_url)}" target="_blank" rel="noopener" title="Écouter sur YouTube">&#9658;</a>
      </div>
    `;
  }
  return `<div class="song-thumb placeholder">&#9835;</div>`;
}

function songLinksTemplate(song) {
  const links = [];
  if (song.youtube_url) {
    links.push(`<a class="pill-link youtube" href="${escapeHtml(song.youtube_url)}" target="_blank" rel="noopener">&#9658; YouTube</a>`);
  }
  if (song.spotify_url) {
    links.push(`<a class="pill-link spotify" href="${escapeHtml(song.spotify_url)}" target="_blank" rel="noopener">&#9835; Spotify</a>`);
  }
  return links.length ? `<div class="song-links">${links.join('')}</div>` : '';
}

function songCardTemplate(song) {
  if (editing.has(song.id)) return editSongCardTemplate(song);

  const isOpen = expanded.has(song.id);
  return `
    <div class="card" data-song-id="${song.id}">
      <div class="song-card">
        ${songThumbTemplate(song)}
        <div class="song-body">
          <div class="card-header">
            <div>
              <div class="card-title">${escapeHtml(song.title)}</div>
              <div class="card-subtitle">${escapeHtml(song.artist)}</div>
            </div>
          </div>
          ${song.notes ? `<p class="note">${escapeHtml(song.notes)}</p>` : ''}
          ${songLinksTemplate(song)}
          <div class="song-links">
            <button class="secondary icon-btn toggle-tutorials" data-id="${song.id}">
              ${isOpen ? 'Masquer les tutos' : `Tutos (${song.tutorial_count})`}
            </button>
            ${me && me.isAdmin ? `<button class="secondary icon-btn edit-song" data-id="${song.id}">Modifier</button>` : ''}
          </div>
        </div>
      </div>
      <div class="tutorials-panel panel" style="${isOpen ? '' : 'display:none'}">
        <div class="tag-list" data-tutorials-for="${song.id}"><p class="empty">Chargement…</p></div>
        ${me && me.isAdmin ? `
        <form class="inline-form add-tutorial-form" data-song-id="${song.id}">
          <label>Instrument
            <select name="instrumentId" required>${instrumentOptions()}</select>
          </label>
          <label>Lien <input name="url" type="url" required placeholder="https://..."></label>
          <label>Libellé <input name="label" placeholder="ex: tuto solo"></label>
          <button type="submit">Ajouter le tuto</button>
        </form>` : ''}
      </div>
    </div>
  `;
}

function editSongCardTemplate(song) {
  return `
    <div class="card" data-song-id="${song.id}">
      <form class="stacked-form edit-song-form" data-id="${song.id}">
        <label>Titre <input name="title" value="${escapeHtml(song.title)}" required></label>
        <label>Artiste <input name="artist" value="${escapeHtml(song.artist)}" required></label>
        <label>Notes <input name="notes" value="${escapeHtml(song.notes || '')}"></label>
        <label>Lien YouTube <input name="youtubeUrl" type="url" value="${escapeHtml(song.youtube_url || '')}" placeholder="https://youtube.com/watch?v=..."></label>
        <label>Lien Spotify <input name="spotifyUrl" type="url" value="${escapeHtml(song.spotify_url || '')}" placeholder="https://open.spotify.com/track/..."></label>
        <div class="song-links">
          <button type="submit">Enregistrer</button>
          <button type="button" class="secondary cancel-edit" data-id="${song.id}">Annuler</button>
          <button type="button" class="danger delete-song" data-id="${song.id}">Supprimer</button>
        </div>
      </form>
    </div>
  `;
}

function renderSongs() {
  const container = document.getElementById('songs-list');
  renderList(container, songs, songCardTemplate, 'Aucun morceau au répertoire pour le moment.');

  document.querySelectorAll('.toggle-tutorials').forEach((btn) => {
    btn.addEventListener('click', () => onToggleTutorials(parseInt(btn.dataset.id, 10)));
  });
  document.querySelectorAll('.add-tutorial-form').forEach((form) => {
    form.addEventListener('submit', onAddTutorial);
  });
  document.querySelectorAll('.edit-song').forEach((btn) => {
    btn.addEventListener('click', () => {
      editing.add(parseInt(btn.dataset.id, 10));
      renderSongs();
    });
  });
  document.querySelectorAll('.cancel-edit').forEach((btn) => {
    btn.addEventListener('click', () => {
      editing.delete(parseInt(btn.dataset.id, 10));
      renderSongs();
    });
  });
  document.querySelectorAll('.edit-song-form').forEach((form) => {
    form.addEventListener('submit', onSaveSong);
  });
  document.querySelectorAll('.delete-song').forEach((btn) => {
    btn.addEventListener('click', () => onDeleteSong(parseInt(btn.dataset.id, 10)));
  });
}

async function onToggleTutorials(songId) {
  if (expanded.has(songId)) {
    expanded.delete(songId);
  } else {
    expanded.add(songId);
  }
  renderSongs();
  if (expanded.has(songId)) {
    await loadTutorials(songId);
  }
}

async function loadTutorials(songId) {
  try {
    const detail = await api.get(`/api/songs/${songId}`);
    const container = document.querySelector(`[data-tutorials-for="${songId}"]`);
    if (!container) return;
    if (!detail.tutorials.length) {
      container.innerHTML = '<p class="empty">Aucun lien pour le moment.</p>';
      return;
    }
    container.innerHTML = detail.tutorials
      .map(
        (t) => `<span class="tag">${escapeHtml(t.instrument_name)}: <a href="${escapeHtml(t.url)}" target="_blank" rel="noopener">${escapeHtml(t.label || t.url)}</a></span>`
      )
      .join('');
  } catch (err) {
    showError(err.message);
  }
}

async function onAddTutorial(e) {
  e.preventDefault();
  const form = e.target;
  const songId = parseInt(form.dataset.songId, 10);
  const instrumentId = parseInt(form.instrumentId.value, 10);
  const url = form.url.value.trim();
  const label = form.label.value.trim();
  try {
    await api.post(`/api/songs/${songId}/tutorials`, { instrumentId, url, label });
    form.reset();
    const song = songs.find((s) => s.id === songId);
    if (song) song.tutorial_count += 1;
    await loadTutorials(songId);
    renderSongs();
  } catch (err) {
    showError(err.message);
  }
}

async function onAddSong(e) {
  e.preventDefault();
  const form = e.target;
  const title = form.title.value.trim();
  const artist = form.artist.value.trim();
  const notes = form.notes.value.trim();
  const youtubeUrl = form.youtubeUrl.value.trim();
  const spotifyUrl = form.spotifyUrl.value.trim();
  try {
    await api.post('/api/songs', { title, artist, notes, youtubeUrl, spotifyUrl });
    form.reset();
    await loadSongs();
  } catch (err) {
    showError(err.message);
  }
}

async function onSaveSong(e) {
  e.preventDefault();
  const form = e.target;
  const id = parseInt(form.dataset.id, 10);
  const title = form.title.value.trim();
  const artist = form.artist.value.trim();
  const notes = form.notes.value.trim();
  const youtubeUrl = form.youtubeUrl.value.trim();
  const spotifyUrl = form.spotifyUrl.value.trim();
  try {
    await api.patch(`/api/songs/${id}`, { title, artist, notes, youtubeUrl, spotifyUrl });
    editing.delete(id);
    await loadSongs();
  } catch (err) {
    showError(err.message);
  }
}

async function onDeleteSong(id) {
  try {
    await api.del(`/api/songs/${id}`);
    editing.delete(id);
    await loadSongs();
  } catch (err) {
    showError(err.message);
  }
}

function showError(message) {
  document.getElementById('error').innerHTML = `<div class="error-banner">${escapeHtml(message)}</div>`;
}

(async function init() {
  me = await initNav('repertoire');
  await loadInstruments();
  if (me.isAdmin) {
    document.getElementById('admin-add-song').style.display = 'block';
    document.getElementById('add-song-form').addEventListener('submit', onAddSong);
  }
  await loadSongs();
})();
