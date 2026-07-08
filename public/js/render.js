function renderList(container, items, templateFn, emptyMessage) {
  if (!items.length) {
    container.innerHTML = `<p class="empty">${escapeHtml(emptyMessage || 'Rien à afficher pour le moment.')}</p>`;
    return;
  }
  container.innerHTML = items.map(templateFn).join('');
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function youtubeVideoId(url) {
  try {
    const parsed = new URL(url);
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
  } catch {
    return null;
  }
}

function youtubeEmbedUrl(url) {
  const videoId = youtubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

function youtubeThumbnailUrl(url) {
  const videoId = youtubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
}
