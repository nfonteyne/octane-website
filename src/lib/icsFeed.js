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

function rehearsalStatus(rehearsal) {
  const hasReject = rehearsal.votes.some((v) => v.vote === 'reject');
  const hasAccept = rehearsal.votes.some((v) => v.vote === 'accept');
  if (hasAccept && !hasReject) return 'CONFIRMED';
  return 'TENTATIVE';
}

function rehearsalToEvent(rehearsal) {
  const status = rehearsalStatus(rehearsal);
  const summary = status === 'CONFIRMED' ? 'Répétition' : 'Répétition (proposition)';
  const lines = [
    'BEGIN:VEVENT',
    `UID:rehearsal-${rehearsal.id}@octane`,
    `DTSTAMP:${formatDateUTC(rehearsal.created_at || new Date())}`,
    `DTSTART:${formatDateUTC(rehearsal.starts_at)}`,
    `DTEND:${formatDateUTC(rehearsal.ends_at)}`,
    `SUMMARY:${escapeText(summary)}`,
    `STATUS:${status}`,
  ];
  if (rehearsal.location) lines.push(`LOCATION:${escapeText(rehearsal.location)}`);
  lines.push('END:VEVENT');
  return lines;
}

function buildRehearsalsFeed(rehearsals) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Octane//Rehearsals//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Répétitions Octane',
    ...rehearsals.flatMap(rehearsalToEvent),
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

module.exports = { buildRehearsalsFeed };
