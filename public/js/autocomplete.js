function createTitleAutocomplete({ inputId, dropdownId, onSelect }) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  let candidates = [];
  let highlight = -1;
  let timer = null;

  function itemTemplate(c, index) {
    const img = c.artworkUrl
      ? `<img src="${escapeHtml(c.artworkUrl)}" alt="">`
      : `<span class="autocomplete-thumb-placeholder">&#9835;</span>`;
    return `
      <div class="autocomplete-item${index === highlight ? ' active' : ''}" data-index="${index}">
        ${img}
        <div>
          <div>${escapeHtml(c.title)}</div>
          <div class="card-subtitle">${escapeHtml(c.artist)}</div>
        </div>
      </div>
    `;
  }

  function render() {
    if (!candidates.length) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }
    dropdown.innerHTML = candidates.map(itemTemplate).join('');
    dropdown.style.display = 'block';
    dropdown.querySelectorAll('.autocomplete-item').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        select(candidates[parseInt(el.dataset.index, 10)]);
      });
    });
  }

  function close() {
    candidates = [];
    highlight = -1;
    render();
  }

  function select(candidate) {
    close();
    onSelect(candidate);
  }

  input.addEventListener('input', () => {
    const query = input.value.trim();
    clearTimeout(timer);
    if (query.length < 2) {
      close();
      return;
    }
    timer = setTimeout(async () => {
      try {
        candidates = await api.get(`/api/music-search?q=${encodeURIComponent(query)}`);
        highlight = -1;
        render();
      } catch (err) {
        close();
      }
    }, 300);
  });

  input.addEventListener('keydown', (e) => {
    if (!candidates.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlight = Math.min(highlight + 1, candidates.length - 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlight = Math.max(highlight - 1, 0);
      render();
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault();
      select(candidates[highlight]);
    } else if (e.key === 'Escape') {
      close();
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(close, 150);
  });

  return { close };
}
