"""
Load original .pyc modules, bypass premium with patches
"""
import sys, os, marshal, types

ORIGINALS_DIR = os.path.join(os.path.dirname(__file__), 'originals')

def load_pyc_module(fullname):
    parts = fullname.split('.')
    pyc_path = os.path.join(ORIGINALS_DIR, *parts) + '.pyc'
    if os.path.isfile(pyc_path):
        return _load_from_pyc(fullname, pyc_path, is_package=False)
    init_path = os.path.join(ORIGINALS_DIR, *parts, '__init__.pyc')
    if os.path.isfile(init_path):
        return _load_from_pyc(fullname, init_path, is_package=True)
    return None

def _load_from_pyc(fullname, path, is_package=False):
    with open(path, 'rb') as f:
        data = f.read()
    try:
        code = marshal.loads(data[16:])
    except ValueError as e:
        print(f"[loader] ERROR: Cannot load {fullname} - {e}")
        print(f"[loader] This usually means Python version mismatch.")
        print(f"[loader] The .pyc files target Python 3.11, you're running {sys.version}")
        raise
    mod = types.ModuleType(fullname)
    mod.__file__ = path
    mod.__path__ = [os.path.dirname(path)] if is_package else []
    mod.__package__ = fullname.rpartition('.')[0] if '.' in fullname else fullname
    mod.__loader__ = None
    sys.modules[fullname] = mod
    try:
        exec(code, mod.__dict__)
    except Exception as e:
        print(f"[loader] ERROR executing {fullname}: {e}")
        raise
    return mod

def load_original(module_name):
    mod = load_pyc_module(module_name)
    if mod is None:
        raise ImportError(f"Cannot load original {module_name}")
    return mod
