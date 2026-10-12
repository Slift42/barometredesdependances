#!/usr/bin/env python3
"""Contrôle de cohérence des données avant publication.

Vérifie : JSON valides, identifiants uniques, références bibliographiques existantes,
codes pays connus, chaque produit noté a une source et une justification.
Sort en erreur (code 1) au moindre problème bloquant ; affiche des avertissements sinon.
"""
import json
import pathlib
import sys

DATA = pathlib.Path(__file__).resolve().parent.parent / "site" / "data"
erreurs, avertissements = [], []


def charger(nom):
    try:
        return json.loads((DATA / nom).read_text(encoding="utf-8"))
    except Exception as e:
        erreurs.append(f"{nom} illisible : {e}")
        return None


meta = charger("meta.json") or {}
produits = charger("produits.json") or []
biblio = charger("bibliographie.json") or []
ids_biblio = {b["id"] for b in biblio}
if len(ids_biblio) != len(biblio):
    erreurs.append("identifiants en double dans bibliographie.json")

ids = [p["id"] for p in produits]
if len(set(ids)) != len(ids):
    erreurs.append("identifiants en double dans produits.json")

for p in produits:
    pid = p.get("id", "?")
    if p.get("f") not in meta.get("familles", {}):
        erreurs.append(f"{pid} : famille inconnue")
    note = "d" in p or "cov" in p
    if not note:
        avertissements.append(f"{pid} : pas encore noté")
        continue
    for k in ("k", "h", "l", "src", "pourquoi"):
        if k not in p:
            erreurs.append(f"{pid} : champ « {k} » manquant")
    if p.get("k") in ("src", "calc") and not p.get("refs"):
        avertissements.append(f"{pid} : donnée publiée sans référence bibliographique")
    for h in p.get("h", []):
        if h not in meta.get("detenteurs", {}):
            erreurs.append(f"{pid} : code pays « {h} » inconnu")
    for r in p.get("refs", []):
        if r not in ids_biblio:
            erreurs.append(f"{pid} : référence « {r} » absente de la bibliothèque")


def refs_de(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("refs", "faille_refs") and isinstance(v, list):
                yield from v
            else:
                yield from refs_de(v)
    elif isinstance(obj, list):
        for x in obj:
            yield from refs_de(x)


for nom in ("kii.json", "europe.json", "allies.json", "strategies.json", "chaines.json", "actus.json", "echeances.json", "zoom_armees.json"):
    d = charger(nom)
    for r in refs_de(d):
        if r not in ids_biblio:
            erreurs.append(f"{nom} : référence « {r} » absente de la bibliothèque")

for a in avertissements:
    print("⚠", a)
for e in erreurs:
    print("✘", e)
notes = sum(1 for p in produits if "d" in p or "cov" in p)
print(f"{len(produits)} produits, {notes} notés, {len(biblio)} sources, {len(erreurs)} erreur(s).")
sys.exit(1 if erreurs else 0)
