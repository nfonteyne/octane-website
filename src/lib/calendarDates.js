// Truncates to minute precision so repeated ingests of "the same" slot land
// on the same instant even though n8n's timestamps carry sub-minute noise
// that differs run to run (the DB's UNIQUE(lower, upper) constraint depends
// on this). Returns a Date (not a string) — pg accepts Date directly for a
// timestamptz column.
function normalizeISO(iso) {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  return d;
}

// Calendar date (YYYY-MM-DD) of the given instant in Europe/Paris, so e.g. a
// 18:30 CEST slot stays on the correct local day regardless of what UTC day
// it falls on.
function slotDateParis(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

const WEEKDAY_TO_NUMBER = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

// Monday=1..Sunday=7, from the Europe/Paris-local weekday name. Falls back
// to the instant's own (UTC) getDay() if the locale parsing ever fails.
function dayOfWeekParis(iso) {
  const date = new Date(iso);
  const short = date.toLocaleDateString('en-US', { timeZone: 'Europe/Paris', weekday: 'short' }).slice(0, 3);
  const dow = WEEKDAY_TO_NUMBER[short];
  return dow === undefined ? date.getDay() || 7 : dow;
}

module.exports = { normalizeISO, slotDateParis, dayOfWeekParis };
