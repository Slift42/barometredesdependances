#!/usr/bin/env python3
"""Vérifie chaque semaine que les liens de la bibliothèque répondent encore.

Écrit site/data/live/sources_etat.json : {id: {code, verifie, statut}}.
Un lien mort n'est jamais supprimé automatiquement : il est signalé sur le site
(« lien à vérifier ») pour qu'un membre du comité trouve une copie ou une autre source.
"""
import datetime as dt
import sys
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "collectors"))
from commun import DATA, LIVE, ecrire_json, http_get, lire_json  # noqa: E402


def main():
    biblio = lire_json(DATA / "bibliographie.json", [])
    etat = {}
    for b in biblio:
        url = b.get("url")
        if not url:
            continue
        try:
            code, _ = http_get(url, timeout=25, tries=1)
        except Exception as e:
            code = 0
            print(f"✘ {b['id']} : {e}", file=sys.stderr)
        # Certains sites refusent les robots (403/405) : on ne les déclare pas morts pour autant.
        statut = "ok" if code and code < 400 else ("protégé" if code in (401, 403, 405, 429) else "à vérifier")
        etat[b["id"]] = {"code": code, "statut": statut, "verifie": dt.date.today().isoformat()}
        print(f"{statut:10} {code:>3} {b['id']}")
    ecrire_json(LIVE / "sources_etat.json", etat)
    morts = [k for k, v in etat.items() if v["statut"] == "à vérifier"]
    print(f"{len(etat)} liens vérifiés, {len(morts)} à vérifier.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
