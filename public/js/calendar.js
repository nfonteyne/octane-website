let state = {
  people: [],
  slots: [],
  personIds: [],
  rehearsals: [],
  upcomingConcerts: [],
  concertHours: { start: '19:00', end: '22:00' },
};
let me = null;
let currentModalDate = null;

async function loadPeople() {
  state.people = await api.get('/api/calendar/people');
  state.personIds = state.people.map((p) => p.id);
}

async function loadSlots() {
  state.slots = await api.get('/api/calendar/slots?weeks=3');
  renderCalendar();
}

async function loadRehearsals() {
  state.rehearsals = await api.get('/api/rehearsals');
  renderRehearsals();
  renderCalendar();
}

async function loadUpcomingConcerts() {
  state.upcomingConcerts = await api.get('/api/setlists/upcoming');
  renderCalendar();
}

async function loadConcertHours() {
  state.concertHours = await api.get('/api/calendar/concert-hours');
}

// concert_date has no time-of-day (a plain DATE column) — synthesize a
// start/end using the admin-configured default concert hours, assuming the
// browser's local timezone is close enough to Europe/Paris (same convention
// used elsewhere on this page for matching concert_date to grid cells).
function concertTimesFor(concertDateStr) {
  const d = new Date(concertDateStr);
  const [startHour, startMinute] = state.concertHours.start.split(':').map(Number);
  const [endHour, endMinute] = state.concertHours.end.split(':').map(Number);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), startHour, startMinute);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), endHour, endMinute);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function concertLinksHtml(concert) {
  const { startISO, endISO } = concertTimesFor(concert.concert_date);
  const linkArgs = { uid: `concert-${concert.id}`, title: concert.name || 'Concert Octane', startISO, endISO, location: concert.venue };
  return `
    <div class="modal-section">
      <div class="modal-section-title">Concert${concert.name ? ' : ' + escapeHtml(concert.name) : ''}</div>
      <p class="note" style="margin:0.25rem 0 0.5rem">${concert.venue ? escapeHtml(concert.venue) + ' · ' : ''}${formatTime(startISO)} – ${formatTime(endISO)}</p>
      <div class="rehearsal-actions">
        <a class="pill-link" href="${googleCalendarLink(linkArgs)}" target="_blank" rel="noopener">+ Google</a>
        <a class="pill-link" href="${outlookCalendarLink(linkArgs)}" target="_blank" rel="noopener">+ Outlook</a>
        <a class="pill-link" href="${icsDataUrl(linkArgs)}" download="concert.ics">+ Apple / autre</a>
      </div>
    </div>
  `;
}

async function loadLastChecked() {
  const { last_checked } = await api.get('/api/calendar/last-checked');
  const el = document.getElementById('last-checked');
  el.textContent = last_checked
    ? 'Dernière mise à jour : ' + formatDatetime(last_checked)
    : 'Aucune donnée pour le moment — cliquez sur Actualiser';
}

function isoDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function shortMonth(d) {
  return d.toLocaleDateString('fr-FR', { month: 'short' });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
}

