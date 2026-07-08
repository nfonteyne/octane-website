const config = require('../config');

let spotifyToken = null; // { accessToken, expiresAt }

async function searchCandidates(query) {
  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', query);
  url.searchParams.set('entity', 'song');
  url.searchParams.set('limit', '8');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`);
  const data = await res.json();

  return (data.results || []).map((r) => ({
    title: r.trackName,
    artist: r.artistName,
    artworkUrl: r.artworkUrl100 || r.artworkUrl60 || null,
  }));
}

async function getSpotifyToken() {
  if (spotifyToken && spotifyToken.expiresAt > Date.now()) {
    return spotifyToken.accessToken;
  }
  const basic = Buffer.from(`${config.spotifyClientId}:${config.spotifyClientSecret}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Spotify token request failed: ${res.status}`);
  const data = await res.json();
  spotifyToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return spotifyToken.accessToken;
}

async function findSpotifyUrl(title, artist) {
  if (!config.spotifyClientId || !config.spotifyClientSecret) return null;
  try {
    const token = await getSpotifyToken();
    const url = new URL('https://api.spotify.com/v1/search');
    url.searchParams.set('q', `track:${title} artist:${artist}`);
    url.searchParams.set('type', 'track');
    url.searchParams.set('limit', '1');

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`);
    const data = await res.json();
    const track = data.tracks?.items?.[0];
    return track?.external_urls?.spotify || null;
  } catch (err) {
    console.warn('[musicSearch] Spotify lookup failed:', err.message);
    return null;
  }
}

async function findYoutubeUrl(title, artist) {
  if (!config.youtubeApiKey) return null;
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', `${title} ${artist}`);
    url.searchParams.set('type', 'video');
    url.searchParams.set('maxResults', '1');
    url.searchParams.set('key', config.youtubeApiKey);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube search failed: ${res.status}`);
    const data = await res.json();
    const videoId = data.items?.[0]?.id?.videoId;
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
  } catch (err) {
    console.warn('[musicSearch] YouTube lookup failed:', err.message);
    return null;
  }
}

async function findLinks(title, artist) {
  const [spotifyUrl, youtubeUrl] = await Promise.all([
    findSpotifyUrl(title, artist),
    findYoutubeUrl(title, artist),
  ]);
  return { spotifyUrl, youtubeUrl };
}

module.exports = { searchCandidates, findLinks };
