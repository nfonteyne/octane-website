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
            <button class="secondary icon-btn edit-song" data-id="${song.id}">Modifier</button>
          </div>
        </div>
      </div>
      <div class="tutorials-panel panel" style="${isOpen ? '' : 'display:none'}">
        <div class="tutorial-grid" data-tutorials-for="${song.id}"><p class="empty">Chargement…</p></div>
        <form class="inline-form add-tutorial-form" data-song-id="${song.id}">
          <label>Instrument
            <select name="instrumentId" required>${instrumentOptions()}</select>
          </label>
          <label>Lien <input name="url" type="url" required placeholder="https://..."></label>
          <label>Libellé <input name="label" placeholder="ex: tuto solo"></label>
          <button type="submit">Ajouter le tuto</button>
        </form>
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

function tutorialCardTemplate(t) {
  const thumb = youtubeThumbnailUrl(t.url);
  if (thumb) {
    return `
      <div class="tutorial-card" data-tutorial-id="${t.id}">
        <div class="song-thumb tutorial-thumb">
          <img src="${thumb}" alt="${escapeHtml(t.label || t.instrument_name)}" loading="lazy">
          <a class="play-overlay" href="${escapeHtml(t.url)}" target="_blank" rel="noopener" title="Regarder sur YouTube">&#9658;</a>
        </div>
        <div class="tutorial-meta">
          <span class="tag">${escapeHtml(t.instrument_name)}</span>
          <div class="tutorial-label">${escapeHtml(t.label || 'Tuto')}</div>
        </div>
        <button class="secondary icon-btn remove-tutorial" data-song-id="${t.song_id}" data-id="${t.id}">Retirer</button>
      </div>
    `;
  }
  return `
    <div class="tutorial-card" data-tutorial-id="${t.id}">
      <div class="song-thumb tutorial-thumb placeholder">&#128279;</div>
      <div class="tutorial-meta">
        <span class="tag">${escapeHtml(t.instrument_name)}</span>
        <div class="tutorial-label"><a href="${escapeHtml(t.url)}" target="_blank" rel="noopener">${escapeHtml(t.label || t.url)}</a></div>
      </div>
      <button class="secondary icon-btn remove-tutorial" data-song-id="${t.song_id}" data-id="${t.id}">Retirer</button>
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
    container.innerHTML = detail.tutorials.map(tutorialCardTemplate).join('');
    container.querySelectorAll('.remove-tutorial').forEach((btn) => {
      btn.addEventListener('click', () => onRemoveTutorial(parseInt(btn.dataset.songId, 10), parseInt(btn.dataset.id, 10)));
    });
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

async function onRemoveTutorial(songId, tutorialId) {
  try {
    await api.del(`/api/songs/${songId}/tutorials/${tutorialId}`);
    const song = songs.find((s) => s.id === songId);
    if (song) song.tutorial_count -= 1;
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
    document.getElementById('song-links-status').textContent = '';
    songAutocomplete.close();
    setAddSongPanelOpen(false);
    await loadSongs();
  } catch (err) {
    showError(err.message);
  }
}

function setAddSongPanelOpen(open) {
  document.getElementById('add-song-panel').style.display = open ? 'block' : 'none';
  document.getElementById('toggle-add-song').textContent = open ? 'Annuler' : '+ Ajouter un morceau';
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

let songAutocomplete = null;

async function onSongCandidateSelected(candidate) {
  document.getElementById('song-title-input').value = candidate.title;
  document.getElementById('song-artist-input').value = candidate.artist;

  const statusEl = document.getElementById('song-links-status');
  statusEl.textContent = 'Recherche des liens YouTube / Spotify…';
  try {
    const links = await api.get(
      `/api/music-search/links?title=${encodeURIComponent(candidate.title)}&artist=${encodeURIComponent(candidate.artist)}`
    );
    const youtubeInput = document.getElementById('song-youtube-input');
    const spotifyInput = document.getElementById('song-spotify-input');
    if (links.youtubeUrl && !youtubeInput.value) youtubeInput.value = links.youtubeUrl;
    if (links.spotifyUrl && !spotifyInput.value) spotifyInput.value = links.spotifyUrl;

    if (links.youtubeUrl && links.spotifyUrl) statusEl.textContent = 'Liens YouTube et Spotify trouvés automatiquement.';
    else if (links.youtubeUrl) statusEl.textContent = 'Lien YouTube trouvé automatiquement. Aucun lien Spotify trouvé — à saisir manuellement si besoin.';
    else if (links.spotifyUrl) statusEl.textContent = 'Lien Spotify trouvé automatiquement. Aucun lien YouTube trouvé — à saisir manuellement si besoin.';
    else statusEl.textContent = 'Aucun lien trouvé automatiquement — vous pouvez les saisir manuellement.';
  } catch (err) {
    statusEl.textContent = '';
  }
}

(async function init() {
  me = await initNav('repertoire');
  await loadInstruments();
  document.getElementById('add-song-form').addEventListener('submit', onAddSong);
  document.getElementById('toggle-add-song').addEventListener('click', () => {
    const isOpen = document.getElementById('add-song-panel').style.display !== 'none';
    setAddSongPanelOpen(!isOpen);
  });
  songAutocomplete = createTitleAutocomplete({
    inputId: 'song-title-input',
    dropdownId: 'song-title-dropdown',
    onSelect: onSongCandidateSelected,
  });
  await loadSongs();
})();
