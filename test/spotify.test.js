const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isValidSpotifyUrl } = require('../src/lib/spotify');

test('isValidSpotifyUrl: true for open.spotify.com links', () => {
  assert.equal(isValidSpotifyUrl('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'), true);
});

test('isValidSpotifyUrl: false for other hosts', () => {
  assert.equal(isValidSpotifyUrl('https://www.youtube.com/watch?v=abc'), false);
  assert.equal(isValidSpotifyUrl('https://spotify.com/track/abc'), false);
});

test('isValidSpotifyUrl: false for malformed URL', () => {
  assert.equal(isValidSpotifyUrl('not a url'), false);
});
