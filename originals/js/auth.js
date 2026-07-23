/* Holy AI
  Also removed some comments because bro */

const Auth = (() => {
  let _state     = null;
  let _pollTimer = null;

  async function init() {
    const state = await _check();
    if (!state.authenticated) {
      _showOverlay();
    } else {
      _applyState(state);
      setTimeout(_bgRefresh, 3000);
    }
    return state;
  }

  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    _state = { authenticated: false };
    _showOverlay();
  }

  function openDiscordLogin() {
    const statusEl = document.getElementById('login-status');
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Opening browser…'; }
    fetch('/api/auth/login-url')
      .then(r => r.json())
      .then(data => {
        if (!data.url) throw new Error();
        if (window.pywebview?.api?.open_browser) {
          window.pywebview.api.open_browser(data.url);
        } else {
          window.open(data.url, '_blank', 'noopener,noreferrer');
        }
        if (statusEl) statusEl.textContent = 'Waiting for Discord login…';
        _startPoll();
      })
      .catch(() => { if (statusEl) statusEl.textContent = 'Error — please try again.'; });
  }

  function getState() { return _state; }

  async function refreshUsage() {
    try {
      const r    = await fetch('/api/auth/refresh', { cache: 'no-store' });
      const data = await r.json();
      if (data.authenticated) {
        _state = data;
        _applyState(data);
      }
    } catch {}
  }

  async function _check() {
    try {
      const r = await fetch('/api/auth/status', { cache: 'no-store' });
      _state  = await r.json();
    } catch {
      _state = { authenticated: false };
    }
    return _state;
  }

  async function _bgRefresh(attempt) {
    attempt = attempt || 0;
    try {
      const r    = await fetch('/api/auth/refresh', { cache: 'no-store' });
      const data = await r.json();
      if (data.authenticated) {
        _state = data;
        _applyState(data);
        if (data.tier === 'standard' && attempt < 2) {
          setTimeout(() => _bgRefresh(attempt + 1), 5000);
        }
      } else {
        _state = { authenticated: false };
        _showOverlay();
      }
    } catch {}
  }

  function _showOverlay() {
    const overlay = document.getElementById('login-overlay');
    if (!overlay) return;
    overlay.classList.remove('login-overlay--out');
    overlay.style.display = 'flex';
    const statusEl = document.getElementById('login-status');
    if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }
  }

  function _hideOverlay() {
    const overlay = document.getElementById('login-overlay');
    if (!overlay) return;
    overlay.classList.add('login-overlay--out');
    setTimeout(() => { overlay.style.display = 'none'; overlay.classList.remove('login-overlay--out'); }, 500);
  }

  function _applyState(state) {
    window.dispatchEvent(new CustomEvent('authstatechange', { detail: state }));

    const nameEl = document.getElementById('sidebar-username');
    if (nameEl) nameEl.textContent = state.user?.name || 'SteamTools';

    const avatarEl = document.querySelector('.profile-avatar');
    if (avatarEl) {
      const imgUrl = state.user?.image;
      if (imgUrl) {
        avatarEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = '';
        img.draggable = false;
        avatarEl.appendChild(img);
      } else {
        const name = state.user?.name || '';
        const initials = name.trim().split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || 'ST';
        avatarEl.textContent = initials;
      }
    }

    const tierEl = document.getElementById('user-tier-label');
    if (tierEl) {
      const tier    = state.tier || 'standard';
      const classes = { standard: 'user-tier--standard', premium1: 'user-tier--premium-1', premium2: 'user-tier--premium-2' };
      const labels  = { standard: 'Standard', premium1: 'Premium T1', premium2: 'Premium T2' };
      tierEl.className   = `user-tier ${classes[tier] || classes.standard}`;
      tierEl.textContent = labels[tier] || 'Standard';
    }
  }

  function _startPoll() {
    if (_pollTimer) return;
    _pollTimer = setInterval(async () => {
      const state = await _check();
      if (state.authenticated) {
        clearInterval(_pollTimer);
        _pollTimer = null;
        _hideOverlay();
        _applyState(state);
        setTimeout(_bgRefresh, 3000);
      }
    }, 2000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-discord-btn')?.addEventListener('click', openDiscordLogin);
    document.getElementById('btn-signout')?.addEventListener('click', logout);
  });

  return { init, logout, openDiscordLogin, getState, refreshUsage };
})();
