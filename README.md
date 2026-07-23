# SteamREtools

## Reverse Engineered open-source recreation of SteamTools App (steamtools.app)

This is a Reverse Engineered open-source recreation of SteamTools App, with all premium claimed and code open for anyone.
Original app was made with PyInstaller (lol), which was really easy to extract and check its code.
You can call it as you want, even `crack`.

> *NOTE: NOT official SteamTools (steamtools.net)*
>
> *NOTE: The built-in Hubcap API key has a daily limit of 25 downloads and resets **every week**. If downloads stop working, generate your own key (see [API Key](#-api-key) section).*
>
> *NOTE: Not every game can install! Some of games may return not found. If you make an issue i might be able to fix it.*
>
> **Current SteamTools App Version (Repo): 2.61**

## Features

- **Hubcap API** - browse and search game manifests
- **DepotBox API** - download game depots
- **ACF Management** - install, update, remove games
- **Steam Repair** - repair Steam with CloudRedirect etc.
- **Premium Bypass** - all features unlocked, no Discord auth required
- **No Ban** - you cant get banned from SteamTools (user replacement)
- **No Anti-debug** - no Anti-Debug protection, unlike original
- **Reinstall Backup** - backup your games to another machine
- **And more**

## How it works

SteamREtools loads the **original** compiled Python modules (`.pyc`) from SteamTools via `marshal.loads` + `exec`. Only the premium-gating functions are replaced at runtime:

| Module | Original | Patched |
| -------- | ---------- | --------- |
| `server_minimal` | `_verify_and_refresh()` checks Discord role -> sets tier=`standard` | Always returns tier=`premium` |
| `server_minimal` | `_load_session()` reads session from `session.json` | Creates premium session |
| `backend` | `_ENCODED_KEY` = placeholder | Set to real DepotBox API key |

Everything else: manifest downloads, DepotBox API calls, ACF parsing, game search runs the **original** unmodified code (yes im lying i modified it, BUT I ONLY DELETED AI COMMENTS FROM DEVELOPERS! 😭).

## Requirements

- Python 3.11 (the original bytecode is compiled for 3.11)
- Dependencies: see `requirements.txt` or install via pip

## Quick Start

### Downloading from Releases

Unfortunately, .pyc files from original SteamTools were compiled for **Windows**, that means *i CANT* make builds for **Linux/MacOS**.
To download latest `Windows` release, go to [Releases Page](https://github.com/nazarhktwitch/SteamREtools/releases/latest) and download an executable.

### API Key

To use Hubcap manifest downloads you need an API key. The app comes with a built-in key, but it has limits:

- **Daily limit**: 25 downloads
- **Key reset**: Every week (the built-in key will stop working periodically, and for me to set a new key i need to rebuild an application, what im not gonna do)
- **No key?** Downloads will fail with "Hubcap API key not set" or "not found"

**Get your own free key:**

1. Go to [hubcapmanifest.com](https://hubcapmanifest.com)
2. Click **Continue with Discord**
3. After login, navigate to **API** section
4. Click **Generate Key**
5. Copy the key (starts with `smm_...`, its not gonna show again)

**Set your key in the app (easiest):**

1. Open SteamREtools
2. Go to **Settings → Provider**
3. Select **Hubcap API**
4. Toggle **Custom Hubcap Key** ON
5. Paste your key and it's saved automatically

**Or via command line (for developers):**

```bash
set HUBCAP_KEY=smm_your_key_here && python launcher.py
```

> The custom key is persistent - set it once and it stays even after updates (unless you clear app data).

### Manual

#### Install Dependencies

```bash
pip install -r requirements.txt
```

or directly:

```bash
pip install requests rarfile pywebview psutil
```

#### Run

```bash
python launcher.py
```

Opens an app GUI and a web UI at `http://127.0.0.1:{port}`.

## GUI Note

Whole original GUI (maybe app backend too, but im not sure) from SteamTools App was **VIBECODED**, so i deleted some comments from them to clean up code. You can still get them if you extract CArchive yourself.

## Disclaimer

*This project is for **educational purposes only**. SteamREtools is not affiliated with or endorsed by SteamTools (steamtools.net) or Valve Corporation. All original code belongs to its respective owners.*

## License

MIT. See [LICENSE](LICENSE) file for details.
