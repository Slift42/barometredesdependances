"""Outils partagés par les collecteurs (bibliothèque standard uniquement)."""
import json
import pathlib
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "site" / "data"
LIVE = DATA / "live"
UA = "barometredesdependances.com (veille publique ; contact via le dépôt GitHub)"


def http_get(url, headers=None, timeout=30, tries=2):
    """Télécharge une ressource ; renvoie (code, octets) ou lève l'exception finale."""
    h = {"User-Agent": UA, "Accept": "*/*"}
    if headers:
        h.update(headers)
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, b""
        except Exception as e:  # réseau, délai dépassé
            last = e
            time.sleep(2 * (i + 1))
    raise last


def lire_json(path, defaut):
    try:
        return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    except Exception:
        return defaut


def ecrire_json(path, data):
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
