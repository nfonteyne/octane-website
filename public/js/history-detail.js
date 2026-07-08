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
    container.innerHTML = `
      <h1>${escapeHtml(setlist.name || 'Concert')}</h1>
      <p class="card-subtitle">${escapeHtml(setlist.venue || '')} · ${formatDate(setlist.concert_date)}</p>
      <div class="setlist-section">
        <h3>Setlist</h3>
        ${main.length
          ? `<ol class="setlist">${main.map((s) => `<li>${escapeHtml(s.title)} — ${escapeHtml(s.artist)}${s.note ? `<span class="note">${escapeHtml(s.note)}</span>` : ''}</li>`).join('')}</ol>`
          : '<p class="empty">Aucun morceau enregistré.</p>'}
      </div>
      <div class="setlist-section">
        <h3>Rappel</h3>
        ${encore.length
          ? `<ol class="setlist">${encore.map((s) => `<li>${escapeHtml(s.title)} — ${escapeHtml(s.artist)}${s.note ? `<span class="note">${escapeHtml(s.note)}</span>` : ''}</li>`).join('')}</ol>`
          : '<p class="empty">Aucun rappel enregistré.</p>'}
      </div>
    `;
  } catch (err) {
    showError(err.message);
  }
})();
