let me = null;
let instruments = [];
let songs = [];
const expanded = new Set();

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

function songCardTemplate(song) {
  const isOpen = expanded.has(song.id);
  return `
    <div class="card" data-song-id="${song.id}">
      <div class="card-header">
        <div>
          <div class="card-title">${escapeHtml(song.title)}</div>
          <div class="card-subtitle">${escapeHtml(song.artist)}</div>
        </div>
        <button class="secondary toggle-tutorials" data-id="${song.id}">
          ${isOpen ? 'Masquer les tutos' : `Tutos (${song.tutorial_count})`}
        </button>
      </div>
      ${song.notes ? `<p class="note">${escapeHtml(song.notes)}</p>` : ''}
      <div class="tutorials-panel" style="${isOpen ? '' : 'display:none'}">
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

function renderSongs() {
  const container = document.getElementById('songs-list');
  renderList(container, songs, songCardTemplate, 'Aucun morceau au répertoire pour le moment.');
  document.querySelectorAll('.toggle-tutorials').forEach((btn) => {
    btn.addEventListener('click', () => onToggleTutorials(parseInt(btn.dataset.id, 10)));
  });
  document.querySelectorAll('.add-tutorial-form').forEach((form) => {
    form.addEventListener('submit', onAddTutorial);
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
  try {
    await api.post('/api/songs', { title, artist, notes });
    form.reset();
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
