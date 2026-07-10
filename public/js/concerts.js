let allSongs = [];
let concerts = [];
let historyViewMode = 'timeline';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function showError(message) {
  document.getElementById('error').innerHTML = `<div class="error-banner">${escapeHtml(message)}</div>`;
}

// ---------- Tabs ----------

function switchTab(tab) {
  document.getElementById('next-view').style.display = tab === 'next' ? '' : 'none';
  document.getElementById('history-view').style.display = tab === 'history' ? '' : 'none';
  document.getElementById('tab-next').classList.toggle('active', tab === 'next');
  document.getElementById('tab-history').classList.toggle('active', tab === 'history');
}

// ---------- Historique: liste (timeline / compact) ----------

function timelineSongRow(song) {
  const embed = youtubeEmbedUrl(song.youtube_url);
  return `
    <div class="timeline-song-row">
      <div class="row-index">${song.position}</div>
      <div class="timeline-song-main">
        <div class="timeline-song-title">${escapeHtml(song.title)}</div>
        <div class="card-subtitle">${escapeHtml(song.artist)}</div>
        ${song.note ? `<p class="note">${escapeHtml(song.note)}</p>` : ''}
        ${song.spotify_url ? `<div class="song-links"><a class="pill-link spotify" href="${escapeHtml(song.spotify_url)}" target="_blank" rel="noopener">&#9835; Spotify</a></div>` : ''}
      </div>
      ${embed
        ? `<div class="youtube-embed timeline-embed"><iframe src="${embed}" loading="lazy" allowfullscreen></iframe></div>`
        : `<p class="empty timeline-no-embed">Pas de lien YouTube</p>`}
    </div>
  `;
}

function timelineConcertBlock(concert) {
  const main = concert.songs.filter((s) => !s.is_encore);
  const encore = concert.songs.filter((s) => s.is_encore);
  const playlistUrl = youtubePlaylistUrl(concert.songs.map((s) => s.youtube_url).filter(Boolean));
  return `
    <div class="card timeline-concert">
      <div class="card-title">${escapeHtml(concert.name || 'Concert')}</div>
      <div class="card-subtitle">${escapeHtml(concert.venue || '')} · ${formatDate(concert.concert_date)}</div>
      ${playlistUrl ? `<div class="song-links"><a class="pill-link youtube" href="${playlistUrl}" target="_blank" rel="noopener">&#9658; Écouter la setlist sur YouTube</a></div>` : ''}

      <div class="setlist-section">
        <h3>Setlist</h3>
        ${main.length
          ? `<div class="timeline-songs">${main.map(timelineSongRow).join('')}</div>`
          : '<p class="empty">Aucun morceau enregistré.</p>'}
      </div>

      ${encore.length ? `
      <div class="setlist-section">
        <h3>Rappel</h3>
        <div class="timeline-songs">${encore.map(timelineSongRow).join('')}</div>
      </div>` : ''}

      <a class="back-link" href="#" data-concert-id="${concert.id}">Voir / modifier ce concert &rarr;</a>
    </div>
  `;
}

function concertCardTemplate(c) {
  return `
    <div class="card">
      <a href="#" data-concert-id="${c.id}" style="text-decoration:none;color:inherit">
        <div class="card-title">${escapeHtml(c.name || 'Concert')}</div>
        <div class="card-subtitle">${escapeHtml(c.venue || '')} · ${formatDateShort(c.concert_date)}</div>
      </a>
    </div>
  `;
}

function bindConcertLinks(container) {
  container.querySelectorAll('[data-concert-id]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      showHistoryDetail(el.dataset.concertId);
    });
  });
}

function renderTimeline() {
  const container = document.getElementById('timeline-view');
  if (!concerts.length) {
    container.innerHTML = '<p class="empty">Aucun concert passé enregistré.</p>';
    return;
  }
  container.innerHTML = concerts.map(timelineConcertBlock).join('');
  bindConcertLinks(container);
}

function renderCompact() {
  const container = document.getElementById('compact-view');
  renderList(container, concerts, concertCardTemplate, 'Aucun concert passé enregistré.');
  bindConcertLinks(container);
}

function applyHistoryViewMode() {
  const timelineEl = document.getElementById('timeline-view');
  const compactEl = document.getElementById('compact-view');
  const btn = document.getElementById('toggle-history-mode-btn');
  if (historyViewMode === 'timeline') {
    timelineEl.style.display = 'block';
    compactEl.style.display = 'none';
    btn.textContent = 'Vue réduite';
  } else {
    timelineEl.style.display = 'none';
    compactEl.style.display = 'grid';
    btn.textContent = 'Vue chronologique';
  }
}

async function loadHistory() {
  concerts = await api.get('/api/setlists/history?full=1');
  renderTimeline();
  renderCompact();
  applyHistoryViewMode();
}

// ---------- Historique: détail d'un concert ----------

function showHistoryList() {
  document.getElementById('history-detail-view').style.display = 'none';
  document.getElementById('history-list-view').style.display = 'block';
  history.pushState({}, '', '/concerts.html?tab=history');
}

function showHistoryDetail(id) {
  document.getElementById('history-list-view').style.display = 'none';
  document.getElementById('history-detail-view').style.display = 'block';
  history.pushState({}, '', `/concerts.html?tab=history&id=${id}`);

  const editor = createSetlistEditor({
    containerId: 'history-detail-content',
    allSongs,
    getSetlist: async () => {
      try {
        return await api.get(`/api/setlists/${id}`);
      } catch (err) {
        return null;
      }
    },
    emptyMessage: 'Concert introuvable.',
    allowDelete: true,
    onDeleted: async () => {
      showHistoryList();
      await loadHistory();
    },
  });
  editor.load();
}

(async function init() {
  await initNav('concerts');
  allSongs = await api.get('/api/songs');

  const nextEditor = createSetlistEditor({
    containerId: 'next-content',
    allSongs,
    getSetlist: () => api.get('/api/setlists/next'),
    createSetlist: (data) => api.post('/api/setlists', data),
    emptyMessage: 'Aucun concert à venir pour le moment.',
    allowDelete: true,
    onDeleted: () => nextEditor.load(),
  });

  document.getElementById('tab-next').addEventListener('click', () => switchTab('next'));
  document.getElementById('tab-history').addEventListener('click', () => switchTab('history'));
  document.getElementById('toggle-history-mode-btn').addEventListener('click', () => {
    historyViewMode = historyViewMode === 'timeline' ? 'compact' : 'timeline';
    applyHistoryViewMode();
  });
  document.getElementById('back-to-history-link').addEventListener('click', (e) => {
    e.preventDefault();
    showHistoryList();
  });

  try {
    await nextEditor.load();
    await loadHistory();

    const params = new URLSearchParams(window.location.search);
    const deepId = params.get('id');
    if (deepId) {
      switchTab('history');
      showHistoryDetail(deepId);
    } else if (params.get('tab') === 'history') {
      switchTab('history');
    }
  } catch (err) {
    showError(err.message);
  }
})();