function formatDatetime(iso) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedSet = new Set(state.personIds);

  const slotMap = new Map();
  for (const slot of state.slots) slotMap.set(slot.slot_date, slot);

  const rehearsalsByDate = new Map();
  for (const r of state.rehearsals) rehearsalsByDate.set(isoDate(new Date(r.startsAt)), r);

  const concertsByDate = new Map();
  for (const c of state.upcomingConcerts) concertsByDate.set(isoDate(new Date(c.concert_date)), c);

  // Grid starts on the Monday of the current week so columns align Mon->Sun.
  const start = new Date(today);
  const dow = start.getDay();
  start.setDate(start.getDate() + (dow === 0 ? -6 : 1 - dow));

  const daysBeforeToday = Math.round((today - start) / 86400000);
  const totalDays = Math.ceil((daysBeforeToday + 21) / 7) * 7;

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);

    const isPastDay = date < today;
    const isBeyond21 = i >= daysBeforeToday + 21;
    const isToday = date.getTime() === today.getTime();
    const slot = slotMap.get(isoDate(date));

    const cell = document.createElement('div');
    cell.className = 'cal-cell' + (isToday ? ' today' : '');

    if (isBeyond21) {
      cell.classList.add('empty');
      grid.appendChild(cell);
      continue;
    }

    const dateLabel = document.createElement('div');
    dateLabel.className = 'cell-date';
    dateLabel.innerHTML = `<span class="day-num">${date.getDate()}</span>${shortMonth(date)}`;
    cell.appendChild(dateLabel);

    const badges = document.createElement('div');
    badges.className = 'cell-badges';

    const rehearsal = rehearsalsByDate.get(isoDate(date));
    if (rehearsal) {
      cell.classList.add('has-rehearsal');
      const badge = document.createElement('span');
      badge.title = 'Répétition proposée';
      badge.textContent = '🎸';
      badges.appendChild(badge);
    }

    const concert = concertsByDate.get(isoDate(date));
    if (concert) {
      cell.classList.add('has-concert');
      const badge = document.createElement('span');
      badge.title = `Concert${concert.name ? ' : ' + concert.name : ''}${concert.venue ? ' (' + concert.venue + ')' : ''}`;
      badge.textContent = '🎤';
      badges.appendChild(badge);
    }

    if (badges.childElementCount) cell.appendChild(badges);

    if (isPastDay) {
      cell.classList.add('empty');
      const lbl = document.createElement('div');
      lbl.className = 'no-slot-label';
      lbl.textContent = 'passé';
      cell.appendChild(lbl);
    } else if (slot) {
      const visible = slot.people.filter((p) => selectedSet.has(p.id));
      const avail = visible.filter((p) => p.is_available);

      cell.classList.add('has-slot');
      if (visible.length > 0) {
        if (avail.length === visible.length) {
          cell.classList.add('all-available');
        } else {
          const unavailRatio = (visible.length - avail.length) / visible.length;
          if (unavailRatio <= 0.2) cell.classList.add('heat-1');
          else if (unavailRatio <= 0.4) cell.classList.add('heat-2');
          else if (unavailRatio <= 0.6) cell.classList.add('heat-3');
          else if (unavailRatio <= 0.8) cell.classList.add('heat-4');
          else cell.classList.add('heat-5');
        }
      }

      const timeEl = document.createElement('div');
      timeEl.className = 'cell-time';
      timeEl.textContent = formatTime(slot.lower) + '–' + formatTime(slot.upper);
      cell.appendChild(timeEl);

      const dotsEl = document.createElement('div');
      dotsEl.className = 'cell-dots';
      for (const person of visible) {
        const dot = document.createElement('div');
        dot.className = 'cell-dot' + (person.is_available ? '' : ' busy');
        dot.style.backgroundColor = person.color;
        dot.title = person.name + (person.is_available ? ' ✓' : ' ✗');
        dotsEl.appendChild(dot);
      }
      cell.appendChild(dotsEl);

      cell.addEventListener('click', () => openModal(date, slot, visible, concert));

      const countEl = document.createElement('div');
      countEl.className = 'cell-count';
      countEl.textContent = avail.length + '/' + visible.length;
      cell.appendChild(countEl);
    } else if (concert) {
      cell.addEventListener('click', () => openModal(date, null, [], concert));
    } else {
      cell.classList.add('empty');
      const lbl = document.createElement('div');
      lbl.className = 'no-slot-label';
      lbl.textContent = 'aucune donnée';
      cell.appendChild(lbl);
    }

    grid.appendChild(cell);
  }
}

function buildFilters() {
  const listEl = document.getElementById('people-list');
  listEl.innerHTML = '';
  for (const person of state.people) {
    const row = document.createElement('label');
    row.className = 'person-toggle';
    row.dataset.id = person.id;

    const dot = document.createElement('span');
    dot.className = 'person-dot';
    dot.style.backgroundColor = person.color;

    row.appendChild(dot);
    row.appendChild(document.createTextNode(person.name));

    row.addEventListener('click', () => {
      const id = person.id;
      if (state.personIds.includes(id)) {
        if (state.personIds.length === 1) return;
        state.personIds = state.personIds.filter((x) => x !== id);
        row.classList.add('excluded');
      } else {
        state.personIds.push(id);
        row.classList.remove('excluded');
      }
      renderCalendar();
    });

    listEl.appendChild(row);
  }

  buildLegend();
}

function resetRefreshButton(btn) {
  btn.disabled = false;
  btn.textContent = 'Actualiser les disponibilités';
}

