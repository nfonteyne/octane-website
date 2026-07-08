(async function init() {
  await initNav('setlist');
  const allSongs = await api.get('/api/songs');

  const editor = createSetlistEditor({
    allSongs,
    getSetlist: () => api.get('/api/setlists/next'),
    createSetlist: (data) => api.post('/api/setlists', data),
    emptyMessage: 'Aucun concert à venir pour le moment.',
  });
  await editor.load();
})();
