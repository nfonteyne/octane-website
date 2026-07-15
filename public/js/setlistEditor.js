// Minimal line-art icons (same style as the theme-toggle icons in nav.js) —
// reused by concerts.js too, both loaded on the same page.
const CONCERT_EDIT_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>';
const CONCERT_DELETE_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>';

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
  showAddToCalendar = false,
  concertHours = { start: '19:00', end: '22:00' },
}) {
  let setlist = null;
  let mainRows = [];
  let encoreRows = [];

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

  // concert_date has no time-of-day (plain DATE column) — synthesize a
  // start/end from the admin-configured default concert hours, assuming the
  // browser's local timezone is close enough to Europe/Paris (same
  // convention used on calendar.js for matching concert_date to grid cells).
  function addToCalendarHtml() {
    const d = new Date(setlist.concert_date);
    const [startHour, startMinute] = concertHours.start.split(':').map(Number);
    const [endHour, endMinute] = concertHours.end.split(':').map(Number);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startHour, startMinute);
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), endHour, endMinute);
    const linkArgs = {
      uid: `concert-${setlist.id}`,
      title: setlist.name || 'Concert Octane',
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      location: setlist.venue,
    };
    return `
      <div class="rehearsal-actions" style="margin-top:0.5rem">
        ${calendarLinksMenuHtml(linkArgs, 'concert.ics')}
      </div>
    `;
  }

  function readOnlyView() {
    const main = setlist.songs.filter((s) => !s.is_encore);
    const encore = setlist.songs.filter((s) => s.is_encore);
    const rowHtml = (s) => `<li><span class="row-title">${escapeHtml(s.title)}</span> <span class="row-artist">— ${escapeHtml(s.artist)}</span>${s.note ? `<span class="note">${escapeHtml(s.note)}</span>` : ''}</li>`;
    const playlistUrl = youtubePlaylistUrl([...main, ...encore].map((s) => s.youtube_url).filter(Boolean));
    return `
      <div class="card concert-detail-card">
        <div>
          <div class="card-title">${escapeHtml(setlist.name || 'Concert')}</div>
          <div class="card-subtitle">${escapeHtml(setlist.venue || '')} · ${formatDate(setlist.concert_date)}</div>
          ${playlistUrl ? `<div class="song-links"><a class="pill-link youtube" href="${playlistUrl}" target="_blank" rel="noopener">&#9658; Écouter la setlist sur YouTube</a></div>` : ''}
          ${showAddToCalendar ? addToCalendarHtml() : ''}
        </div>
        <div class="concert-row-actions">
          <button id="edit-btn" type="button" class="secondary icon-btn" title="Modifier">${CONCERT_EDIT_ICON}<span class="btn-label"> Modifier</span></button>
          ${allowDelete ? `<button id="delete-btn" type="button" class="danger icon-btn" title="Supprimer">${CONCERT_DELETE_ICON}<span class="btn-label"> Supprimer</span></button>` : ''}
        </div>
      </div>
      <div class="setlist-section">
        <h3>Setlist</h3>
        ${main.length ? `<ol class="setlist">${main.map(rowHtml).join('')}</ol>` : '<p class="empty">Aucun morceau pour le moment.</p>'}
      </div>
      <div class="setlist-section">
        <h3>Rappel</h3>
        ${encore.length ? `<ol class="setlist">${encore.map(rowHtml).join('')}</ol>` : '<p class="empty">Aucun morceau de rappel prévu.</p>'}
      </div>
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
    document.getElementById('edit-btn').addEventListener('click', enterEditMode);
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', onDelete);
  }

  async function onDelete() {
    if (!confirm('Supprimer ce concert ? Cette action est irréversible.')) return;
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
        renderReadOnly();
      } catch (err) {
        showError(err.message);
      }
    },
  };
}
