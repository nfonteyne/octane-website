(function () {
  try {
    var saved = localStorage.getItem('octane-theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (e) {
    /* localStorage unavailable (private mode etc.) — fall back to OS theme */
  }
})();
