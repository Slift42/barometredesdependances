#!/usr/bin/env python3
"""Collecteur AGSI+ : niveau des stocks de gaz en France.

Écrit site/data/live/gaz.json, lu par le front pour calculer les jours de tenue du gaz.
Nécessite une clé d'API gratuite (inscription sur https://agsi.gie.eu/) dans la variable
d'environnement AGSI_API_KEY (secret GitHub du même nom en production).

Usage : AGSI_API_KEY=... python3 collectors/agsi_gaz.py
"""
import json
import os
import pathlib
import sys
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "data" / "live" / "gaz.json"
API = "https://agsi.gie.eu/api?country=FR&size=1"

# Consommation moyenne française, ordre de grandeur annuel (≈ 1 TWh/jour).
# À remplacer par une moyenne glissante issue de GRTgaz / Teréga quand le collecteur existera.
CONSO_MOYENNE_TWH_J = 1.0


def fetch(key: str) -> dict:
    req = urllib.request.Request(API, headers={"x-key": key, "User-Agent": "barometredesdependances.com"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main() -> int:
    key = os.environ.get("AGSI_API_KEY")
    if not key:
        print("AGSI_API_KEY absente : collecte ignorée, fichier existant conservé.")
        return 0
    try:
        payload = fetch(key)
        row = payload["data"][0]
        stock = round(float(row["gasInStorage"]), 1)
        full = round(float(row["full"]), 1)
        day = row["gasDayStart"]
    except Exception as exc:  # on garde la dernière valeur connue plutôt que de casser le site
        print(f"Échec de la collecte AGSI+ : {exc}", file=sys.stderr)
        return 1

    data = {
        "source": "GIE AGSI+",
        "pays": "FR",
        "jour_gazier": day,
        "stock_twh": stock,
        "remplissage_pct": full,
        "conso_moyenne_twh_j": CONSO_MOYENNE_TWH_J,
        "collecte": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "url": "https://agsi.gie.eu/",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Gaz FR au {day} : {stock} TWh ({full} %)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
