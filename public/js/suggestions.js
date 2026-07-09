let me = null;
let suggestions = [];
const expanded = new Set();

async function loadSuggestions() {
  suggestions = await api.get('/api/suggestions');
  renderSuggestions();
  refreshSwipeView();
}

function statusLabel(status) {
  return { pending: 'En attente', approved: 'Approuvé', rejected: 'Rejeté' }[status] || status;
}

function findSuggestion(id) {
  return suggestions.find((s) => s.id === id);
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

// Rendered once when a detail panel opens — never re-rendered afterward, so the
// iframe embed isn't destroyed/reloaded just because some vote count changed.
function mediaTemplate(s) {
  const embed = youtubeEmbedUrl(s.youtube_url);
  return `
    ${embed ? `<div class="youtube-embed"><iframe src="${embed}" allowfullscreen></iframe></div>` : `<p><a href="${escapeHtml(s.youtube_url)}" target="_blank" rel="noopener">${escapeHtml(s.youtube_url)}</a></p>`}
    ${s.spotify_url ? `<div class="song-links"><a class="pill-link spotify" href="${escapeHtml(s.spotify_url)}" target="_blank" rel="noopener">&#9835; Spotify</a></div>` : ''}
    ${s.description ? `<div class="suggestion-note">${escapeHtml(s.description)}</div>` : ''}
  `;
}

// Re-rendered after any vote/promote/reject change — deliberately excludes the
// media block above so the embed stays mounted.
function voteSectionTemplate(s) {
  const myVote = s.votes.find((v) => v.user_id === me.id);
  return `
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

    <form class="inline-form admin-actions" data-id="${s.id}">
      <button type="button" class="promote-btn" data-id="${s.id}" ${s.promoted_song_id ? 'disabled' : ''}>
        ${s.promoted_song_id ? 'Déjà au répertoire' : 'Ajouter au répertoire'}
      </button>
      ${me.isAdmin ? `
      <button type="button" class="secondary reject-btn" data-id="${s.id}">Marquer rejeté</button>
      <button type="button" class="danger delete-btn" data-id="${s.id}">Supprimer</button>` : ''}
    </form>
  `;
}

function detailTemplate(s) {
  return `
    <div class="media-wrap">${mediaTemplate(s)}</div>
    <div class="vote-section">${voteSectionTemplate(s)}</div>
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

// Updates a card's status/tally text in place, without touching its detail panel/iframe.
function patchCardSummary(s) {
  const card = document.querySelector(`.card[data-suggestion-id="${s.id}"]`);
  if (!card) return;
  const subtitle = card.querySelector('.card-subtitle');
  if (subtitle) subtitle.textContent = `Proposé par ${s.suggested_by_name} · ${statusLabel(s.status)}`;
  const approveEl = card.querySelector('.vote-tally .approve');
  const rejectEl = card.querySelector('.vote-tally .reject');
  if (approveEl) approveEl.textContent = `✔ ${s.approve_count}`;
  if (rejectEl) rejectEl.textContent = `✘ ${s.reject_count}`;
  const promoteBtn = card.querySelector('.promote-btn');
  if (promoteBtn) {
    promoteBtn.disabled = !!s.promoted_song_id;
    promoteBtn.textContent = s.promoted_song_id ? 'Déjà au répertoire' : 'Ajouter au répertoire';
  }
}

function bindVoteSectionListeners(container, id) {
  container.querySelector('.vote-form').addEventListener('submit', (e) => onVote(e, id));
  const promoteBtn = container.querySelector('.promote-btn');
  if (promoteBtn) promoteBtn.addEventListener('click', () => onPromote(id));
  const rejectBtn = container.querySelector('.reject-btn');
  if (rejectBtn) rejectBtn.addEventListener('click', () => onReject(id));
  const deleteBtn = container.querySelector('.delete-btn');
  if (deleteBtn) deleteBtn.addEventListener('click', () => onDelete(id));
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
    bindVoteSectionListeners(container.querySelector('.vote-section'), id);
  } catch (err) {
    showError(err.message);
  }
}

// Re-fetches one suggestion's detail and refreshes only its vote-section (and
// card summary), leaving any mounted iframe untouched — used after voting,
// promoting or rejecting so the YouTube embed never reloads for unrelated changes.
async function refreshVoteSection(id) {
  const detail = await api.get(`/api/suggestions/${id}`);
  const myVote = detail.votes.find((v) => v.user_id === me.id);
  detail.my_vote = myVote?.vote || null;
  detail.my_vote_comment = myVote?.comment || null;
  const idx = suggestions.findIndex((s) => s.id === id);
  if (idx !== -1) suggestions[idx] = detail;
  patchCardSummary(detail);
  const container = document.querySelector(`[data-detail-for="${id}"] .vote-section`);
  if (container) {
    container.innerHTML = voteSectionTemplate(detail);
    bindVoteSectionListeners(container, id);
  }
  refreshSwipeView();
  return detail;
}

function removeCard(id) {
  const card = document.querySelector(`.card[data-suggestion-id="${id}"]`);
  if (card) card.remove();
  const idx = suggestions.findIndex((s) => s.id === id);
  if (idx !== -1) suggestions.splice(idx, 1);
  expanded.delete(id);
  if (!suggestions.length) renderSuggestions();
  refreshSwipeView();
}

function appendCard(s) {
  suggestions.push(s);
  const container = document.getElementById('suggestions-list');
  const emptyMsg = container.querySelector('.empty');
  if (emptyMsg) container.innerHTML = '';
  container.insertAdjacentHTML('beforeend', suggestionTemplate(s));
  const btn = container.querySelector(`.toggle-detail[data-id="${s.id}"]`);
  if (btn) btn.addEventListener('click', () => onToggleDetail(s.id));
  refreshSwipeView();
}

async function onVote(e, id) {
  e.preventDefault();
  const form = e.target;
  const vote = form.vote.value;
  const comment = form.comment.value.trim();
  try {
    await api.post(`/api/suggestions/${id}/vote`, { vote, comment });
    await refreshVoteSection(id);
  } catch (err) {
    showError(err.message);
  }
}

async function onPromote(id) {
  try {
    await api.post(`/api/suggestions/${id}/promote`, {});
    await refreshVoteSection(id);
  } catch (err) {
    showError(err.message);
  }
}

async function onReject(id) {
  try {
    await api.patch(`/api/suggestions/${id}`, { status: 'rejected' });
    await refreshVoteSection(id);
  } catch (err) {
    showError(err.message);
  }
}

async function onDelete(id) {
  try {
    await api.del(`/api/suggestions/${id}`);
    removeCard(id);
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
  const spotifyUrl = form.spotifyUrl.value.trim();
  const description = form.description.value.trim();
  try {
    const created = await api.post('/api/suggestions', { title, artist, youtubeUrl, spotifyUrl, description });
    form.reset();
    document.getElementById('suggestion-link-status').textContent = '';
    if (suggestionAutocomplete) suggestionAutocomplete.close();
    setAddSuggestionPanelOpen(false);
    appendCard({
      ...created,
      suggested_by_name: me.name,
      approve_count: 0,
      reject_count: 0,
      my_vote: null,
      my_vote_comment: null,
    });
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

let suggestionAutocomplete = null;

async function onSuggestionCandidateSelected(candidate) {
  document.getElementById('suggestion-title-input').value = candidate.title;
  document.getElementById('suggestion-artist-input').value = candidate.artist;

  const statusEl = document.getElementById('suggestion-link-status');
  statusEl.textContent = 'Recherche des liens YouTube / Spotify…';
  try {
    const links = await api.get(
      `/api/music-search/links?title=${encodeURIComponent(candidate.title)}&artist=${encodeURIComponent(candidate.artist)}`
    );
    const youtubeInput = document.getElementById('suggestion-youtube-input');
    const spotifyInput = document.getElementById('suggestion-spotify-input');
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

// ---------- Swipe ("Vote rapide") view ----------

const VIEW_STORAGE_KEY = 'octane-suggestions-view';
let currentView = localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'swipe';
let swipeQueue = [];
let dragState = null;

function pendingSwipeQueue() {
  return suggestions.filter((s) => s.status === 'pending' && !s.my_vote);
}

function setView(view) {
  currentView = view;
  localStorage.setItem(VIEW_STORAGE_KEY, view);
  document.getElementById('suggestions-list').style.display = view === 'list' ? '' : 'none';
  document.getElementById('swipe-view').style.display = view === 'swipe' ? '' : 'none';
  document.getElementById('view-toggle-list').classList.toggle('active', view === 'list');
  document.getElementById('view-toggle-swipe').classList.toggle('active', view === 'swipe');
  if (view === 'swipe') refreshSwipeView();
}

function refreshSwipeView() {
  if (currentView !== 'swipe') return;
  swipeQueue = pendingSwipeQueue();
  renderSwipeStack();
}

function swipeCardTemplate(s, depth) {
  const thumb = youtubeThumbnailUrl(s.youtube_url);
  return `
    <div class="swipe-card" data-id="${s.id}" style="--depth:${depth}">
      <div class="swipe-card-media">
        ${thumb ? `<img src="${thumb}" alt="${escapeHtml(s.title)}" loading="lazy">` : `<div class="song-thumb placeholder">&#9835;</div>`}
        <a class="play-overlay" href="${escapeHtml(s.youtube_url)}" target="_blank" rel="noopener" title="Écouter sur YouTube">&#9658;</a>
        <div class="swipe-stamp approve">J'APPROUVE</div>
        <div class="swipe-stamp reject">JE REJETTE</div>
      </div>
      <div class="swipe-card-body">
        <div class="card-title">${escapeHtml(s.title)}${s.artist ? ` — ${escapeHtml(s.artist)}` : ''}</div>
        <div class="card-subtitle">Proposé par ${escapeHtml(s.suggested_by_name)}</div>
      </div>
    </div>
  `;
}

function renderSwipeStack() {
  const stack = document.getElementById('swipe-stack');
  const counter = document.getElementById('swipe-counter');
  const empty = document.getElementById('swipe-empty');
  counter.textContent = swipeQueue.length ? `${swipeQueue.length} restante${swipeQueue.length > 1 ? 's' : ''}` : '';

  if (!swipeQueue.length) {
    stack.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const visible = swipeQueue.slice(0, 3);
  stack.innerHTML = visible.map((s, i) => swipeCardTemplate(s, i)).reverse().join('');

  const topCard = stack.querySelector(`.swipe-card[data-id="${visible[0].id}"]`);
  if (topCard) bindSwipeCardEvents(topCard, visible[0]);
}

function bindSwipeCardEvents(card, suggestion) {
  card.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    dragState = { id: card.dataset.id, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, raf: null };
    card.style.transition = 'none';
    card.setPointerCapture(e.pointerId);
  });
  card.addEventListener('pointermove', (e) => {
    if (!dragState || dragState.id !== card.dataset.id) return;
    dragState.dx = e.clientX - dragState.startX;
    dragState.dy = e.clientY - dragState.startY;
    if (dragState.raf) return;
    dragState.raf = requestAnimationFrame(() => {
      if (dragState) {
        applyDragTransform(card, dragState.dx, dragState.dy);
        dragState.raf = null;
      }
    });
  });
  const endDrag = (e) => {
    if (!dragState || dragState.id !== card.dataset.id) return;
    const { dx } = dragState;
    dragState = null;
    const threshold = 110;
    if (dx > threshold) {
      resolveCard(suggestion, 'approve', card);
    } else if (dx < -threshold) {
      resolveCard(suggestion, 'reject', card);
    } else {
      card.style.transition = 'transform 0.25s ease';
      card.style.transform = '';
      setTimeout(() => { card.style.transition = ''; }, 250);
      card.querySelectorAll('.swipe-stamp').forEach((el) => (el.style.opacity = 0));
    }
  };
  card.addEventListener('pointerup', endDrag);
  card.addEventListener('pointercancel', endDrag);
}

function applyDragTransform(card, dx, dy) {
  const rotate = dx / 12;
  card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rotate}deg)`;
  const approveStamp = card.querySelector('.swipe-stamp.approve');
  const rejectStamp = card.querySelector('.swipe-stamp.reject');
  const intensity = Math.min(Math.abs(dx) / 100, 1);
  if (dx > 0) {
    approveStamp.style.opacity = intensity;
    rejectStamp.style.opacity = 0;
  } else {
    rejectStamp.style.opacity = intensity;
    approveStamp.style.opacity = 0;
  }
}

async function resolveCard(suggestion, vote, cardEl) {
  const card = cardEl || document.querySelector(`.swipe-card[data-id="${suggestion.id}"]`);
  if (card) {
    card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    card.style.transform = `translate(${vote === 'approve' ? '' : '-'}600px, -40px) rotate(${vote === 'approve' ? '' : '-'}25deg)`;
    card.style.opacity = '0';
    card.style.pointerEvents = 'none';
  }
  try {
    await api.post(`/api/suggestions/${suggestion.id}/vote`, { vote, comment: '' });
    const idx = suggestions.findIndex((s) => s.id === suggestion.id);
    if (idx !== -1) {
      suggestions[idx].my_vote = vote;
      if (vote === 'approve') suggestions[idx].approve_count += 1;
      else suggestions[idx].reject_count += 1;
    }
    patchCardSummary(suggestions[idx]);
  } catch (err) {
    showError(err.message);
  }
  swipeQueue = swipeQueue.filter((s) => s.id !== suggestion.id);
  setTimeout(() => renderSwipeStack(), card ? 260 : 0);
}

function onSwipeButtonClick(vote) {
  if (!swipeQueue.length) return;
  const top = swipeQueue[0];
  resolveCard(top, vote);
}

// ---------- "Mes votes" review modal ----------

function openVotesModal() {
  renderVotesModalList();
  document.getElementById('votes-modal-overlay').classList.remove('hidden');
}

function closeVotesModal() {
  document.getElementById('votes-modal-overlay').classList.add('hidden');
}

function votesModalRowTemplate(s) {
  const isOpen = expanded.has(`modal-${s.id}`);
  return `
    <div class="vote-review-row" data-id="${s.id}">
      <div class="vote-review-header">
        <div>
          <div class="card-title">${escapeHtml(s.title)}${s.artist ? ` — ${escapeHtml(s.artist)}` : ''}</div>
          <div class="card-subtitle">Mon vote : ${s.my_vote === 'approve' ? '✔ Approuvé' : '✘ Rejeté'}</div>
        </div>
        <button class="secondary icon-btn toggle-vote-review" data-id="${s.id}">${isOpen ? 'Masquer' : 'Modifier'}</button>
      </div>
      <div class="vote-review-detail" style="${isOpen ? '' : 'display:none'}" data-review-for="${s.id}">
        <p class="empty">Chargement…</p>
      </div>
    </div>
  `;
}

function renderVotesModalList() {
  const container = document.getElementById('votes-modal-list');
  const voted = suggestions.filter((s) => s.my_vote);
  renderList(container, voted, votesModalRowTemplate, "Vous n'avez pas encore voté.");
  container.querySelectorAll('.toggle-vote-review').forEach((btn) => {
    btn.addEventListener('click', () => onToggleVoteReview(parseInt(btn.dataset.id, 10)));
  });
}

async function onToggleVoteReview(id) {
  const key = `modal-${id}`;
  if (expanded.has(key)) {
    expanded.delete(key);
    renderVotesModalList();
    return;
  }
  expanded.add(key);
  renderVotesModalList();
  try {
    const detail = await api.get(`/api/suggestions/${id}`);
    const container = document.querySelector(`[data-review-for="${id}"]`);
    if (!container) return;
    container.innerHTML = voteSectionTemplate(detail);
    container.querySelector('.vote-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      try {
        await api.post(`/api/suggestions/${id}/vote`, {
          vote: form.vote.value,
          comment: form.comment.value.trim(),
        });
        await refreshVoteSection(id);
        renderVotesModalList();
      } catch (err) {
        showError(err.message);
      }
    });
  } catch (err) {
    showError(err.message);
  }
}

(async function init() {
  me = await initNav('suggestions');
  document.getElementById('add-suggestion-form').addEventListener('submit', onAddSuggestion);
  document.getElementById('toggle-add-suggestion').addEventListener('click', () => {
    const isOpen = document.getElementById('add-suggestion-panel').style.display !== 'none';
    setAddSuggestionPanelOpen(!isOpen);
  });
  suggestionAutocomplete = createTitleAutocomplete({
    inputId: 'suggestion-title-input',
    dropdownId: 'suggestion-title-dropdown',
    onSelect: onSuggestionCandidateSelected,
  });

  document.getElementById('view-toggle-list').addEventListener('click', () => setView('list'));
  document.getElementById('view-toggle-swipe').addEventListener('click', () => setView('swipe'));
  document.getElementById('swipe-approve-btn').addEventListener('click', () => onSwipeButtonClick('approve'));
  document.getElementById('swipe-reject-btn').addEventListener('click', () => onSwipeButtonClick('reject'));
  document.getElementById('open-votes-modal').addEventListener('click', openVotesModal);
  document.getElementById('swipe-empty-review-btn').addEventListener('click', openVotesModal);
  document.getElementById('votes-modal-close').addEventListener('click', closeVotesModal);
  document.getElementById('votes-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeVotesModal();
  });
  document.addEventListener('keydown', (e) => {
    const modalOpen = !document.getElementById('votes-modal-overlay').classList.contains('hidden');
    if (e.key === 'Escape' && modalOpen) {
      closeVotesModal();
      return;
    }
    if (modalOpen || currentView !== 'swipe') return;
    if (e.key === 'ArrowRight') onSwipeButtonClick('approve');
    if (e.key === 'ArrowLeft') onSwipeButtonClick('reject');
  });

  setView(currentView);
  await loadSuggestions();
})();
