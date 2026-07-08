const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']);

function extractVideoId(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(parsed.hostname)) return null;

  if (parsed.hostname === 'youtu.be') {
    return parsed.pathname.slice(1) || null;
  }
  if (parsed.pathname === '/watch') {
    return parsed.searchParams.get('v');
  }
  if (parsed.pathname.startsWith('/embed/')) {
    return parsed.pathname.split('/embed/')[1] || null;
  }
  return null;
}

function isValidYoutubeUrl(url) {
  return extractVideoId(url) !== null;
}

module.exports = { extractVideoId, isValidYoutubeUrl };