function pollWorkflowStatus(btn, maxMs = 180000, intervalMs = 4000) {
  const started = Date.now();
  const timer = setInterval(async () => {
    if (Date.now() - started > maxMs) {
      clearInterval(timer);
      showToast('La synchronisation a expiré — aucun résultat après 3 minutes', true);
      resetRefreshButton(btn);
      return;
    }
    try {
      const data = await api.get('/api/calendar/workflow-status');
      if (data.status === 'success') {
        clearInterval(timer);
        showToast('Calendrier mis à jour !' + (data.message ? ' ' + data.message : ''), false, 10000);
        resetRefreshButton(btn);
        await loadSlots();
        await loadLastChecked();
      } else if (data.status === 'error') {
        clearInterval(timer);
        showToast('Erreur lors de la synchronisation : ' + (data.message || 'inconnue'), true);
        resetRefreshButton(btn);
      }
    } catch (err) {
      /* transient, keep polling */
    }
  }, intervalMs);
}

function openModal(date, slot, visible, concert) {
  const avail = visible.filter((p) => p.is_available);
  const busy = visible.filter((p) => !p.is_available);

  currentModalDate = { date, slot };
  const proposeBtn = document.getElementById('modal-propose-rehearsal-btn');
  const availabilitySection = document.getElementById('modal-availability-section');
  if (slot) {
    availabilitySection.style.display = '';
    proposeBtn.style.display = '';
    const alreadyProposed = state.rehearsals.some((r) => isoDate(new Date(r.startsAt)) === isoDate(date));
    proposeBtn.disabled = alreadyProposed;
    proposeBtn.textContent = alreadyProposed
      ? 'Déjà proposée pour cette date'
      : 'Proposer cette date pour la prochaine répétition';
    document.getElementById('modal-time').textContent = formatTime(slot.lower) + ' – ' + formatTime(slot.upper);
  } else {
    availabilitySection.style.display = 'none';
    proposeBtn.style.display = 'none';
  }

  document.getElementById('modal-date').textContent = date.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris',
  });

  const concertSection = document.getElementById('modal-concert-section');
  concertSection.innerHTML = concert ? concertLinksHtml(concert) : '';

  const renderPeople = (list, containerId) => {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    if (!list.length) {
      const em = document.createElement('div');
      em.className = 'modal-empty empty';
      em.textContent = 'Aucune';
      el.appendChild(em);
      return;
    }
    for (const person of list) {
      const row = document.createElement('div');
      row.className = 'modal-person';
      const dot = document.createElement('span');
      dot.className = 'person-dot';
      dot.style.backgroundColor = person.color;
      row.appendChild(dot);
      row.appendChild(document.createTextNode(person.name));
      el.appendChild(row);
    }
  };

  if (slot) {
    renderPeople(avail, 'modal-available');
    renderPeople(busy, 'modal-busy');
  }

  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function openFilters() {
  document.getElementById('filters-panel').classList.add('open');
  document.getElementById('filters-backdrop').classList.add('open');
}

function closeFilters() {
  document.getElementById('filters-panel').classList.remove('open');
  document.getElementById('filters-backdrop').classList.remove('open');
}

function buildLegend() {
  const el = document.getElementById('legend');
  el.innerHTML = '';
  for (const person of state.people) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const dot = document.createElement('span');
    dot.className = 'legend-dot';
    dot.style.backgroundColor = person.color;
    item.appendChild(dot);
    item.appendChild(document.createTextNode(person.name));
    el.appendChild(item);
  }
  const allItem = document.createElement('div');
  allItem.className = 'legend-item';
  allItem.innerHTML = '<span class="legend-dot legend-dot-all"></span> Tout le monde libre';
  el.appendChild(allItem);
}

function showToast(msg, isError = false, duration = 5000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden', 'error');
  if (isError) el.classList.add('error');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), duration);
}

function showError(message) {
  document.getElementById('error').innerHTML = `<div class="error-banner">${escapeHtml(message)}</div>`;
}

// ---------- Répétitions proposées ----------

function rehearsalVoteActionsHtml(r) {
  const myVote = me ? r.votes.find((v) => v.userId === me.id) : null;
  if (!myVote) {
    return `
      <button type="button" class="secondary accept-rehearsal-btn" data-rehearsal-id="${r.id}">✔ Accepter</button>
      <button type="button" class="secondary reject-rehearsal-btn" data-rehearsal-id="${r.id}">✘ Refuser</button>
    `;
  }
  const label = myVote.vote === 'accept' ? '✔ Vous avez accepté' : '✘ Vous avez refusé';
  return `
    <span class="vote-badge ${myVote.vote}">${label}</span>
    <button type="button" class="secondary undo-rehearsal-vote-btn" data-rehearsal-id="${r.id}">Annuler</button>
  `;
}

