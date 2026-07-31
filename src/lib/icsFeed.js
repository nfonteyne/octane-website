const { computeRehearsalStatus } = require('./rehearsalStatus');

// Builds a text/calendar feed of rehearsals for subscription (webcal://) in
// external calendar apps. Timestamps are emitted in UTC (`...Z`) so no
// VTIMEZONE block is needed — every client renders them in its own zone.
function formatDateUTC(date) {
  return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// Per RFC 5545 §3.3.11: backslash-escape commas, semicolons and backslashes,
// and turn newlines into the literal `\n` escape sequence.
function escapeText(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// Per RFC 5545 §3.1: content lines longer than 75 octets must be folded —
// split across multiple physical lines joined by CRLF + a single leading
// space. Without this, some clients (observed with Google Calendar) silently
// drop the whole property instead of just displaying it unwrapped. The split
// is done on UTF-8 byte boundaries (not JS string length) so multi-byte
// characters (e.g. accented names) are never cut in half.
function foldLine(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;

  const chunks = [];
  let start = 0;
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    chunks.push(bytes.slice(start, end).toString('utf8'));
    start = end;
    limit = 74; // continuation lines reserve 1 octet for the leading space
  }
  return chunks.map((chunk, i) => (i === 0 ? chunk : ` ${chunk}`)).join('\r\n');
}

function rehearsalToEvent(rehearsal, { threshold, baseUrl, allUsers }) {
  const status = computeRehearsalStatus(rehearsal.votes, threshold);
  const icsStatus = status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE';
  const summary = status === 'confirmed' ? 'Répétition' : 'Répétition (proposition)';
  const voteUrl = `${baseUrl}/calendar.html?rehearsalId=${rehearsal.id}`;

  const accepted = rehearsal.votes.filter((v) => v.vote === 'accept').map((v) => v.name);
  const refused = rehearsal.votes.filter((v) => v.vote === 'reject').map((v) => v.name);
  const votedUserIds = new Set(rehearsal.votes.map((v) => v.userId));
  const pending = allUsers.filter((u) => !votedUserIds.has(u.id)).map((u) => u.name);

  const description = [
    `Votez ici : ${voteUrl}`,
    accepted.length ? `Ont accepté : ${accepted.join(', ')}` : "Personne n'a encore accepté.",
    refused.length ? `Ont refusé : ${refused.join(', ')}` : "Personne n'a refusé.",
    pending.length ? `En attente : ${pending.join(', ')}` : "Tout le monde a voté.",
  ].join('\n');

  const lines = [
    'BEGIN:VEVENT',
    `UID:rehearsal-${rehearsal.id}@octane`,
    `DTSTAMP:${formatDateUTC(rehearsal.created_at || new Date())}`,
    `DTSTART:${formatDateUTC(rehearsal.starts_at)}`,
    `DTEND:${formatDateUTC(rehearsal.ends_at)}`,
    `SUMMARY:${escapeText(summary)}`,
    `STATUS:${icsStatus}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${voteUrl}`,
  ];
  if (rehearsal.location) lines.push(`LOCATION:${escapeText(rehearsal.location)}`);
  lines.push('END:VEVENT');
  return lines;
}

function buildRehearsalsFeed(rehearsals, { threshold, baseUrl, allUsers }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Octane//Rehearsals//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Répétitions Octane',
    ...rehearsals.flatMap((r) => rehearsalToEvent(r, { threshold, baseUrl, allUsers })),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n');
}

module.exports = { buildRehearsalsFeed };
