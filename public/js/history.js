let concerts = [];
let viewMode = 'timeline';

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
}

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

      <a class="back-link" href="/history-detail.html?id=${concert.id}">Voir / modifier ce concert &rarr;</a>
    </div>
  `;
}

function concertCardTemplate(c) {
  return `
    <div class="card">
      <a href="/history-detail.html?id=${c.id}" style="text-decoration:none;color:inherit">
        <div class="card-title">${escapeHtml(c.name || 'Concert')}</div>
        <div class="card-subtitle">${escapeHtml(c.venue || '')} · ${formatDateShort(c.concert_date)}</div>
      </a>
    </div>
  `;
}

function renderTimeline() {
  const container = document.getElementById('timeline-view');
  if (!concerts.length) {
    container.innerHTML = '<p class="empty">Aucun concert passé enregistré.</p>';
    return;
  }
  container.innerHTML = concerts.map(timelineConcertBlock).join('');
}

function renderCompact() {
  const container = document.getElementById('compact-view');
  renderList(container, concerts, concertCardTemplate, 'Aucun concert passé enregistré.');
}

function applyViewMode() {
  const timelineEl = document.getElementById('timeline-view');
  const compactEl = document.getElementById('compact-view');
  const btn = document.getElementById('toggle-view-btn');
  if (viewMode === 'timeline') {
    timelineEl.style.display = 'block';
    compactEl.style.display = 'none';
    btn.textContent = 'Vue réduite';
  } else {
    timelineEl.style.display = 'none';
    compactEl.style.display = 'grid';
    btn.textContent = 'Vue chronologique';
  }
}

function showError(message) {
  document.getElementById('error').innerHTML = `<div class="error-banner">${escapeHtml(message)}</div>`;
}

(async function init() {
  await initNav('history');

  document.getElementById('toggle-view-btn').addEventListener('click', () => {
    viewMode = viewMode === 'timeline' ? 'compact' : 'timeline';
    applyViewMode();
  });

  try {
    concerts = await api.get('/api/setlists/history?full=1');
    renderTimeline();
    renderCompact();
    applyViewMode();
  } catch (err) {
    showError(err.message);
  }
})();
