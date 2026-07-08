let me = null;
let suggestions = [];
const expanded = new Set();

async function loadSuggestions() {
  suggestions = await api.get('/api/suggestions');
  renderSuggestions();
}

function statusLabel(status) {
  return { pending: 'En attente', approved: 'Approuvé', rejected: 'Rejeté' }[status] || status;
}

function suggestionThumbTemplate(s) {
  const thumb = youtubeThumbnailUrl(s.youtube_url);
  if (thumb) {
    return `
      <div class="song-thumb">
        <img src="${thumb}" alt="${escapeHtml(s.title)}" loading="lazy">
        <a class="play-overlay" href="${escapeHtml(s.youtube_url)}" target="_blank" rel="noopener" title="Écouter sur YouTube">&#9658;</a>
      </div>
    `;
  }
  return `<div class="song-thumb placeholder">&#9835;</div>`;
}

function suggestionTemplate(s) {
  const isOpen = expanded.has(s.id);
  return `
    <div class="card" data-suggestion-id="${s.id}">
      <div class="song-card">
        ${suggestionThumbTemplate(s)}
        <div class="song-body">
          <div class="card-header">
            <div>
              <div class="card-title">${escapeHtml(s.title)}${s.artist ? ` — ${escapeHtml(s.artist)}` : ''}</div>
              <div class="card-subtitle">Proposé par ${escapeHtml(s.suggested_by_name)} · ${statusLabel(s.status)}</div>
            </div>
          </div>
          <div class="vote-tally">
            <span class="approve">✔ ${s.approve_count}</span>
            <span class="reject">✘ ${s.reject_count}</span>
          </div>
          <button class="secondary icon-btn toggle-detail" data-id="${s.id}">${isOpen ? 'Masquer' : 'Voir / voter'}</button>
        </div>
      </div>
      <div class="detail-panel panel" style="${isOpen ? '' : 'display:none'}" data-detail-for="${s.id}">
        <p class="empty">Chargement…</p>
      </div>
    </div>
  `;
}

function detailTemplate(s) {
  const embed = youtubeEmbedUrl(s.youtube_url);
  const myVote = s.votes.find((v) => v.user_id === me.id);
  return `
    ${embed ? `<div class="youtube-embed"><iframe src="${embed}" allowfullscreen></iframe></div>` : `<p><a href="${escapeHtml(s.youtube_url)}" target="_blank" rel="noopener">${escapeHtml(s.youtube_url)}</a></p>`}
    ${s.description ? `<div class="suggestion-note">${escapeHtml(s.description)}</div>` : ''}

    <form class="inline-form vote-form" data-id="${s.id}">
      <label>Mon vote
        <select name="vote">
          <option value="approve" ${myVote?.vote === 'approve' ? 'selected' : ''}>J'approuve</option>
          <option value="reject" ${myVote?.vote === 'reject' ? 'selected' : ''}>Je rejette</option>
        </select>
      </label>
      <label>Commentaire <input name="comment" value="${escapeHtml(myVote?.comment || '')}" placeholder="pourquoi ?"></label>
      <button type="submit">${myVote ? 'Mettre à jour mon vote' : 'Voter'}</button>
    </form>

    <div class="vote-list">
      ${s.votes.length ? s.votes.map(voteItemTemplate).join('') : '<p class="empty">Aucun vote pour le moment.</p>'}
    </div>

    ${me.isAdmin ? `
    <form class="inline-form admin-actions" data-id="${s.id}">
      <button type="button" class="promote-btn" data-id="${s.id}" ${s.promoted_song_id ? 'disabled' : ''}>
        ${s.promoted_song_id ? 'Déjà au répertoire' : 'Promouvoir au répertoire'}
      </button>
      <button type="button" class="secondary reject-btn" data-id="${s.id}">Marquer rejeté</button>
      <button type="button" class="danger delete-btn" data-id="${s.id}">Supprimer</button>
    </form>` : ''}
  `;
}

