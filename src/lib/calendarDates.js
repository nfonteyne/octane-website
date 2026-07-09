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

// Minutes Europe/Paris is ahead of UTC at the given instant (+60 in winter,
// +120 in summer) — derived by reading the instant's own Paris-local wall
// clock back out and diffing against its UTC wall clock, rather than hardcoding
// DST transition dates (which shift slightly year to year).
function parisOffsetMinutes(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
    .formatToParts(date)
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  const parisWallAsUTCMillis = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    parts.hour === '24' ? 0 : Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  return Math.round((parisWallAsUTCMillis - date.getTime()) / 60000);
}

// The reverse of slotDateParis/dayOfWeekParis: given Paris-local wall-clock
// components, returns the UTC instant they represent. DST-aware via a small
// fixed-point iteration (the offset itself depends on the instant, so a naive
// single guess can land a lookup on the wrong side of a transition).
function parisWallClockToUTC(year, month, day, hour, minute) {
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  for (let i = 0; i < 2; i++) {
    const offsetMinutes = parisOffsetMinutes(guess);
    const corrected = new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60000);
    if (corrected.getTime() === guess.getTime()) return corrected;
    guess = corrected;
  }
  return guess;
}

module.exports = { normalizeISO, slotDateParis, dayOfWeekParis, parisWallClockToUTC };
