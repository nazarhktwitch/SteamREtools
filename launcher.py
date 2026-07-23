#!/usr/bin/env python3
"""
Loads original modules, patches only premium checks
"""
import base64
import os
import sys
import socket
import time
import threading
import atexit
import traceback
import webbrowser

from loader import load_original

if sys.version_info[:2] != (3, 11):
    print(f"[launcher] ERROR: Need Python 3.11, got {sys.version_info.major}.{sys.version_info.minor}")
    print("\nPress Enter to exit...", file=sys.stderr)
    input()
    sys.exit(1)

print("[launcher] Loading backend...")
backend = load_original('backend')

print("[launcher] Loading server_minimal...")
server_minimal = load_original('server_minimal')
print("[launcher] Modules loaded OK")

# Fix BASE_DIR for frozen mode: original code uses sys._MEIPASS (without /originals)
if getattr(sys, 'frozen', False):
    server_minimal.BASE_DIR = os.path.join(sys._MEIPASS, 'originals')

print("[launcher] Patching premium checks...")
exec('''
def _load_session():
    _session.update(token="bypass", user={"name": "SteamREtools User", "id": "0"}, tier="premium2", usage={"daily": 0, "total": 999999})

def _save_session():
    pass

def _verify_and_refresh():
    _session.update(tier="premium2")
    return {"tier": "premium2", "usage": {"daily": 0, "total": 999999}}

def _bg_verify():
    _session.update(tier="premium2")
    while True:
        time.sleep(3600)
        _session.update(tier="premium2")

_session.update(token="bypass", user={"name": "SteamREtools User", "id": "0"}, tier="premium2", usage={"daily": 0, "total": 999999})
''', server_minimal.__dict__)

# Patch backend
# Set the premium API key (DepotBox) and Hubcap key
_PREMIUM_KEY = "2f28af4e-ee19-4768-8736-df10c4b86a73"
backend._ENCODED_KEY = base64.b64encode(_PREMIUM_KEY.encode()).decode()
backend._DEPOTBOX_ENCODED_KEY = base64.b64encode(_PREMIUM_KEY.encode()).decode()

print("[launcher] Premium bypass active")

# Fix _send: original bytecode has two call patterns:
#   Pattern A: _send(status, headers, body)         - 3 args
#   Pattern B: _send(status, headers, body, code)   - 4 args (LIST_EXTEND flattens _json_resp tuple)
# Patch to accept both - use 4th arg as actual status if present
Handler = server_minimal.Handler
_original_send = Handler._send
def _patched_send(self, *args):
    if len(args) == 3:
        return _original_send(self, *args)
    if len(args) == 4:
        # Pattern B: _send(status, headers, body, code) - use last as actual status
        return _original_send(self, args[3], args[1], args[2])
    # Fallback
    return _original_send(self, *args)
Handler._send = _patched_send

# Patch _api_post to bypass manilua auth check for install/manifest endpoints
# manilua.steamtools.app is used only as auth gate; Hubcap/DepotBox have their own API keys
_original_api_post = server_minimal._api_post
_FORCE_OK_PATHS = {'/api/desktop/install', '/api/desktop/update', '/api/desktop/refund-install'}
def _patched_api_post(path, body, token, timeout=8):
    if path in _FORCE_OK_PATHS:
        return (200, {'ok': True, 'server_url': ''})
    return _original_api_post(path, body, token, timeout)
server_minimal._api_post = _patched_api_post

# Patch install_game to try Hubcap if primary provider (DepotBox) returns not_found
_original_install_game = backend.SteamToolsAPI.install_game
def _patched_install_game(self, appid, skip_restart=False):
    result = _original_install_game(self, appid, skip_restart)
    if result.get('not_found'):
        settings = self.get_settings()
        provider = settings.get('provider', 'default')
        if provider != 'hubcap':
            hubcap_key = settings.get('hubcap_api_key', '').strip()
            if hubcap_key:
                old = provider
                self.save_setting('provider', 'hubcap')
                result = _original_install_game(self, appid, skip_restart)
                self.save_setting('provider', old)
    return result
backend.SteamToolsAPI.install_game = _patched_install_game

# Set Hubcap API key (from env var, or previously saved settings, or CI placeholder)
_tmp_api = backend.SteamToolsAPI()
_HUBCAP_KEY = os.environ.get("HUBCAP_KEY") or ""
if not _HUBCAP_KEY or _HUBCAP_KEY == "HUBCAP_KEY_PLACEHOLDER":
    try:
        _saved = _tmp_api.get_settings().get("hubcap_api_key", "")
        if _saved:
            _HUBCAP_KEY = _saved
            print("[launcher] Hubcap key loaded from saved settings")
    except Exception:
        pass
if _HUBCAP_KEY and _HUBCAP_KEY != "HUBCAP_KEY_PLACEHOLDER":
    _tmp_api.save_setting("hubcap_api_key", _HUBCAP_KEY)
    print("[launcher] Hubcap key set")
else:
    print("[launcher] WARNING: Hubcap key not set. Set HUBCAP_KEY env var.")

# Patch load_config to include server_url/auth_code for Hubcap fallback logic
_original_load_config = backend.SteamToolsAPI.load_config
def _patched_load_config(self):
    result = _original_load_config(self)
    if result.get('ok'):
        if 'server_url' not in result:
            result['server_url'] = getattr(self, '_api_url', '')
        if 'auth_code' not in result:
            result['auth_code'] = ''
    return result
backend.SteamToolsAPI.load_config = _patched_load_config

# Pre-populate fixes cache so the page doesn't hang on hubcap timeout
backend.SteamToolsAPI._fixes_cache = {"fixes": []}
backend.SteamToolsAPI._fixes_cache_ts = time.time()

# Single instance
_LOCK_FILE = os.path.join(os.environ.get('TEMP', '.'), 'steamretools.lock')

def _terminate_prior_instance():
    try:
        if os.path.exists(_LOCK_FILE):
            os.remove(_LOCK_FILE)
        with open(_LOCK_FILE, 'w') as f:
            f.write(str(os.getpid()))
        atexit.register(lambda: os.remove(_LOCK_FILE))
    except OSError:
        pass

# Server
def _find_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port

def _wait_for_server(port, timeout=15):
    start = time.time()
    while time.time() - start < timeout:
        try:
            s = socket.create_connection(('127.0.0.1', port), timeout=1)
            s.close()
            return True
        except OSError:
            time.sleep(0.1)
    return False

def _start_server():
    port = _find_free_port()
    print(f"[launcher] Starting server on port {port}")
    t = threading.Thread(target=server_minimal.start, args=('127.0.0.1', port), daemon=True)
    t.start()
    if not _wait_for_server(port):
        print("[launcher] Server failed to start", file=sys.stderr)
        sys.exit(1)
    print(f"[launcher] Server ready at http://127.0.0.1:{port}")
    return port

def main():
    print("SteamREtools v1.0.0")
    print()

    _terminate_prior_instance()
    port = _start_server()

    try:
        import webview
        api = backend.SteamToolsAPI()
        webview.create_window(
            title="SteamREtools",
            url=f"http://127.0.0.1:{port}",
            width=1280, height=800, resizable=True, js_api=api,
        )
        webview.start(private_mode=False, debug=False)
    except ImportError:
        print("[launcher] webview not available, using browser")
        print(f"[launcher] Open http://127.0.0.1:{port}")
        webbrowser.open(f"http://127.0.0.1:{port}")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down...")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n[launcher] FATAL: {e}", file=sys.stderr)
        traceback.print_exc()
        print("\nPress Enter to exit...", file=sys.stderr)
        input()
