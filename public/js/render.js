function renderList(container, items, templateFn, emptyMessage) {
  if (!items.length) {
    container.innerHTML = `<p class="empty">${escapeHtml(emptyMessage || 'Rien à afficher pour le moment.')}</p>`;
    return;
  }
  container.innerHTML = items.map(templateFn).join('');
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function youtubeVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1) || null;
    }
    if (parsed.pathname === '/watch') {
      return parsed.searchParams.get('v');
    }
    if (parsed.pathname.startsWith('/embed/')) {
      return parsed.pathname.split('/embed/')[1] || null;
    }
    return null;
  } catch {
    return null;
  }
}

function youtubeEmbedUrl(url) {
  const videoId = youtubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

function youtubeThumbnailUrl(url) {
  const videoId = youtubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
}

// Builds a link that opens several videos back-to-back in YouTube's
// temporary "mix" player — no API call, no auth, just the video IDs we
// already have from each song's youtube_url. Returns null if none of the
// given URLs have a recognizable YouTube video ID.
function youtubePlaylistUrl(urls) {
  const ids = urls.map(youtubeVideoId).filter(Boolean);
  return ids.length ? `https://www.youtube.com/watch_videos?video_ids=${ids.join(',')}` : null;
}

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';
}

function avatarHtml(user, extraClass) {
  const cls = `avatar${extraClass ? ` ${extraClass}` : ''}`;
  if (user.avatarUrl) {
    return `<img class="${cls}" src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(user.name)}" loading="lazy">`;
  }
  return `<span class="${cls} avatar-initials">${escapeHtml(initials(user.name))}</span>`;
}

// ---------- "Add to my calendar" links (rehearsals, concerts) ----------

// Google's "render" template link — well-documented, stable format. Opens
// directly in the browser with the event pre-filled.
function googleCalendarLink({ title, startISO, endISO, location }) {
  const fmt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(startISO)}/${fmt(endISO)}`,
  });
  if (location) params.set('location', location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Outlook's compose deep-link — same idea, direct web link, no download.
function outlookCalendarLink({ title, startISO, endISO, location }) {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: title,
    startdt: startISO,
    enddt: endISO,
  });
  if (location) params.set('location', location);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// Apple has no equivalent public compose-URL — build a real .ics file
// client-side instead and expose it as a data: link. Works as a universal
// fallback too (Android, desktop imports, etc.), not just Apple.
function icsDataUrl({ uid, title, startISO, endISO, location }) {
  const fmt = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const escapeIcs = (s) => String(s || '').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Octane//Event//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid || Date.now()}@octane`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(startISO)}`,
    `DTEND:${fmt(endISO)}`,
    `SUMMARY:${escapeIcs(title)}`,
  ];
  if (location) lines.push(`LOCATION:${escapeIcs(location)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
}
