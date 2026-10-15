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
    for x in p.get("intrants", []):
        if x not in ids:
            erreurs.append(f"{pid} : intrant « {x} » inconnu (identifiant de produit attendu)")
    if p.get("intrants") and not (p.get("amont") or {}).get("txt"):
        avertissements.append(f"{pid} : intrants sans explication (champ « amont »)")
    if p.get("reloc") is not None and not p.get("reloc_refs"):
        avertissements.append(f"{pid} : délai de relocalisation sans source (champ « reloc_refs »)")
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

# ---------- partenaires de demain ----------
pa = charger("partenaires.json") or {"matieres": []}
for m in pa.get("matieres", []):
    mid = m.get("id", "?")
    for k in range(len(m.get("annees", []))):
        som = sum(v[k] for v in m["prod"].values())
        w = m["monde"][k]
        if w and abs(som - w) / w > 0.03:
            erreurs.append(f"partenaires {mid} {m['annees'][k]} : la somme des pays ({som}) s'écarte de plus de 3 % du total mondial ({w})")
    for pid in m.get("produits", []):
        if pid not in ids:
            erreurs.append(f"partenaires {mid} : produit « {pid} » inconnu")
    for r in refs_de(m):
        if r not in ids_biblio:
            erreurs.append(f"partenaires {mid} : source « {r} » absente de la bibliographie")

# ---------- pays producteurs (pays.json) ----------
py = charger("pays.json") or {}
if py:
    cont = {c for L in py.get("continents", {}).values() for c in L}
    types = set(py.get("types", {}))
    codes = set()
    for m in pa.get("matieres", []):
        for o in (m.get("prod", {}), m.get("res") or {}, (m.get("raffinage") or {}).get("lignes") or {}):
            codes |= set(o)
        codes |= {x["c"] for x in m.get("partenaires", [])}
    codes |= {d["c"] for d in py.get("dossiers", [])} | {u[0] for u in py.get("ue", [])}
    codes.discard("ZZ")
    for c in sorted(codes - cont):
        erreurs.append(f"pays.json : le pays {c} n'est rattaché à aucun continent")
    for d in py.get("dossiers", []):
        for x in d.get("mesures", []):
            if x.get("type") not in types:
                erreurs.append(f"pays.json {d['c']} : type de décision « {x.get('type')} » inconnu")
            if x.get("statut") not in ("en vigueur", "annoncée", "en suspens", "abandonnée"):
                erreurs.append(f"pays.json {d['c']} : état « {x.get('statut')} » inconnu")
            if x.get("cit") and len(x["cit"]) > 125:
                erreurs.append(f"pays.json {d['c']} : citation de plus de 125 caractères")
    for e in py.get("ecarts", []):
        if e.get("verdict") not in ("accord", "ecart", "incomparable"):
            erreurs.append(f"pays.json écart {e.get('c')} : verdict inconnu")
        for x in (e["a"], e["b"]):
            if x[2] not in ids_biblio:
                erreurs.append(f"pays.json écart {e.get('c')} : source « {x[2]} » absente de la bibliographie")
    for r in refs_de(py):
        if r not in ids_biblio:
            erreurs.append(f"pays.json : source « {r} » absente de la bibliographie")
types_ok = {"institution", "etat", "parlement", "doctrine", "expertise", "programme", "donnees", "ong", "presse"}
for b in biblio:
    if b.get("type") not in types_ok:
        erreurs.append(f"bibliographie {b.get('id')} : type « {b.get('type')} » inconnu")

for a in avertissements:
    print("⚠", a)
for e in erreurs:
    print("✘", e)

notes = sum(1 for p in produits if "d" in p or "cov" in p)
print(f"{len(produits)} produits, {notes} notés, {len(biblio)} sources, {len(erreurs)} erreur(s).")
sys.exit(1 if erreurs else 0)
