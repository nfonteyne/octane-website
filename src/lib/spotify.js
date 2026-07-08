function isValidSpotifyUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'open.spotify.com';
  } catch {
    return false;
  }
}

module.exports = { isValidSpotifyUrl };
