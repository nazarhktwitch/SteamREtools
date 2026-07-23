const PageCredits = (() => {

  async function init() {
    _loadCredits();
  }

  function _loadCredits() {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || 'N/A';
    };

    const hide = (id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    };

    const setLink = (id, href) => {
      const el = document.getElementById(id);
      if (el && href) {
        el.href = href;
        el.style.display = 'inline-flex';
      } else if (el) {
        el.style.display = 'none';
      }
    };

    hide('credit-site');
    hide('credit-discord');
    hide('credit-site-btn');
    hide('credit-discord-btn');

    set('credit-pseudo', 'NazarHK'); // Hehe now its me >3
    set('credit-github', 'github.com/nazarhktwitch/SteamREtools'); // Ye me too >3
    setLink('credit-github-btn', 'https://github.com/nazarhktwitch/SteamREtools'); // Another me >3
  }

  return { init };
})();