function rehearsalAcceptedByHtml(r) {
  const accepted = r.votes.filter((v) => v.vote === 'accept');
  if (!accepted.length) return '';
  return `
    <div class="rehearsal-accepted-by">
      ${accepted.map((v) => `${avatarHtml({ name: v.name, avatarUrl: v.avatarUrl }, 'avatar-sm')}<span>${escapeHtml(v.name)}</span>`).join('')}
    </div>
  `;
}

function rehearsalRowTemplate(r) {
  const title = 'Répétition Octane';
  const linkArgs = { uid: `rehearsal-${r.id}`, title, startISO: r.startsAt, endISO: r.endsAt, location: r.location };
  const canRemove = me && (me.id === r.proposedBy || me.isAdmin);
  return `
    <div class="rehearsal-row" data-rehearsal-id="${r.id}">
      <div>
        <div class="card-title">${formatDatetime(r.startsAt)} – ${formatTime(r.endsAt)}</div>
        <div class="card-subtitle">${r.location ? `${escapeHtml(r.location)} · ` : ''}Proposée par ${escapeHtml(r.proposedByName)}</div>
        ${rehearsalAcceptedByHtml(r)}
      </div>
      <div class="rehearsal-actions">
        ${rehearsalVoteActionsHtml(r)}
        <a class="pill-link" href="${googleCalendarLink(linkArgs)}" target="_blank" rel="noopener">+ Google</a>
        <a class="pill-link" href="${outlookCalendarLink(linkArgs)}" target="_blank" rel="noopener">+ Outlook</a>
        <a class="pill-link" href="${icsDataUrl(linkArgs)}" download="repetition.ics">+ Apple / autre</a>
        ${canRemove ? `<button type="button" class="danger icon-btn remove-rehearsal-btn" data-rehearsal-id="${r.id}">Retirer</button>` : ''}
      </div>
    </div>
  `;
}

