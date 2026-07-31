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

function rehearsalToEvent(rehearsal, { threshold, baseUrl }) {
  const status = computeRehearsalStatus(rehearsal.votes, threshold);
  const icsStatus = status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE';
  const summary = status === 'confirmed' ? 'Répétition' : 'Répétition (proposition)';
  const voteUrl = `${baseUrl}/calendar.html?rehearsalId=${rehearsal.id}`;
  const accepted = rehearsal.votes.filter((v) => v.vote === 'accept').map((v) => v.name);
  const description = [
    `Votez ici : ${voteUrl}`,
    accepted.length ? `Ont accepté : ${accepted.join(', ')}` : "Personne n'a encore accepté.",
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

function buildRehearsalsFeed(rehearsals, { threshold, baseUrl }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Octane//Rehearsals//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Répétitions Octane',
    ...rehearsals.flatMap((r) => rehearsalToEvent(r, { threshold, baseUrl })),
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

module.exports = { buildRehearsalsFeed };
