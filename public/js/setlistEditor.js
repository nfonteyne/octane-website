// Shared setlist editor used by concerts.js for both the "prochain concert"
// tab and a past concert's detail view: choose songs from the repertoire,
// order them, add per-song notes, mark encore songs, save. Parameterized so
// the caller decides how to load/create/delete the underlying setlist.
function createSetlistEditor({
  containerId = 'content',
  allSongs,
  getSetlist,
  createSetlist = null,
  emptyMessage = 'Aucun concert.',
  allowDelete = false,
  onDeleted = null,
}) {
  let setlist = null;
  let mainRows = [];
  let encoreRows = [];
  let actionsRevealed = false;

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function container() {
    return document.getElementById(containerId);
  }

  function showError(message) {
    document.getElementById('error').innerHTML = `<div class="error-banner">${escapeHtml(message)}</div>`;
  }

  function readOnlyView() {
    const main = setlist.songs.filter((s) => !s.is_encore);
    const encore = setlist.songs.filter((s) => s.is_encore);
    const rowHtml = (s) => `<li><span class="row-title">${escapeHtml(s.title)}</span> <span class="row-artist">— ${escapeHtml(s.artist)}</span>${s.note ? `<span class="note">${escapeHtml(s.note)}</span>` : ''}</li>`;
    const playlistUrl = youtubePlaylistUrl([...main, ...encore].map((s) => s.youtube_url).filter(Boolean));
    return `
      <div class="card" id="concert-summary-card" style="cursor:pointer">
        <div class="card-title">${escapeHtml(setlist.name || 'Concert')}</div>
        <div class="card-subtitle">${escapeHtml(setlist.venue || '')} · ${formatDate(setlist.concert_date)}</div>
        ${playlistUrl ? `<div class="song-links"><a class="pill-link youtube" id="playlist-link" href="${playlistUrl}" target="_blank" rel="noopener">&#9658; Écouter la setlist sur YouTube</a></div>` : ''}
        <p class="note" style="margin-bottom:0">${actionsRevealed ? 'Cliquer pour masquer les actions' : 'Cliquer pour modifier ou supprimer'}</p>
      </div>
      <div class="setlist-section">
        <h3>Setlist</h3>
        ${main.length ? `<ol class="setlist">${main.map(rowHtml).join('')}</ol>` : '<p class="empty">Aucun morceau pour le moment.</p>'}
      </div>
      <div class="setlist-section">
        <h3>Rappel</h3>
        ${encore.length ? `<ol class="setlist">${encore.map(rowHtml).join('')}</ol>` : '<p class="empty">Aucun morceau de rappel prévu.</p>'}
      </div>
      ${actionsRevealed ? `
      <div class="inline-form" style="margin-top:1rem">
        <button id="edit-btn" class="secondary">Modifier</button>
        ${allowDelete ? '<button id="delete-btn" class="danger">Supprimer ce concert</button>' : ''}
      </div>` : ''}
    `;
  }

  function renderReadOnly() {
    if (!setlist) {
      container().innerHTML = createSetlist
        ? `<p class="empty">${escapeHtml(emptyMessage)}</p>${metaFormTemplate()}`
        : `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
      if (createSetlist) attachMetaFormHandler();
      return;
    }
    container().innerHTML = readOnlyView();
    document.getElementById('concert-summary-card').addEventListener('click', () => {
      actionsRevealed = !actionsRevealed;
      renderReadOnly();
    });
    const playlistLink = document.getElementById('playlist-link');
    if (playlistLink) playlistLink.addEventListener('click', (e) => e.stopPropagation());
    const editBtn = document.getElementById('edit-btn');
    if (editBtn) editBtn.addEventListener('click', (e) => { e.stopPropagation(); enterEditMode(); });
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); onDelete(); });
  }

  async function onDelete() {
    try {
      await api.del(`/api/setlists/${setlist.id}`);
      if (onDeleted) onDeleted();
    } catch (err) {
      showError(err.message);
    }
  }

  function metaFormTemplate() {
    return `
      <div class="panel">
        <h3>${setlist ? 'Détails du concert' : 'Créer le prochain concert'}</h3>
        <form id="meta-form" class="inline-form">
          <label>Nom <input name="name" value="${escapeHtml(setlist?.name || '')}"></label>
          <label>Lieu <input name="venue" value="${escapeHtml(setlist?.venue || '')}"></label>
          <label>Date <input type="date" name="concertDate" value="${setlist ? setlist.concert_date.slice(0, 10) : ''}" required></label>
          <button type="submit">${setlist ? 'Enregistrer' : 'Créer le concert'}</button>
        </form>
      </div>
    `;
  }

  function usedSongIds() {
    return new Set([...mainRows, ...encoreRows].map((r) => r.songId));
  }

  function availableSongOptions() {
    const used = usedSongIds();
    const available = allSongs.filter((s) => !used.has(s.id));
    if (!available.length) return '<option value="">(tous les morceaux sont déjà dans la setlist)</option>';
    return available.map((s) => `<option value="${s.id}">${escapeHtml(s.title)} — ${escapeHtml(s.artist)}</option>`).join('');
  }

  function rowTemplate(row, index, section, total) {
    return `
      <div class="setlist-row" data-section="${section}" data-index="${index}">
        <div class="row-index">${index + 1}</div>
        <div class="row-main">
          <div class="row-title">${escapeHtml(row.title)}</div>
          <div class="row-artist">${escapeHtml(row.artist)}</div>
        </div>
        <input class="row-note-input" data-field="note" placeholder="Note (optionnel)" value="${escapeHtml(row.note || '')}">
        <div class="row-actions">
          <button type="button" class="secondary icon-btn move-up" ${index === 0 ? 'disabled' : ''} title="Monter">&#8593;</button>
          <button type="button" class="secondary icon-btn move-down" ${index === total - 1 ? 'disabled' : ''} title="Descendre">&#8595;</button>
          <button type="button" class="secondary icon-btn move-section" title="${section === 'main' ? 'Déplacer en rappel' : 'Déplacer au programme'}">${section === 'main' ? '&#8677; Rappel' : '&#8676; Programme'}</button>
          <button type="button" class="danger icon-btn remove-row" title="Retirer">&times;</button>
        </div>
      </div>
    `;
  }

  function editView() {
    return `
      ${metaFormTemplate()}
      ${setlist ? `
      <div class="panel">
        <h3>Ajouter un morceau du répertoire</h3>
        <form id="add-song-form" class="inline-form">
          <label>Morceau
            <select id="add-song-select">${availableSongOptions()}</select>
          </label>
          <button type="button" id="add-to-main-btn" class="secondary">Ajouter au programme</button>
          <button type="button" id="add-to-encore-btn" class="secondary">Ajouter au rappel</button>
        </form>
      </div>

      <div class="setlist-section">
        <h3>Programme principal</h3>
        <div class="setlist-rows" id="main-rows">
          ${mainRows.length ? mainRows.map((r, i) => rowTemplate(r, i, 'main', mainRows.length)).join('') : '<p class="empty">Aucun morceau. Ajoutez-en depuis le répertoire ci-dessus.</p>'}
        </div>
      </div>

      <div class="setlist-section">
        <h3>Rappel</h3>
        <div class="setlist-rows" id="encore-rows">
          ${encoreRows.length ? encoreRows.map((r, i) => rowTemplate(r, i, 'encore', encoreRows.length)).join('') : '<p class="empty">Aucun morceau de rappel prévu.</p>'}
        </div>
      </div>

      <div class="inline-form" style="margin-top:1.25rem">
        <button type="button" id="save-songs-btn">Enregistrer la setlist</button>
        <button type="button" id="cancel-edit-btn" class="secondary">Retour</button>
      </div>` : ''}
    `;
  }

  function enterEditMode() {
    actionsRevealed = false;
    mainRows = setlist.songs
      .filter((s) => !s.is_encore)
      .map((s) => ({ setlistSongId: s.id, songId: s.song_id, title: s.title, artist: s.artist, note: s.note }));
    encoreRows = setlist.songs
      .filter((s) => s.is_encore)
      .map((s) => ({ setlistSongId: s.id, songId: s.song_id, title: s.title, artist: s.artist, note: s.note }));
    renderEdit();
  }

  function renderEdit() {
    container().innerHTML = editView();
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
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        if (setlist) {
          setlist = await api.patch(`/api/setlists/${setlist.id}`, { name, venue, concertDate });
          setlist.songs = (await api.get(`/api/setlists/${setlist.id}`)).songs;
        } else {
          setlist = await createSetlist({ name, venue, concertDate });
          setlist.songs = setlist.songs || [];
        }
        enterEditMode();
      } catch (err) {
        showError(err.message);
        submitBtn.disabled = false;
      }
    });
  }

  function rowsForSection(section) {
    return section === 'main' ? mainRows : encoreRows;
  }

  function attachEditHandlers() {
    const addSelect = document.getElementById('add-song-select');
    const addToMain = document.getElementById('add-to-main-btn');
    const addToEncore = document.getElementById('add-to-encore-btn');
    if (addToMain) addToMain.addEventListener('click', () => addSongToSection('main', addSelect));
    if (addToEncore) addToEncore.addEventListener('click', () => addSongToSection('encore', addSelect));

    document.querySelectorAll('.setlist-row').forEach((rowEl) => {
      const section = rowEl.dataset.section;
      const index = parseInt(rowEl.dataset.index, 10);
      const rows = rowsForSection(section);

      rowEl.querySelector('.row-note-input').addEventListener('change', (e) => {
        rows[index].note = e.target.value;
      });
      rowEl.querySelector('.move-up')?.addEventListener('click', () => {
        if (index === 0) return;
        [rows[index - 1], rows[index]] = [rows[index], rows[index - 1]];
        renderEdit();
      });
      rowEl.querySelector('.move-down')?.addEventListener('click', () => {
        if (index === rows.length - 1) return;
        [rows[index + 1], rows[index]] = [rows[index], rows[index + 1]];
        renderEdit();
      });
      rowEl.querySelector('.move-section').addEventListener('click', () => {
        const [row] = rows.splice(index, 1);
        if (section === 'main') encoreRows.push(row);
        else mainRows.push(row);
        renderEdit();
      });
      rowEl.querySelector('.remove-row').addEventListener('click', () => {
        rows.splice(index, 1);
        renderEdit();
      });
    });

    const saveBtn = document.getElementById('save-songs-btn');
    if (saveBtn) saveBtn.addEventListener('click', onSaveSongs);
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', renderReadOnly);
  }

  function addSongToSection(section, selectEl) {
    const songId = selectEl.value ? parseInt(selectEl.value, 10) : null;
    if (!songId) return;
    const song = allSongs.find((s) => s.id === songId);
    if (!song) return;
    const row = { setlistSongId: null, songId: song.id, title: song.title, artist: song.artist, note: '' };
    if (section === 'main') mainRows.push(row);
    else encoreRows.push(row);
    renderEdit();
  }

  async function onSaveSongs() {
    try {
      const payload = [
        ...mainRows.map((r, i) => ({ songId: r.songId, position: i + 1, note: r.note, isEncore: false })),
        ...encoreRows.map((r, i) => ({ songId: r.songId, position: i + 1, note: r.note, isEncore: true })),
      ];
      setlist = await api.put(`/api/setlists/${setlist.id}/songs`, { songs: payload });
      renderReadOnly();
    } catch (err) {
      showError(err.message);
    }
  }

  return {
    async load() {
      try {
        setlist = await getSetlist();
        actionsRevealed = false;
        renderReadOnly();
      } catch (err) {
        showError(err.message);
      }
    },
  };
}
