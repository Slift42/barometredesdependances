#!/usr/bin/env python3
"""Solde des échanges d'électricité de la France sur les 7 derniers jours (données éCO2mix, ODRÉ).

Écrit site/data/live/electricite.json. Aucune clé nécessaire.
Dans éCO2mix, « ech_physiques » est négatif quand la France exporte.
"""
import datetime as dt
import json
import sys
import urllib.parse

from commun import LIVE, ecrire_json, http_get

API = "https://odre.opendatasoft.com/api/explore/v2.1/catalog/datasets/eco2mix-national-tr/records"


def main():
    params = {"select": "date_heure,consommation,ech_physiques", "order_by": "date_heure desc",
              "limit": "100", "where": "ech_physiques is not null"}
    lignes, offset = [], 0
    try:
        while offset < 700:  # 7 jours au pas de 15 min ≈ 672 points
            params["offset"] = str(offset)
            code, contenu = http_get(API + "?" + urllib.parse.urlencode(params))
            if code != 200:
                raise RuntimeError(f"HTTP {code}")
            page = json.loads(contenu).get("results", [])
            if not page:
                break
            lignes += page
            offset += len(page)
    except Exception as e:
        print(f"Échec de la collecte RTE : {e}", file=sys.stderr)
        return 1
    if not lignes:
        print("Aucune donnée reçue.", file=sys.stderr)
        return 1
    # Puissances en MW au pas de 15 minutes : énergie (MWh) = MW × 0,25 h
    solde_mwh = sum(float(l["ech_physiques"]) * 0.25 for l in lignes)
    conso_mwh = sum(float(l.get("consommation") or 0) * 0.25 for l in lignes)
    data = {
        "source": "RTE éCO2mix (ODRÉ)",
        "debut": lignes[-1]["date_heure"][:10],
        "fin": lignes[0]["date_heure"][:10],
        "solde_exportateur_gwh": round(-solde_mwh / 1000, 1),
        "consommation_gwh": round(conso_mwh / 1000, 1),
        "collecte": dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes"),
        "url": "https://www.rte-france.com/eco2mix",
    }
    ecrire_json(LIVE / "electricite.json", data)
    print(f"Solde exportateur sur la période : {data['solde_exportateur_gwh']} GWh")
    return 0


if __name__ == "__main__":
    sys.exit(main())
