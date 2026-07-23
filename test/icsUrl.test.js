const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeIcsUrl } = require('../src/lib/icsUrl');

test('normalizeIcsUrl: rewrites webcal:// to https://', () => {
  assert.equal(normalizeIcsUrl('webcal://p01-caldav.icloud.com/foo.ics'), 'https://p01-caldav.icloud.com/foo.ics');
});

test('normalizeIcsUrl: rewrites webcals:// to https://', () => {
  assert.equal(normalizeIcsUrl('webcals://p01-caldav.icloud.com/foo.ics'), 'https://p01-caldav.icloud.com/foo.ics');
});

test('normalizeIcsUrl: is case-insensitive on the scheme', () => {
  assert.equal(normalizeIcsUrl('WebCal://example.com/foo.ics'), 'https://example.com/foo.ics');
});

test('normalizeIcsUrl: leaves http/https URLs untouched', () => {
  assert.equal(normalizeIcsUrl('https://example.com/foo.ics'), 'https://example.com/foo.ics');
  assert.equal(normalizeIcsUrl('http://example.com/foo.ics'), 'http://example.com/foo.ics');
});
