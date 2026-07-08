function currentTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('octane-theme', theme);
  updateThemeToggleIcon();
}

function updateThemeToggleIcon() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.textContent = currentTheme() === 'dark' ? '☀️' : '🌙';
}

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
      <button type="button" class="icon-btn secondary" id="theme-toggle" title="Changer de thème" aria-label="Changer de thème"></button>
      <a class="nav-profile-link" href="/profile.html">
        ${avatarHtml(me, 'avatar-sm')}
        <span>${escapeHtml(me.name)}${me.isAdmin ? ' <span class="badge">admin</span>' : ''}</span>
      </a>
      <a href="/auth/logout">Se déconnecter</a>
    </div>
  `;

  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  toggle.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => links.classList.remove('open')));

  updateThemeToggleIcon();
  document.getElementById('theme-toggle').addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  return me;
}
