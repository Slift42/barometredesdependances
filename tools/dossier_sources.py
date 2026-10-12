#!/usr/bin/env python3
"""Génère le dossier de sources du comité (Markdown) à partir des données du site.

Usage : python3 tools/dossier_sources.py [sortie.md]
Par défaut : dist/dossier-sources.md. Tout vient de site/data/*.json : rien n'est saisi ici.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "site" / "data"


def lire(nom):
    return json.loads((DATA / f"{nom}.json").read_text(encoding="utf-8"))


meta, produits, biblio = lire("meta"), lire("produits"), lire("bibliographie")
B = {b["id"]: b for b in biblio}
TYPES = {"institution": "institution", "parlement": "parlement", "doctrine": "leurs textes", "expertise": "expertise",
         "programme": "programme", "donnees": "données", "comite": "comité", "presse": "presse"}


def ref(i):
    b = B.get(i)
    if not b:
        return ""
    lab = f"{b['auteur'].split(' (')[0].split(',')[0]}, {str(b['date'])[:4]}"
    return f"[{lab}]({b['url']})" if b.get("url") else lab


def refs(ids):
    r = [ref(i) for i in ids or [] if ref(i)]
    return f" Sources : {' ; '.join(r)}" if r else ""


def niveau(p):
    by = lambda d: 1 if d == "auto" else 2 if d > 365 else 3 if d > 90 else 4 if d > 30 else 5
    if "cov" in p:
        c = p["cov"]
        b = 1 if c >= 100 else 2 if c >= 80 else 3 if c >= 50 else (by(p["d"]) if "d" in p else 4)
    elif "d" in p:
        b = by(p["d"])
    else:
        return 0
    if p.get("l") == 2 and 1 < b < 5:
        b += 1
    return b


def valeur(p):
    a = "≈ " if p.get("k") == "est" else ""
    if "cov" in p:
        return f"{a}{p['cov']} % couverts"
    if p.get("d") == "auto":
        return "Autonome"
    return f"{a}{p['d']} j" if "d" in p else "à instruire"


def cellule(t):
    return str(t or "").replace("|", "/").replace("\n", " ")


def main():
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist" / "dossier-sources.md"
    L = [f"# Baromètre des dépendances — dossier de sources (v{meta['version']}, {meta['maj']})", "",
         "Généré automatiquement depuis les données du site (`tools/dossier_sources.py`). Les chiffres « ≈ » sont des estimations de travail, à instruire avant toute diffusion.", ""]

    # synthèse
    notes = [p for p in produits if niveau(p)]
    L += ["## Synthèse", ""]
    for n in (5, 4, 3, 2, 1):
        ps = [p["n"] for p in notes if niveau(p) == n]
        L.append(f"- **{meta['niveaux'][str(n)]['nom']}** ({len(ps)}) : {', '.join(ps)}.")
    nk = {k: sum(1 for p in notes if p.get("k") == k) for k in ("src", "calc", "est")}
    L += ["", f"{len(notes)} produits notés sur {len(produits)} : {nk['src']} sur donnée publiée, {nk['calc']} calculés, {nk['est']} estimés (≈). "
          f"{sum(1 for p in notes if p.get('l') == 2)} leviers déjà activés.", ""]

    S = lire("strategies")
    L += ["## 1. Leur stratégie, dans leurs propres textes", "", S["intro"], ""]
    for x in S["puissances"]:
        L += [f"### {x['nom']} — « {x['these']} »", ""]
        for t in x["textes"]:
            L.append(f"- **{t['titre']}** ({t['date']}). « {t['citation']} » — {t['lecture']}{refs(t.get('refs'))}")
        L += ["", "Ce qu'en disent les chercheurs :"]
        L += [f"- {e['idee']}{refs(e.get('refs'))}" for e in x["experts"]]
        L += ["", f"Ce que ça explique : {x['explique']}", "", f"Leur point faible : {x['faille']}{refs(x.get('faille_refs'))}", ""]

    K = lire("kii")
    L += ["## 2. Les leviers qu'ils assument (Key Imperialism Indicators)", "", K["intro"], ""]
    for x in K["puissances"]:
        L += [f"### {x['nom']}", "", x["resume"], ""]
        for l in x["leviers"]:
            L.append(f"- **{l['titre']}** ({l['vecteur']}, {l['date']}, {'assumé' if l['assume'] else 'documenté'}). {l['preuve']} Effet : {l['effet']}{refs(l.get('refs'))}")
        L.append("")

    L += ["## 3. Ce que ça coûte à l'Europe", ""]
    L += [f"- **{c['chiffre']} {c['titre']}.** {c['texte']}{refs(c.get('refs'))}" for c in lire("europe")]
    L += ["", "## 4. Ce que font nos voisins", ""]
    L += [f"- **{a['domaine']}** ({'ils font autrement' if a['sens'] == 'contre-exemple' else 'réflexe de dépendance'}). {a['comportement']} {a['cout']}{refs(a.get('refs'))}" for a in lire("allies")]

    L += ["", "## 5. Maillon par maillon", ""]
    for c in lire("chaines"):
        L += [f"### {c['titre']}", "", c["intro"], ""]
        L += [f"{k + 1}. **{s['nom']}** — {s['qui']} : {s['part']} ({meta['niveaux'][str(s['lv'])]['nom']}).{refs(s.get('refs'))}" for k, s in enumerate(c["etapes"])]
        L.append("")
    Z = lire("zoom_armees")
    L += [f"### {Z['titre']}", "", Z["intro"], ""]
    L += [f"- **{x['quoi']}** ({meta['niveaux'][str(x['lv'])]['nom']}). {x['constat']}" for x in Z["items"]]
    L += ["", refs(Z.get("refs")).strip(), ""]

    L += ["## 6. Actus vérifiées et échéances", ""]
    eff = {"aggrave": "ça s'aggrave", "ameliore": "ça avance", "surveille": "à surveiller"}
    L += [f"- **{a['d']} — {a['titre']}** ({eff.get(a['effet'], a['effet'])}). {a['texte']}{refs(a.get('refs'))}" for a in lire("actus")]
    L += ["", "Échéances :", ""]
    L += [f"- **{e['d']}{' (date approximative)' if e.get('approx') else ''}** — {e['titre']}. {e['detail']}{refs(e.get('refs'))}" for e in lire("echeances")]

    L += ["", "## 7. Pourquoi chaque note", "", "| Produit | Mesure | Niveau | Pourquoi | Sources |", "|---|---|---|---|---|"]
    for f, fn in meta["familles"].items():
        for p in [p for p in produits if p["f"] == f]:
            n = niveau(p)
            L.append(f"| {cellule(p['n'])} | {valeur(p)} | {meta['niveaux'][str(n)]['nom'] if n else '—'} | {cellule(p.get('pourquoi'))} | {cellule(' ; '.join(ref(i) for i in p.get('refs', [])) or p.get('src', ''))} |")

    L += ["", "## 8. Bibliographie", ""]
    ordre = list(TYPES)
    for b in sorted(biblio, key=lambda b: (ordre.index(b["type"]) if b["type"] in ordre else 99, str(b["date"]))):
        t = f"[{b['titre']}]({b['url']})" if b.get("url") else b["titre"]
        L.append(f"- *{TYPES.get(b['type'], b['type'])}* — {b['auteur']}, {t}, {b['date']}. {b['apport']}")

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"{out} ({len(L)} lignes)")


if __name__ == "__main__":
    main()
