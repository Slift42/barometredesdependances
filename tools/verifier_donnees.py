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
    if p.get("k") == "est" and "estim" not in p:
        avertissements.append(f"{pid} : estimation sans méthode décrite (champ « estim »)")
    if p.get("l", 0) >= 1 and "lev" not in p:
        avertissements.append(f"{pid} : levier sans détail (champ « lev »)")
    if p.get("estim") and p["estim"].get("m") not in meta.get("methodes_estimation", {}):
        erreurs.append(f"{pid} : méthode d'estimation inconnue")
    if p.get("seuil") and p["seuil"] not in meta.get("seuils", {}):
        erreurs.append(f"{pid} : seuil légal inconnu")
    for c in p.get("cout", []):
        if c.get("r") not in meta.get("remedes", {}):
            erreurs.append(f"{pid} : remède inconnu dans le chiffrage")
        if not (0 <= c.get("lo", -1) <= c.get("hi", -1)):
            erreurs.append(f"{pid} : fourchette de coût invalide")
    if not p.get("cout"):
        avertissements.append(f"{pid} : pas de chiffrage")


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


for p in produits:
    for i, pr in enumerate(p.get("preuves", [])):
        if pr.get("ref") not in ids_biblio:
            erreurs.append(f"{p.get('id')} : preuve n° {i + 1}, source « {pr.get('ref')} » absente de la bibliothèque")
        if not pr.get("cit"):
            erreurs.append(f"{p.get('id')} : preuve n° {i + 1} sans citation ni extrait")
    if p.get("src_i") is not None and not (0 <= p["src_i"] < len(p.get("preuves", []))):
        erreurs.append(f"{p.get('id')} : « src_i » ne désigne aucune preuve")
    if not p.get("preuves"):
        avertissements.append(f"{p.get('id')} : aucune preuve citée")
    for r in list(refs_de(p)) + p.get("note_refs", []):
        if r not in ids_biblio:
            erreurs.append(f"{p.get('id')} : référence « {r} » absente de la bibliothèque")
for r in refs_de({k: meta.get(k) for k in ("seuils", "couts")}):
    if r not in ids_biblio:
        erreurs.append(f"meta.json : référence « {r} » absente de la bibliothèque")
for s_ in meta.get("seuils", {}).values():
    for pt in s_.get("points", []):
        for r in pt[2]:
            if r not in ids_biblio:
                erreurs.append(f"meta.json (seuils) : référence « {r} » absente")

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
