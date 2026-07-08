function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function concertTemplate(c) {
  return `
    <div class="card">
      <a href="/history-detail.html?id=${c.id}" style="text-decoration:none;color:inherit">
        <div class="card-title">${escapeHtml(c.name || 'Concert')}</div>
        <div class="card-subtitle">${escapeHtml(c.venue || '')} · ${formatDate(c.concert_date)}</div>
      </a>
    </div>
  `;
}

function showError(message) {
  document.getElementById('error').innerHTML = `<div class="error-banner">${escapeHtml(message)}</div>`;
}

(async function init() {
  await initNav('history');
  try {
    const history = await api.get('/api/setlists/history');
    renderList(document.getElementById('history-list'), history, concertTemplate, 'Aucun concert passé enregistré.');
  } catch (err) {
    showError(err.message);
  }
})();
