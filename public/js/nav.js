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

const SUN_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
const MOON_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

function updateThemeToggleIcon() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.innerHTML = currentTheme() === 'dark' ? SUN_ICON : MOON_ICON;
}

async function initNav(activePage) {
  const me = await api.get('/api/users/me');
  const nav = document.getElementById('main-nav');
  nav.innerHTML = `
    <a class="brand" href="/index.html"><span class="brand-dot">&#9835;</span> Octane</a>
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
