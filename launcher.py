#!/usr/bin/env python3
"""
Loads original modules, patches only premium checks
"""
import os, sys, json, socket, time, threading, atexit

if sys.version_info[:2] != (3, 11):
    print(f"[launcher] ERROR: Need Python 3.11, got {sys.version_info.major}.{sys.version_info.minor}")
    print("\nPress Enter to exit...", file=sys.stderr)
    input()
    sys.exit(1)

from loader import load_original

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
    _session.update(token="bypass", user={"name": "SteamREtools User", "id": "0"}, tier="premium", usage={"daily": 0, "total": 999999})

def _save_session():
    pass

def _verify_and_refresh():
    _session.update(tier="premium")
    return {"tier": "premium", "usage": {"daily": 0, "total": 999999}}

def _bg_verify():
    _session.update(tier="premium")
    while True:
        time.sleep(3600)
        _session.update(tier="premium")

_session.update(token="bypass", user={"name": "SteamREtools User", "id": "0"}, tier="premium", usage={"daily": 0, "total": 999999})
''', server_minimal.__dict__)

# Patch backend
# Set the premium API key (DepotBox) and Hubcap key
import base64
_PREMIUM_KEY = "2f28af4e-ee19-4768-8736-df10c4b86a73"
backend._ENCODED_KEY = base64.b64encode(_PREMIUM_KEY.encode()).decode()
backend._DEPOTBOX_ENCODED_KEY = base64.b64encode(_PREMIUM_KEY.encode()).decode()

print("[launcher] Premium bypass active")

# Single instance
_LOCK_FILE = os.path.join(os.environ.get('TEMP', '.'), 'steamretools.lock')

def _terminate_prior_instance():
    if os.path.exists(_LOCK_FILE):
        try:
            with open(_LOCK_FILE) as f: pid = int(f.read().strip())
            try: os.kill(pid, 0)
            except: os.remove(_LOCK_FILE)
        except: pass
    with open(_LOCK_FILE, 'w') as f: f.write(str(os.getpid()))
    atexit.register(lambda: os.remove(_LOCK_FILE))

# Server
def _find_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]; s.close()
    return port

def _wait_for_server(port, timeout=15):
    start = time.time()
    while time.time() - start < timeout:
        try:
            s = socket.create_connection(('127.0.0.1', port), timeout=1)
            s.close(); return True
        except: time.sleep(0.1)
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
        win = webview.create_window(
            title="SteamREtools",
            url=f"http://127.0.0.1:{port}",
            width=1280, height=800, resizable=True, js_api=api,
        )
        webview.start(private_mode=False, debug=False)
    except ImportError:
        print(f"[launcher] webview not available, using browser")
        print(f"[launcher] Open http://127.0.0.1:{port}")
        import webbrowser
        webbrowser.open(f"http://127.0.0.1:{port}")
        try:
            while True: time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down...")

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n[launcher] FATAL: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        print("\nPress Enter to exit...", file=sys.stderr)
        input()
