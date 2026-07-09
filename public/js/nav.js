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
    <div class="nav-menu" id="nav-menu">
      <div class="nav-links" id="nav-links">
        <a href="/index.html" class="${activePage === 'repertoire' ? 'active' : ''}">Répertoire</a>
        <a href="/suggestions.html" class="${activePage === 'suggestions' ? 'active' : ''}">Suggestions</a>
        <a href="/setlist.html" class="${activePage === 'setlist' ? 'active' : ''}">Prochain concert</a>
        <a href="/calendar.html" class="${activePage === 'calendar' ? 'active' : ''}">Disponibilités</a>
        <a href="/history.html" class="${activePage === 'history' ? 'active' : ''}">Historique</a>
        ${me.isAdmin ? `<a href="/admin.html" class="${activePage === 'admin' ? 'active' : ''}">Administration</a>` : ''}
      </div>
      <div class="nav-user">
        <div class="nav-profile" id="nav-profile">
          <button type="button" class="nav-profile-trigger" id="nav-profile-trigger" aria-haspopup="true" aria-expanded="false">
            ${avatarHtml(me, 'avatar-sm')}
            <span>${escapeHtml(me.name)}${me.isAdmin ? ' <span class="badge">admin</span>' : ''}</span>
          </button>
          <div class="nav-profile-dropdown" id="nav-profile-dropdown">
            <a href="/profile.html">Voir profil</a>
            <a href="/auth/logout">Se déconnecter</a>
          </div>
        </div>
      </div>
    </div>
    <div class="nav-controls">
      <button type="button" class="icon-btn secondary" id="theme-toggle" title="Changer de thème" aria-label="Changer de thème"></button>
      <button type="button" class="nav-toggle" id="nav-toggle" aria-label="Menu">&#9776;</button>
    </div>
  `;

  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');
  toggle.addEventListener('click', () => menu.classList.toggle('open'));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => menu.classList.remove('open')));

  const profileTrigger = document.getElementById('nav-profile-trigger');
  const profileDropdown = document.getElementById('nav-profile-dropdown');
  function closeProfileDropdown() {
    profileDropdown.classList.remove('open');
    profileTrigger.setAttribute('aria-expanded', 'false');
  }
  profileTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = profileDropdown.classList.toggle('open');
    profileTrigger.setAttribute('aria-expanded', String(isOpen));
  });
  document.addEventListener('click', (e) => {
    if (!document.getElementById('nav-profile').contains(e.target)) closeProfileDropdown();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProfileDropdown();
  });

  updateThemeToggleIcon();
  document.getElementById('theme-toggle').addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });

  return me;
}
