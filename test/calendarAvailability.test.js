const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateSlots, isBusyDuring, widenWindow } = require('../src/lib/calendarAvailability');

test('generateSlots: default 4 weeks produces one slot per day for 28 days', () => {
  const slots = generateSlots();
  assert.equal(slots.length, 28);
});

test('generateSlots: caps weeks at 4 even if a larger value is requested', () => {
  const slots = generateSlots(10);
  assert.equal(slots.length, 28);
});

test('generateSlots: every slot has upper strictly after lower', () => {
  for (const slot of generateSlots()) {
    assert.ok(slot.upper > slot.lower, `${slot.lower.toISOString()} .. ${slot.upper.toISOString()}`);
  }
});

test('generateSlots: weekday slots span 18:30-21:00 and weekend slots span 15:00-19:00, Paris-local', () => {
  for (const slot of generateSlots()) {
    const dow = new Date(slot.lower).toLocaleDateString('en-US', { timeZone: 'Europe/Paris', weekday: 'short' });
    const startLocal = slot.lower.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
    const endLocal = slot.upper.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
    const isWeekend = dow === 'Sat' || dow === 'Sun';
    if (isWeekend) {
      assert.equal(startLocal, '15:00');
      assert.equal(endLocal, '19:00');
    } else {
      assert.equal(startLocal, '18:30');
      assert.equal(endLocal, '21:00');
    }
  }
});

test('isBusyDuring: true when a busy interval overlaps the slot', () => {
  const slotLower = new Date('2026-06-10T18:30:00Z');
  const slotUpper = new Date('2026-06-10T21:00:00Z');
  const intervals = [{ start: new Date('2026-06-10T19:00:00Z'), end: new Date('2026-06-10T20:00:00Z') }];
  assert.equal(isBusyDuring(intervals, slotLower, slotUpper), true);
});

test('isBusyDuring: false when no interval overlaps the slot', () => {
  const slotLower = new Date('2026-06-10T18:30:00Z');
  const slotUpper = new Date('2026-06-10T21:00:00Z');
  const intervals = [{ start: new Date('2026-06-10T10:00:00Z'), end: new Date('2026-06-10T11:00:00Z') }];
  assert.equal(isBusyDuring(intervals, slotLower, slotUpper), false);
});

test('isBusyDuring: false for an interval that ends exactly when the slot starts (half-open)', () => {
  const slotLower = new Date('2026-06-10T18:30:00Z');
  const slotUpper = new Date('2026-06-10T21:00:00Z');
  const intervals = [{ start: new Date('2026-06-10T17:00:00Z'), end: new Date('2026-06-10T18:30:00Z') }];
  assert.equal(isBusyDuring(intervals, slotLower, slotUpper), false);
});

test('isBusyDuring: true for an all-day-style interval spanning the whole day', () => {
  const slotLower = new Date('2026-06-10T18:30:00Z');
  const slotUpper = new Date('2026-06-10T21:00:00Z');
  const intervals = [{ start: new Date('2026-06-10T00:00:00Z'), end: new Date('2026-06-11T00:00:00Z') }];
  assert.equal(isBusyDuring(intervals, slotLower, slotUpper), true);
});

test('generateSlots: a custom slotConfig overrides the default hours', () => {
  const customConfig = {
    weekday: { startHour: 10, startMinute: 0, endHour: 11, endMinute: 30 },
    weekend: { startHour: 9, startMinute: 15, endHour: 10, endMinute: 0 },
  };
  for (const slot of generateSlots(3, customConfig)) {
    const dow = new Date(slot.lower).toLocaleDateString('en-US', { timeZone: 'Europe/Paris', weekday: 'short' });
    const startLocal = slot.lower.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
    const endLocal = slot.upper.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
    const isWeekend = dow === 'Sat' || dow === 'Sun';
    if (isWeekend) {
      assert.equal(startLocal, '09:15');
      assert.equal(endLocal, '10:00');
    } else {
      assert.equal(startLocal, '10:00');
      assert.equal(endLocal, '11:30');
    }
  }
});

test('widenWindow: expands lower/upper by the margin on each side', () => {
  const lower = new Date('2026-06-10T18:30:00Z');
  const upper = new Date('2026-06-10T21:00:00Z');
  const widened = widenWindow(lower, upper, 30);
  assert.equal(widened.lower.toISOString(), '2026-06-10T18:00:00.000Z');
  assert.equal(widened.upper.toISOString(), '2026-06-10T21:30:00.000Z');
});

test('widenWindow: zero or missing margin leaves the window unchanged', () => {
  const lower = new Date('2026-06-10T18:30:00Z');
  const upper = new Date('2026-06-10T21:00:00Z');
  assert.deepEqual(widenWindow(lower, upper, 0), { lower, upper });
  assert.deepEqual(widenWindow(lower, upper, undefined), { lower, upper });
});

test('widenWindow + isBusyDuring: an event just outside the raw slot but inside the margin marks it busy', () => {
  const lower = new Date('2026-06-10T19:00:00Z');
  const upper = new Date('2026-06-10T20:30:00Z');
  // Ends 15 minutes before the slot starts — doesn't overlap the raw slot.
  const intervals = [{ start: new Date('2026-06-10T18:30:00Z'), end: new Date('2026-06-10T18:45:00Z') }];
  assert.equal(isBusyDuring(intervals, lower, upper), false);
  const { lower: checkLower, upper: checkUpper } = widenWindow(lower, upper, 30);
  assert.equal(isBusyDuring(intervals, checkLower, checkUpper), true);
});

test('isBusyDuring: empty interval list is never busy', () => {
  const slotLower = new Date('2026-06-10T18:30:00Z');
  const slotUpper = new Date('2026-06-10T21:00:00Z');
  assert.equal(isBusyDuring([], slotLower, slotUpper), false);
});
