const { parisWallClockToUTC } = require('./calendarDates');

// Default rehearsal-availability windows, Europe/Paris local time — used
// whenever no admin-configured slotConfig is passed in (and by the pure-logic
// tests below, so those keep testing this exact default without needing to
// know about the DB-backed override path in calendarRepo/calendarSync).
const DEFAULT_SLOT_CONFIG = {
  weekday: { startHour: 18, startMinute: 30, endHour: 21, endMinute: 0 },
  weekend: { startHour: 15, startMinute: 0, endHour: 19, endMinute: 0 },
};
const MAX_WEEKS = 4;

// One slot per day for the next `weeks` weeks (capped at 4, same as the rest
// of the calendar feature), starting from today's Paris-local calendar date
// — not the server's own timezone, which may not be Europe/Paris.
function generateSlots(weeks = MAX_WEEKS, slotConfig = DEFAULT_SLOT_CONFIG) {
  const days = Math.min(weeks || MAX_WEEKS, MAX_WEEKS) * 7;
  const parisToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
  const [ty, tm, td] = parisToday.split('-').map(Number);
  const anchor = Date.UTC(ty, tm - 1, td);

  const slots = [];
  for (let i = 0; i < days; i++) {
    // This is only ever used to walk calendar dates one day at a time, never
    // treated as a real instant — the actual Paris-local conversion happens
    // below via parisWallClockToUTC, so there's no timezone ambiguity here.
    const dayAnchor = new Date(anchor + i * 86400000);
    const year = dayAnchor.getUTCFullYear();
    const month = dayAnchor.getUTCMonth() + 1;
    const day = dayAnchor.getUTCDate();
    const isWeekend = dayAnchor.getUTCDay() === 0 || dayAnchor.getUTCDay() === 6;
    const spec = isWeekend ? slotConfig.weekend : slotConfig.weekday;

    slots.push({
      lower: parisWallClockToUTC(year, month, day, spec.startHour, spec.startMinute),
      upper: parisWallClockToUTC(year, month, day, spec.endHour, spec.endMinute),
    });
  }
  return slots;
}

// intervals: [{start: Date, end: Date}] — flat, already-expanded busy blocks
// (recurring events expanded, all-day events resolved to a concrete local-day
// span) so this stays a plain half-open-interval overlap check.
function isBusyDuring(intervals, slotLower, slotUpper) {
  return intervals.some((interval) => interval.start < slotUpper && interval.end > slotLower);
}

// Widens a slot by `marginMinutes` on each side — used only for the busy/free
// check (to account for travel time between back-to-back calendar events),
// never for the slot that actually gets stored/displayed.
function widenWindow(lower, upper, marginMinutes) {
  const marginMs = (marginMinutes || 0) * 60000;
  return { lower: new Date(lower.getTime() - marginMs), upper: new Date(upper.getTime() + marginMs) };
}

module.exports = { generateSlots, isBusyDuring, widenWindow, DEFAULT_SLOT_CONFIG };
