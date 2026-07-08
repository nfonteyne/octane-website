const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeISO, slotDateParis, dayOfWeekParis } = require('../src/lib/calendarDates');

test('normalizeISO: collapses sub-minute noise to the same instant', () => {
  const a = normalizeISO('2026-06-10T18:30:12.345Z');
  const b = normalizeISO('2026-06-10T18:30:47.001Z');
  assert.equal(a.getTime(), b.getTime());
});

test('normalizeISO: zeroes seconds and milliseconds only, keeps minute/hour/day', () => {
  const d = normalizeISO('2026-06-10T18:30:47.001Z');
  assert.equal(d.getUTCSeconds(), 0);
  assert.equal(d.getUTCMilliseconds(), 0);
  assert.equal(d.getUTCMinutes(), 30);
  assert.equal(d.getUTCHours(), 18);
});

test('slotDateParis: late-evening UTC instant rolls onto the next Paris-local day (winter, UTC+1)', () => {
  assert.equal(slotDateParis('2026-01-15T23:30:00Z'), '2026-01-16');
});

test('slotDateParis: late-evening UTC instant rolls onto the next Paris-local day (summer, UTC+2)', () => {
  assert.equal(slotDateParis('2026-07-15T22:30:00Z'), '2026-07-16');
});

test('slotDateParis: spring-forward DST boundary (2026-03-29, CET->CEST at 01:00 UTC)', () => {
  // Just before the jump: still CET (UTC+1) -> 01:30 local.
  assert.equal(slotDateParis('2026-03-29T00:30:00Z'), '2026-03-29');
  // Just after the jump: already CEST (UTC+2) -> 03:30 local, same calendar day.
  assert.equal(slotDateParis('2026-03-29T01:30:00Z'), '2026-03-29');
});

test('slotDateParis: fall-back DST boundary (2026-10-25, CEST->CET at 01:00 UTC)', () => {
  // The 01:00-02:00 UTC hour occurs twice in local time (02:xx both times);
  // both instants should still resolve to the same calendar day.
  assert.equal(slotDateParis('2026-10-25T00:30:00Z'), '2026-10-25');
  assert.equal(slotDateParis('2026-10-25T01:30:00Z'), '2026-10-25');
});

test('dayOfWeekParis: maps Monday..Sunday to 1..7', () => {
  assert.equal(dayOfWeekParis('2026-01-16T00:30:00+01:00'), 5); // Friday
  assert.equal(dayOfWeekParis('2026-01-11T12:00:00Z'), 7); // Sunday, not 0
});

test('dayOfWeekParis: DST boundary days still resolve to Sunday (7)', () => {
  assert.equal(dayOfWeekParis('2026-03-29T00:30:00Z'), 7);
  assert.equal(dayOfWeekParis('2026-10-25T01:30:00Z'), 7);
});
