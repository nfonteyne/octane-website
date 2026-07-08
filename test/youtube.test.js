const { test } = require('node:test');
const assert = require('node:assert/strict');
const { extractVideoId, isValidYoutubeUrl } = require('../src/lib/youtube');

test('extractVideoId: standard watch URL', () => {
  assert.equal(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('extractVideoId: watch URL with extra query params', () => {
  assert.equal(
    extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=abc'),
    'dQw4w9WgXcQ'
  );
});

test('extractVideoId: short youtu.be URL', () => {
  assert.equal(extractVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('extractVideoId: embed URL', () => {
  assert.equal(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('extractVideoId: non-YouTube host returns null', () => {
  assert.equal(extractVideoId('https://vimeo.com/12345'), null);
});

test('extractVideoId: malformed URL returns null', () => {
  assert.equal(extractVideoId('not a url'), null);
});

test('isValidYoutubeUrl: true for valid links, false otherwise', () => {
  assert.equal(isValidYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
  assert.equal(isValidYoutubeUrl('https://open.spotify.com/track/abc'), false);
  assert.equal(isValidYoutubeUrl(''), false);
});