function renderRehearsals() {
  const section = document.getElementById('rehearsals-section');
  const container = document.getElementById('rehearsals-list');
  if (!state.rehearsals.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  container.innerHTML = state.rehearsals.map(rehearsalRowTemplate).join('');
  container.querySelectorAll('.remove-rehearsal-btn').forEach((btn) => {
    btn.addEventListener('click', () => onRemoveRehearsal(parseInt(btn.dataset.rehearsalId, 10)));
  });
  container.querySelectorAll('.accept-rehearsal-btn').forEach((btn) => {
    btn.addEventListener('click', () => onVoteRehearsal(parseInt(btn.dataset.rehearsalId, 10), 'accept'));
  });
  container.querySelectorAll('.reject-rehearsal-btn').forEach((btn) => {
    btn.addEventListener('click', () => onVoteRehearsal(parseInt(btn.dataset.rehearsalId, 10), 'reject'));
  });
  container.querySelectorAll('.undo-rehearsal-vote-btn').forEach((btn) => {
    btn.addEventListener('click', () => onUndoRehearsalVote(parseInt(btn.dataset.rehearsalId, 10)));
  });
}

async function onProposeRehearsal() {
  if (!currentModalDate) return;
  const { slot } = currentModalDate;
  try {
    await api.post('/api/rehearsals', { startsAt: slot.lower, endsAt: slot.upper });
    closeModal();
    await loadRehearsals();
    showToast('Répétition proposée.');
  } catch (err) {
    showError(err.message);
  }
}

async function onRemoveRehearsal(id) {
  try {
    await api.del(`/api/rehearsals/${id}`);
    await loadRehearsals();
  } catch (err) {
    showError(err.message);
  }
}

async function onVoteRehearsal(id, vote) {
  try {
    await api.post(`/api/rehearsals/${id}/vote`, { vote });
    await loadRehearsals();
  } catch (err) {
    showError(err.message);
  }
}

async function onUndoRehearsalVote(id) {
  try {
    await api.del(`/api/rehearsals/${id}/vote`);
    await loadRehearsals();
  } catch (err) {
    showError(err.message);
  }
}

// ---------- Mes calendriers (self-service ICS feeds) ----------

let myFeeds = [];

// Shown for a registered feed instead of its full URL — consistent with the
// admin/profile calendar-management panels.
function maskIcsUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}/••••`;
  } catch {
    return '••••';
  }
}

function myFeedRowTemplate(feed) {
  return `
    <div class="feed-row" data-feed-id="${feed.id}">
      <span class="feed-label">${feed.label ? `${escapeHtml(feed.label)} — ` : ''}${escapeHtml(maskIcsUrl(feed.icsUrl))}</span>
      <button type="button" class="secondary icon-btn remove-my-feed-btn" data-feed-id="${feed.id}">Supprimer</button>
    </div>
  `;
}

async function loadMyFeeds() {
  myFeeds = await api.get('/api/calendar/my-feeds');
  renderMyFeedBanner();
}

function renderMyFeedBanner() {
  document.getElementById('my-feed-banner').style.display = myFeeds.length ? 'none' : '';
}

function renderMyCalendarsModal() {
  const container = document.getElementById('my-calendars-list');
  container.innerHTML = myFeeds.length
    ? myFeeds.map(myFeedRowTemplate).join('')
    : '<p class="empty">Aucun calendrier configuré.</p>';
  container.querySelectorAll('.remove-my-feed-btn').forEach((btn) => {
    btn.addEventListener('click', () => onRemoveMyFeed(parseInt(btn.dataset.feedId, 10)));
  });
}

function openMyCalendarsModal() {
  renderMyCalendarsModal();
  document.getElementById('my-calendars-modal-overlay').classList.remove('hidden');
}

function closeMyCalendarsModal() {
  document.getElementById('my-calendars-modal-overlay').classList.add('hidden');
}

async function onAddMyFeed(e) {
  e.preventDefault();
  const form = e.target;
  const label = form.label.value.trim();
  const icsUrl = form.icsUrl.value.trim();
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Vérification…';
  try {
    await api.post('/api/calendar/my-feeds', { label, icsUrl });
    form.reset();
    await loadMyFeeds();
    renderMyCalendarsModal();
    await loadPeople();
    buildFilters();
  } catch (err) {
    showError(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '+ Ajouter';
  }
}

async function onRemoveMyFeed(feedId) {
  try {
    await api.del(`/api/calendar/my-feeds/${feedId}`);
    await loadMyFeeds();
    renderMyCalendarsModal();
    await loadPeople();
    buildFilters();
  } catch (err) {
    showError(err.message);
  }
}

(async function init() {
  me = await initNav('calendar');

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('modal-propose-rehearsal-btn').addEventListener('click', onProposeRehearsal);
  document.getElementById('my-calendars-modal-close').addEventListener('click', closeMyCalendarsModal);
  document.getElementById('my-calendars-modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeMyCalendarsModal();
  });
  document.getElementById('my-calendars-add-form').addEventListener('submit', onAddMyFeed);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeFilters();
      closeMyCalendarsModal();
    }
  });

  document.getElementById('btn-filters-toggle').addEventListener('click', openFilters);
  document.getElementById('btn-filters-close').addEventListener('click', closeFilters);
  document.getElementById('filters-backdrop').addEventListener('click', closeFilters);
  document.getElementById('btn-my-calendars').addEventListener('click', openMyCalendarsModal);
  document.getElementById('btn-my-feed-banner-add').addEventListener('click', openMyCalendarsModal);

  document.getElementById('btn-refresh').addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh');
    btn.disabled = true;
    btn.textContent = 'Actualisation…';
    showToast('Synchronisation des calendriers…');
    try {
      await api.post('/api/calendar/refresh', {});
      showToast('Synchronisation en cours — en attente des résultats…');
      pollWorkflowStatus(btn);
    } catch (err) {
      const message = err.message === 'no_feeds_configured'
        ? "Aucun calendrier n'est configuré — voir la page Administration."
        : err.message;
      showToast(message, true);
      resetRefreshButton(btn);
    }
  });

  try {
    await loadPeople();
    buildFilters();
    await loadConcertHours();
    await loadRehearsals();
    await loadUpcomingConcerts();
    await loadSlots();
    await loadLastChecked();
    await loadMyFeeds();
  } catch (err) {
    showError(err.message);
  }
})();
