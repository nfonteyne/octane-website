async function initNav(activePage) {
  const me = await api.get('/api/users/me');
  const nav = document.getElementById('main-nav');
  nav.innerHTML = `
    <div class="nav-links">
      <a href="/index.html" class="${activePage === 'repertoire' ? 'active' : ''}">Répertoire</a>
      <a href="/suggestions.html" class="${activePage === 'suggestions' ? 'active' : ''}">Suggestions</a>
      <a href="/setlist.html" class="${activePage === 'setlist' ? 'active' : ''}">Prochain concert</a>
      <a href="/history.html" class="${activePage === 'history' ? 'active' : ''}">Historique</a>
    </div>
    <div class="nav-user">
      <span>${escapeHtml(me.name)}${me.isAdmin ? ' <span class="badge">admin</span>' : ''}</span>
      <a href="/auth/logout">Se déconnecter</a>
    </div>
  `;
  return me;
}
