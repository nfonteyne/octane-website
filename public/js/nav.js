async function initNav(activePage) {
  const me = await api.get('/api/users/me');
  const nav = document.getElementById('main-nav');
  nav.innerHTML = `
    <span class="brand"><span class="brand-dot">&#9835;</span> Octane</span>
    <button type="button" class="nav-toggle" id="nav-toggle" aria-label="Menu">&#9776;</button>
    <div class="nav-links" id="nav-links">
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

  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  toggle.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => links.classList.remove('open')));

  return me;
}
