(async function init() {
  await initNav('history');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const container = document.getElementById('content');
  if (!id) {
    container.innerHTML = '<p class="empty">Concert introuvable.</p>';
    return;
  }

  const allSongs = await api.get('/api/songs');

  const editor = createSetlistEditor({
    allSongs,
    getSetlist: async () => {
      try {
        return await api.get(`/api/setlists/${id}`);
      } catch (err) {
        return null;
      }
    },
    emptyMessage: 'Concert introuvable.',
    allowDelete: true,
    onDeleted: () => {
      window.location.href = '/history.html';
    },
  });
  await editor.load();
})();
