let me = null;
let allSongs = [];
let setlist = null;
let editRows = [];

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function songOptions(selectedId) {
  return allSongs
    .map((s) => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${escapeHtml(s.title)} — ${escapeHtml(s.artist)}</option>`)
    .join('');
}

function readOnlyView() {
  const main = setlist.songs.filter((s) => !s.is_encore);
  const encore = setlist.songs.filter((s) => s.is_encore);
  return `
    <div class="card">
      <div class="card-title">${escapeHtml(setlist.name || 'Concert')}</div>
      <div class="card-subtitle">${escapeHtml(setlist.venue || '')} · ${formatDate(setlist.concert_date)}</div>
    </div>
    <div class="setlist-section">
      <h3>Setlist</h3>
      ${main.length
        ? `<ol class="setlist">${main.map((s) => `<li>${escapeHtml(s.title)} — ${escapeHtml(s.artist)}${s.note ? `<span class="note">${escapeHtml(s.note)}</span>` : ''}</li>`).join('')}</ol>`
        : '<p class="empty">Aucun morceau pour le moment.</p>'}
    </div>
    <div class="setlist-section">
      <h3>Rappel</h3>
      ${encore.length
        ? `<ol class="setlist">${encore.map((s) => `<li>${escapeHtml(s.title)} — ${escapeHtml(s.artist)}${s.note ? `<span class="note">${escapeHtml(s.note)}</span>` : ''}</li>`).join('')}</ol>`
        : '<p class="empty">Aucun morceau de rappel prévu.</p>'}
    </div>
    ${me.isAdmin ? '<button id="edit-btn" class="secondary">Modifier la setlist</button>' : ''}
  `;
}

function editRowTemplate(row, index) {
  return `
    <div class="card" data-row-index="${index}">
      <div class="inline-form">
        <label>Morceau
          <select data-field="songId">${songOptions(row.songId)}</select>
        </label>
        <label>Position <input type="number" min="1" value="${row.position}" data-field="position" style="width:4rem"></label>
        <label>Note <input value="${escapeHtml(row.note || '')}" data-field="note"></label>
        <label><input type="checkbox" ${row.isEncore ? 'checked' : ''} data-field="isEncore"> Rappel</label>
        <button type="button" class="danger remove-row" data-index="${index}">Retirer</button>
      </div>
    </div>
  `;
}

function editView() {
  return `
    <div class="card">
      <h3>Détails du concert</h3>
      <form id="meta-form" class="inline-form">
        <label>Nom <input name="name" value="${escapeHtml(setlist?.name || '')}"></label>
        <label>Lieu <input name="venue" value="${escapeHtml(setlist?.venue || '')}"></label>
        <label>Date <input type="date" name="concertDate" value="${setlist ? setlist.concert_date.slice(0, 10) : ''}" required></label>
        <button type="submit">${setlist ? 'Enregistrer' : 'Créer le concert'}</button>
      </form>
    </div>
    ${setlist ? `
    <div id="rows-container">
      ${editRows.map(editRowTemplate).join('')}
    </div>
    <div class="inline-form">
      <button type="button" id="add-row-btn" class="secondary">Ajouter un morceau</button>
      <button type="button" id="save-songs-btn">Enregistrer la setlist</button>
      <button type="button" id="cancel-edit-btn" class="secondary">Annuler</button>
    </div>` : ''}
  `;
}

function renderReadOnly() {
  const container = document.getElementById('content');
  if (!setlist) {
    container.innerHTML = me.isAdmin
      ? `<p class="empty">Aucun concert à venir.</p>${editView()}`
      : '<p class="empty">Aucun concert à venir pour le moment.</p>';
    if (me.isAdmin) attachMetaFormHandler();
    return;
  }
  container.innerHTML = readOnlyView();
  const editBtn = document.getElementById('edit-btn');
  if (editBtn) editBtn.addEventListener('click', enterEditMode);
}

function enterEditMode() {
  editRows = setlist.songs.map((s) => ({
    setlistSongId: s.id,
    songId: s.song_id,
    position: s.position,
    note: s.note,
    isEncore: s.is_encore,
  }));
  renderEdit();
}

function renderEdit() {
  const container = document.getElementById('content');
  container.innerHTML = editView();
  attachMetaFormHandler();
  attachEditHandlers();
}

function attachMetaFormHandler() {
  const form = document.getElementById('meta-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const venue = form.venue.value.trim();
    const concertDate = form.concertDate.value;
    try {
      if (setlist) {
        setlist = await api.patch(`/api/setlists/${setlist.id}`, { name, venue, concertDate });
        setlist.songs = (await api.get(`/api/setlists/${setlist.id}`)).songs;
      } else {
        setlist = await api.post('/api/setlists', { name, venue, concertDate });
        setlist.songs = [];
      }
      enterEditMode();
    } catch (err) {
      showError(err.message);
    }
  });
}

function attachEditHandlers() {
  document.querySelectorAll('.remove-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      editRows.splice(parseInt(btn.dataset.index, 10), 1);
      renderEdit();
    });
  });
  document.querySelectorAll('[data-row-index]').forEach((rowEl) => {
    const index = parseInt(rowEl.dataset.rowIndex, 10);
    rowEl.querySelectorAll('[data-field]').forEach((input) => {
      input.addEventListener('change', () => {
        const field = input.dataset.field;
        if (field === 'isEncore') editRows[index][field] = input.checked;
        else if (field === 'position') editRows[index][field] = parseInt(input.value, 10);
        else if (field === 'songId') editRows[index][field] = parseInt(input.value, 10);
        else editRows[index][field] = input.value;
      });
    });
  });
  const addBtn = document.getElementById('add-row-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const nextPos = editRows.filter((r) => !r.isEncore).length + 1;
      editRows.push({ songId: allSongs[0]?.id, position: nextPos, note: '', isEncore: false });
      renderEdit();
    });
  }
  const saveBtn = document.getElementById('save-songs-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        const payload = editRows.map((r) => ({
          songId: r.songId,
          position: r.position,
          note: r.note,
          isEncore: !!r.isEncore,
        }));
        setlist = await api.put(`/api/setlists/${setlist.id}/songs`, { songs: payload });
        renderReadOnly();
      } catch (err) {
        showError(err.message);
      }
    });
  }
  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', renderReadOnly);
}

function showError(message) {
  document.getElementById('error').innerHTML = `<div class="error-banner">${escapeHtml(message)}</div>`;
}

(async function init() {
  me = await initNav('setlist');
  if (me.isAdmin) {
    allSongs = await api.get('/api/songs');
  }
  setlist = await api.get('/api/setlists/next');
  renderReadOnly();
})();
