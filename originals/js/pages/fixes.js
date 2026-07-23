const PageFixes = (() => {
  let _fixes = [];
  let _filtered = [];
  let _query = '';
  let _page = 0;
  const PER_PAGE = 48;

  async function init() {
    _bindActions();
    await _load();
  }

  async function _load() {
    const grid = document.getElementById('fixes-grid');
    if (grid) grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:60px 24px"><div class="spinner spinner--lg"></div><p style="margin-top:8px;font-size:.85rem;color:var(--text-3)">Loading fixes…</p></div>';

    try {
      const res = await API.getFixes();
      _fixes = (res.fixes || []).map(f => ({
        ...f,
        nameClean: f.name.replace(/^\[.*?\]\s*/, '').replace(/\s*по сети\s*$/, ''),
      }));
      _page = 0;
      _applyFilter();
    } catch (err) {
      if (grid) grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:60px 24px"><p>Failed to load fixes: ' + escapeHtml(err.message) + '</p></div>';
    }
  }

  function _applyFilter() {
    const q = _query.toLowerCase();
    _filtered = q
      ? _fixes.filter(f => f.nameClean.toLowerCase().includes(q) || f.name.toLowerCase().includes(q))
      : _fixes;
    _page = 0;
    _render();
  }

  function _render() {
    const grid = document.getElementById('fixes-grid');
    if (!grid) return;

    if (_filtered.length === 0) {
      const msg = document.getElementById('fixes-count');
      if (msg) msg.textContent = '';
      const existing = document.getElementById('fixes-pagination');
      if (existing) existing.remove();
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:60px 24px"><p style="max-width:none">' + (_query ? 'No fixes match your search.' : 'No fixes available.') + '</p></div>';
      return;
    }

    const count = document.getElementById('fixes-count');
    if (count) count.textContent = _filtered.length + ' fix' + (_filtered.length !== 1 ? 'es' : '');

    const start = _page * PER_PAGE;
    const end = start + PER_PAGE;
    const slice = _filtered.slice(start, end);

    let html = '';
    for (let i = 0; i < slice.length; i++) {
      const f = slice[i];
      const appid = f.appid || '';
      const steamImg = appid ? getImageUrl(appid) : '';
      const delay = Math.min(i * 0.03, 0.18).toFixed(2);
      const initials = f.appid ? '' : ((f.nameClean.match(/\b\w/g) || []).slice(0,2).join('').toUpperCase() || '?');

      html += '<div class="game-card game-card--img" data-url="' + escapeHtml(f.url) + '" data-name="' + escapeHtml(f.name) + '" style="animation-delay:' + delay + 's">';
      html += '<div class="game-card-img-wrap">';
      if (appid) {
        html += '<img class="game-card-img" src="' + steamImg + '" data-appid="' + appid + '" data-name="' + escapeHtml(f.nameClean) + '" alt="' + escapeHtml(f.nameClean) + '" loading="lazy" onerror="_steamImgError(this)">';
      } else {
        html += '<div class="game-card-icon game-card-img-placeholder" data-name="' + escapeHtml(f.nameClean) + '">' + initials + '</div>';
      }
      html += '</div>';
      html += '<div class="game-card-body">';
      html += '<div class="game-card-name" title="' + escapeHtml(f.nameClean) + '">' + escapeHtml(f.nameClean) + '</div>';
      html += '<div class="game-card-id" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">';
      html += appid ? 'AppID: ' + appid : '\u2014';
      html += '<span style="font-size:0.7rem;color:var(--text-3)">' + escapeHtml(f.size || '') + '</span>';
      html += '</div></div>';
      html += '<div class="game-card-actions"><div style="display:flex;gap:6px;width:100%">';
      html += '<button class="btn btn-primary btn-sm fix-install-btn" style="flex:1">';
      html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
      html += ' Install Fix</button></div></div></div>';
    }
    grid.innerHTML = html;

    grid.querySelectorAll('.fix-install-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var card = btn.closest('.game-card');
        _installFix(card.dataset.url, card.dataset.name, btn);
      });
    });

    _renderPagination();
  }

  function _renderPagination() {
    var total = _filtered.length;
    var pages = Math.ceil(total / PER_PAGE);
    if (pages <= 1) {
      var ex = document.getElementById('fixes-pagination');
      if (ex) ex.remove();
      return;
    }

    var container = document.getElementById('fixes-pagination');
    if (!container) {
      container = document.createElement('div');
      container.id = 'fixes-pagination';
      container.className = 'pagination';
      var grid = document.getElementById('fixes-grid');
      if (grid && grid.parentNode) grid.parentNode.insertBefore(container, grid.nextSibling);
    }

    container.innerHTML = '';

    var prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn' + (_page === 0 ? ' disabled' : '');
    prevBtn.textContent = '\u2039 Prev';
    prevBtn.addEventListener('click', function() { if (_page > 0) { _page--; _render(); window.scrollTo(0, 0); } });
    container.appendChild(prevBtn);

    var maxVisible = 7;
    var ps = Math.max(0, _page - Math.floor(maxVisible / 2));
    var pe = Math.min(pages, ps + maxVisible);
    if (pe - ps < maxVisible) ps = Math.max(0, pe - maxVisible);

    if (ps > 0) {
      var first = document.createElement('button');
      first.className = 'page-btn';
      first.textContent = '1';
      first.addEventListener('click', function() { _page = 0; _render(); scrollTo(0,0); });
      container.appendChild(first);
      if (ps > 1) {
        var dots1 = document.createElement('span');
        dots1.className = 'pagination-dots';
        dots1.textContent = '\u2026';
        container.appendChild(dots1);
      }
    }

    for (var p = ps; p < pe; p++) {
      var btn = document.createElement('button');
      btn.className = 'page-btn' + (p === _page ? ' active' : '');
      btn.textContent = String(p + 1);
      btn.addEventListener('click', (function(page) { return function() { _page = page; _render(); scrollTo(0,0); }; })(p));
      container.appendChild(btn);
    }

    if (pe < pages) {
      if (pe < pages - 1) {
        var dots2 = document.createElement('span');
        dots2.className = 'pagination-dots';
        dots2.textContent = '\u2026';
        container.appendChild(dots2);
      }
      var last = document.createElement('button');
      last.className = 'page-btn';
      last.textContent = String(pages);
      last.addEventListener('click', function() { _page = pages - 1; _render(); scrollTo(0,0); });
      container.appendChild(last);
    }

    var nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn' + (_page >= pages - 1 ? ' disabled' : '');
    nextBtn.textContent = 'Next \u203A';
    nextBtn.addEventListener('click', function() { if (_page < pages - 1) { _page++; _render(); scrollTo(0,0); } });
    container.appendChild(nextBtn);
  }

  async function _installFix(url, name, btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner--sm"></div>';

    try {
      var detect = await API.detectFix(name);
      var gamePath = null;

      if (detect.ok && detect.found) {
        var cleanName = _fixName(name);
        gamePath = await new Promise(function(resolve) {
          Modal.open({
            titleText: 'Install Fix',
            bodyHtml: '<p style="margin-bottom:8px;color:var(--text-2);font-size:.85rem">Game detected at:</p>'
              + '<p style="padding:8px 10px;background:var(--surface-2);border-radius:6px;font-size:.8rem;color:var(--text);word-break:break-all;font-family:monospace">'
              + escapeHtml(detect.game_path) + '</p>'
              + '<p style="margin-top:8px;color:var(--text-3);font-size:.8rem">Install the fix for "' + escapeHtml(cleanName) + '" here?</p>',
            confirmText: 'Install',
            cancelText: 'Cancel',
          }).then(function(r) { resolve(r ? detect.game_path : null); });
        });
      } else {
        gamePath = await _promptPath(name);
      }

      if (!gamePath) {
        btn.disabled = false;
        btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Install Fix';
        return;
      }

      btn.innerHTML = '<div class="spinner spinner--sm"></div>';
      var res = await API.installFix(url, gamePath);
      if (res.ok) {
        btn.textContent = '\u2713';
        btn.style.background = 'var(--green)';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        Toast.success('Fix successfully applied', '');
      } else {
        btn.disabled = false;
        btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Install Fix';
        Toast.error('Install failed', res.error || 'Unknown error');
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Install Fix';
      Toast.error('Install failed', err.message);
    }
  }

  function _fixName(name) {
    return name.replace(/\s*по сети\s*$/, '').trim();
  }

  function _promptPath(gameName) {
    return new Promise(function(resolve) {
      var cleanName = _fixName(gameName);
      var body = '<p style="margin-bottom:12px;color:var(--text-2);font-size:.85rem">Game not found automatically. Make sure "' + escapeHtml(cleanName) + '" is installed, then select its root folder.</p><div style="display:flex;gap:8px"><input type="text" id="fix-path-input" placeholder="Paste the game folder path\u2026" style="flex:1;padding:8px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-1);font-size:.85rem;font-family:inherit"><button class="btn btn-ghost" id="fix-browse-btn">Browse\u2026</button></div>';
      Modal.open({
        titleText: 'Game Folder for ' + cleanName,
        bodyHtml: body,
        confirmText: 'Install',
        cancelText: 'Cancel',
      }).then(function(result) {
        if (!result) { resolve(null); return; }
        var input = document.getElementById('fix-path-input');
        resolve(input && input.value.trim() || null);
      });

      setTimeout(function() {
        var browseBtn = document.getElementById('fix-browse-btn');
        if (browseBtn) browseBtn.addEventListener('click', async function() {
          var input = document.getElementById('fix-path-input');
          var path = await API.pickFolder();
          if (path) input.value = path;
        });
      }, 50);
    });
  }

  function _bindActions() {
    var searchEl = document.getElementById('fixes-search');
    if (searchEl) searchEl.addEventListener('input', debounce(function(e) {
      _query = e.target.value.trim();
      _applyFilter();
    }, 300));

    var refreshBtn = document.getElementById('fixes-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', function() { _load(); });
  }

  return { init };
})();