function voteItemTemplate(v) {
  const icon = v.vote === 'approve' ? '✔' : '✘';
  return `
    <div class="vote-item ${v.vote}">
      <span class="voter">${escapeHtml(v.voter_name)}</span> ${icon}
      ${v.comment ? `— ${escapeHtml(v.comment)}` : ''}
    </div>
  `;
}

function renderSuggestions() {
  const container = document.getElementById('suggestions-list');
  renderList(container, suggestions, suggestionTemplate, 'Aucune suggestion pour le moment.');
  document.querySelectorAll('.toggle-detail').forEach((btn) => {
    btn.addEventListener('click', () => onToggleDetail(parseInt(btn.dataset.id, 10)));
  });
}

async function onToggleDetail(id) {
  if (expanded.has(id)) {
    expanded.delete(id);
  } else {
    expanded.add(id);
  }
  renderSuggestions();
  if (expanded.has(id)) {
    await loadDetail(id);
  }
}

async function loadDetail(id) {
  try {
    const detail = await api.get(`/api/suggestions/${id}`);
    const container = document.querySelector(`[data-detail-for="${id}"]`);
    if (!container) return;
    container.innerHTML = detailTemplate(detail);
    container.querySelector('.vote-form').addEventListener('submit', (e) => onVote(e, id));
    const promoteBtn = container.querySelector('.promote-btn');
    if (promoteBtn) promoteBtn.addEventListener('click', () => onPromote(id));
    const rejectBtn = container.querySelector('.reject-btn');
    if (rejectBtn) rejectBtn.addEventListener('click', () => onReject(id));
    const deleteBtn = container.querySelector('.delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', () => onDelete(id));
  } catch (err) {
    showError(err.message);
  }
}

async function onVote(e, id) {
  e.preventDefault();
  const form = e.target;
  const vote = form.vote.value;
  const comment = form.comment.value.trim();
  try {
    await api.post(`/api/suggestions/${id}/vote`, { vote, comment });
    await loadSuggestions();
    expanded.add(id);
    renderSuggestions();
    await loadDetail(id);
  } catch (err) {
    showError(err.message);
  }
}

async function onPromote(id) {
  try {
    await api.post(`/api/suggestions/${id}/promote`, {});
    await loadSuggestions();
    expanded.add(id);
    renderSuggestions();
    await loadDetail(id);
  } catch (err) {
    showError(err.message);
  }
}

async function onReject(id) {
  try {
    await api.patch(`/api/suggestions/${id}`, { status: 'rejected' });
    await loadSuggestions();
    expanded.add(id);
    renderSuggestions();
    await loadDetail(id);
  } catch (err) {
    showError(err.message);
  }
}

async function onDelete(id) {
  try {
    await api.del(`/api/suggestions/${id}`);
    expanded.delete(id);
    await loadSuggestions();
  } catch (err) {
    showError(err.message);
  }
}

async function onAddSuggestion(e) {
  e.preventDefault();
  const form = e.target;
  const title = form.title.value.trim();
  const artist = form.artist.value.trim();
  const youtubeUrl = form.youtubeUrl.value.trim();
  const description = form.description.value.trim();
  try {
    await api.post('/api/suggestions', { title, artist, youtubeUrl, description });
    form.reset();
    setAddSuggestionPanelOpen(false);
    await loadSuggestions();
  } catch (err) {
    showError(err.message);
  }
}

function setAddSuggestionPanelOpen(open) {
  document.getElementById('add-suggestion-panel').style.display = open ? 'block' : 'none';
  document.getElementById('toggle-add-suggestion').textContent = open ? 'Annuler' : '+ Proposer un morceau';
}

function showError(message) {
  document.getElementById('error').innerHTML = `<div class="error-banner">${escapeHtml(message)}</div>`;
}

(async function init() {
  me = await initNav('suggestions');
  document.getElementById('add-suggestion-form').addEventListener('submit', onAddSuggestion);
  document.getElementById('toggle-add-suggestion').addEventListener('click', () => {
    const isOpen = document.getElementById('add-suggestion-panel').style.display !== 'none';
    setAddSuggestionPanelOpen(!isOpen);
  });
  await loadSuggestions();
})();
