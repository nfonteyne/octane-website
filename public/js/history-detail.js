function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function showError(message) {
  document.getElementById('error').innerHTML = `<div class="error-banner">${escapeHtml(message)}</div>`;
}

(async function init() {
  await initNav('history');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const container = document.getElementById('content');
  if (!id) {
    container.innerHTML = '<p class="empty">Concert introuvable.</p>';
    return;
  }
  try {
    const setlist = await api.get(`/api/setlists/${id}`);
    const main = setlist.songs.filter((s) => !s.is_encore);
    const encore = setlist.songs.filter((s) => s.is_encore);
    const rowHtml = (s) => `<li><span class="row-title">${escapeHtml(s.title)}</span> <span class="row-artist">— ${escapeHtml(s.artist)}</span>${s.note ? `<span class="note">${escapeHtml(s.note)}</span>` : ''}</li>`;

    container.innerHTML = `
      <div class="card">
        <div class="card-title">${escapeHtml(setlist.name || 'Concert')}</div>
        <div class="card-subtitle">${escapeHtml(setlist.venue || '')} · ${formatDate(setlist.concert_date)}</div>
      </div>
      <div class="setlist-section">
        <h3>Setlist</h3>
        ${main.length
          ? `<ol class="setlist">${main.map(rowHtml).join('')}</ol>`
          : '<p class="empty">Aucun morceau enregistré.</p>'}
      </div>
      <div class="setlist-section">
        <h3>Rappel</h3>
        ${encore.length
          ? `<ol class="setlist">${encore.map(rowHtml).join('')}</ol>`
          : '<p class="empty">Aucun rappel enregistré.</p>'}
      </div>
    `;
  } catch (err) {
    showError(err.message);
  }
})();
