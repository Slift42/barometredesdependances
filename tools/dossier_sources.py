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
TYPES = {"institution": "institution", "etat": "pays producteurs", "parlement": "parlement", "doctrine": "leurs textes", "expertise": "expertise",
         "programme": "programme", "donnees": "données", "ong": "ONG", "presse": "presse"}


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
    if b == 1 and p.get("intrants"):
        b = 2  # excédentaire mais dépendant d'intrants importés : indépendant, pas souverain
    if b > 1 and p.get("reloc") and isinstance(p.get("d"), (int, float)) and p["d"] >= p["reloc"]:
        b = 1  # stocks plus longs que le délai de relocalisation
    if p.get("l") == 2 and 1 < b < 5:
        b += 1
    return b


def valeur(p):
    a = "≈ " if p.get("k") == "est" else ""
    if "cov" in p:
        return f"{a}{p['cov']} % couverts"
    if p.get("d") == "auto":
        return "Excédent"
    return f"{a}{p['d']} j" if "d" in p else "à instruire"


def cellule(t):
    return str(t or "").replace("|", "/").replace("\n", " ")


def main():
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist" / "dossier-sources.md"
    L = [f"# Baromètre des dépendances — dossier de sources (v{meta['version']}, {meta['maj']})", "",
         "Généré automatiquement depuis les données du site (`tools/dossier_sources.py`). Les chiffres « ≈ » sont des estimations, signalées comme telles.", ""]

    # synthèse
    notes = [p for p in produits if niveau(p)]
    sv = meta.get("souverainete")
    if sv:
        L += [f"## {sv['titre']}", "", sv["def"], ""] + [f"- **{t}** {x}" for t, x in sv["points"]] + [""]
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
    L += ["## 2. Les leviers qu'ils ont déjà utilisés", "", K["intro"], ""]
    for x in K["puissances"]:
        L += [f"### {x['nom']}", "", x["resume"], ""]
        for l in x["leviers"]:
            L.append(f"- **{l['titre']}** ({l['vecteur']}, {l['date']}, {'assumé' if l['assume'] else 'documenté'}). {l['preuve']} Effet : {l['effet']}{refs(l.get('refs'))}")
        L.append("")

    L += ["## 3. Ce que la dépendance coûte à l'Europe", ""]
    L += [f"- **{c['chiffre']} {c['titre']}.** {c['texte']}{refs(c.get('refs'))}" for c in lire("europe")]
    L += ["", "## 4. Ce que choisissent nos voisins", ""]
    L += [f"- **{a['domaine']}** ({'ils font autrement' if a['sens'] == 'contre-exemple' else 'réflexe de dépendance'}). {a['comportement']} {a['cout']}{refs(a.get('refs'))}" for a in lire("allies")]

    L += ["", "## 5. Les filières, étape par étape", ""]
    for c in lire("chaines"):
        L += [f"### {c['titre']}", "", c["intro"], ""]
        L += [f"{k + 1}. **{s['nom']}** — {s['qui']} : {s['part']} ({meta['niveaux'][str(s['lv'])]['nom']}).{refs(s.get('refs'))}" for k, s in enumerate(c["etapes"])]
        L.append("")
    Z = lire("zoom_armees")
    L += [f"### {Z['titre']}", "", Z["intro"], ""]
    L += [f"- **{x['quoi']}** ({meta['niveaux'][str(x['lv'])]['nom']}, fournisseur : {', '.join(x.get('pays', []))}). {x['constat']}" for x in Z["items"]]
    L += ["", refs(Z.get("refs")).strip(), ""]

    L += ["## 6. Actualités vérifiées et échéances", ""]
    eff = {"aggrave": "la situation s'aggrave", "ameliore": "la situation s'améliore", "surveille": "à surveiller"}
    L += [f"- **{a['d']} — {a['titre']}** ({eff.get(a['effet'], a['effet'])}). {a['texte']}{refs(a.get('refs'))}" for a in lire("actus")]
    L += ["", "Échéances :", ""]
    L += [f"- **{e['d']}{' (date approximative)' if e.get('approx') else ''}** — {e['titre']}. {e['detail']}{refs(e.get('refs'))}" for e in lire("echeances")]

    L += ["", "## 7. Pourquoi chaque note, preuves à l'appui", ""]
    for f, fn in meta["familles"].items():
        L += [f"### {fn}", ""]
        for p in [p for p in produits if p["f"] == f]:
            n = niveau(p)
            L += [f"**{p['n']}** — {valeur(p)}, {meta['niveaux'][str(n)]['nom'] if n else '—'}", "", p.get("pourquoi", ""), ""]
            if p.get("amont"):
                L += [f"Pourquoi pas souverain : {p['amont']['txt']} (intrants : {', '.join(p.get('intrants', []))}){refs(p['amont'].get('refs'))}", ""]
            for pr in p.get("preuves", []):
                b = B.get(pr["ref"], {})
                cit = pr["cit"] if pr.get("tab") else f"« {pr.get('fr') or pr['cit']} »"
                lien = f"[{b.get('auteur', pr['ref']).split(' (')[0]}, {b.get('titre', '')}]({b['url']})" if b.get("url") else b.get("auteur", pr["ref"])
                L.append(f"- {cit} — {lien}, {pr.get('loc', '')}" + (" (traduit de l'anglais)" if pr.get("fr") else ""))
            L.append("")

    L += ["", "## 8. Les leviers, produit par produit", ""]
    for p in [p for p in produits if p.get("lev")]:
        x = p["lev"]
        L.append(f"- **{p['n']}** ({meta['leviers'][str(p['l'])].lower()}). Par qui : {x['qui']}. Comment : {x['comment']}"
                 + (f" Quand : {x['quand']}." if x.get("quand") and x["quand"] != "—" else "") + f" Effet : {x['effet']}{refs(x.get('refs'))}")

    met = meta.get("methodes_estimation", {})
    L += ["", "## 9. Les estimations et leur méthode", ""]
    for k, m in met.items():
        L += [f"### {m['nom']} (confiance {m['conf']})", "", m["desc"], ""]
        L += [f"- **{p['n']}** ({valeur(p)}) : {p['estim']['txt']}{refs(p['estim'].get('refs'))}" for p in produits if p.get("estim", {}).get("m") == k]
        L.append("")

    L += ["## 10. Seuils légaux de stock", ""]
    for k, sv in meta.get("seuils", {}).items():
        L += [f"### {sv['titre']} ({sv['court']})", ""]
        L += [f"- **{t}** {x}{refs(r)}" for t, x, r in sv["points"]]
        L += ["", sv["conclusion"], "", "Produits concernés : " + ", ".join(p["n"] for p in produits if p.get("seuil") == k) + ".", ""]

    co = meta.get("couts", {})
    L += ["## 11. Le coût de l'indépendance", "", co.get("intro", ""), ""]
    L += [f"- **{t}** {x}" for t, x in co.get("methode", [])]
    L += ["", "| Produit | Remède | Montant (M€) | Nature | Comment | Sources |", "|---|---|---|---|---|---|"]
    for p in produits:
        for c in p.get("cout", []):
            nat = "déjà engagé" if c.get("deja") else ("par an" if c["per"] == "an" else "une fois")
            mt = f"{c['lo']}" if c["lo"] == c["hi"] else f"{c['lo']} à {c['hi']}"
            L.append(f"| {cellule(p['n'])} | {meta['remedes'].get(c['r'], c['r'])} | {mt} | {nat} | {cellule(c['txt'])} | {cellule(' ; '.join(ref(i) for i in c.get('refs', [])))} |")

    NOMS = lire("carte").get("noms", {}) if (DATA / "carte.json").exists() else {}
    nomp = lambda c: "Autres pays" if c == "ZZ" else meta["detenteurs"].get(c) or NOMS.get(c, c)
    PA = lire("partenaires") if (DATA / "partenaires.json").exists() else {"matieres": []}
    L += ["", "## 12. Les partenaires de demain", "", "Production et réserves par pays (USGS 2026 ; World Nuclear Association pour l'uranium). Parts calculées sur l'année la plus récente.", ""]
    for m in PA["matieres"]:
        k = len(m["annees"]) - 1; w = m["monde"][k]
        rows = sorted(((c, v[k]) for c, v in m["prod"].items() if v[k]), key=lambda x: -x[1])
        hhi = round(sum((v / w * 100) ** 2 for c, v in rows if c != "ZZ"))
        imp = sum(v for c, v in rows if c in ("CN", "RU")) / w
        L += [f"### {m['nom']} ({m['annees'][k]}, {m['unite']})", "", f"Indice de concentration : {hhi} points. Chine et Russie : {imp:.0%} de la production.{refs(m['refs'])}", ""]
        L += ["| Pays | Production | Part | Réserves |", "|---|---|---|---|"]
        for c, v in rows:
            r = (m.get("res") or {}).get(c)
            L.append(f"| {nomp(c)} | {v:,} | {v / w:.1%} | {f'{r:,}' if r else ''} |".replace(",", " "))
        L.append("")
        for x in m["partenaires"]:
            L += [f"- **{nomp(x['c'])}**{' (prudence)' if x.get('prudence') else ''} — {x['role']}. {x['txt']} {('À surveiller : ' + x['risque']) if x.get('risque') else ''}{refs(x.get('refs'))}"]
            for pr in x.get("projets", []):
                L.append(f"  - {pr['nom']} : {pr['txt']}{refs(pr.get('refs'))}")
        L += [f"- Note : {n}" for n in m.get("notes", [])] + [""]

    PY = lire("pays") if (DATA / "pays.json").exists() else {}
    if PY:
        cont = {c: k for k, v in PY["continents"].items() for c in v}
        L += ["", "## 13. Les pays producteurs : décisions, partenariats, écarts entre sources", ""]
        L += ["### Part de l'Afrique dans la production mondiale", "", "| Matière | Année | Part de l'Afrique | Premier producteur africain |", "|---|---|---|---|"]
        for m in PA["matieres"]:
            k = len(m["annees"]) - 1; w = m["monde"][k]
            af = sorted(((c, v[k]) for c, v in m["prod"].items() if cont.get(c) == "Afrique" and v[k]), key=lambda x: -x[1])
            L.append(f"| {m['nom']} | {m['annees'][k]} | {sum(v for _, v in af) / w:.0%} | {nomp(af[0][0]) + f' ({af[0][1] / w:.0%})' if af else '—'} |")
        L += ["", "### Décisions des pays producteurs", ""]
        for d in sorted(PY["dossiers"], key=lambda d: (list(PY["continents"]).index(cont.get(d["c"], "Europe")), nomp(d["c"]))):
            L += [f"**{nomp(d['c'])}** ({cont.get(d['c'], '')}). {d['resume']}", ""]
            for x in sorted(d["mesures"], key=lambda x: x["date"], reverse=True):
                L.append(f"- {x['date']} — {PY['types'][x['type']]} ({x['statut']}). {x['txt']}{refs(x.get('refs'))}")
            for lab, key in (("Notre calcul", "calcul"), ("Vérification", "verif"), ("Notre lecture", "lecture")):
                if d.get(key): L.append(f"- {lab} : {d[key]}")
            if d.get("refs"): L.append(f"- {refs(d['refs']).strip()}")
            L.append("")
        L += ["### Partenariats de l'Union européenne sur les matières premières", ""]
        L += [f"- {nomp(c)} : {dt}{' (' + st + ')' if st else ''}" for c, dt, st in sorted(PY["ue"], key=lambda u: u[1])]
        L += [f"{refs(PY.get('ue_refs')).strip()}", "", "### Écarts entre sources", "", "| Sujet | Source A | Source B | Verdict | Explication |", "|---|---|---|---|---|"]
        V = {"accord": "concordent", "ecart": "divergent", "incomparable": "non comparables"}
        for e in PY["ecarts"]:
            L.append(f"| {e['titre']} | {e['a'][0]} : {e['a'][1]} ({ref(e['a'][2])}) | {e['b'][0]} : {e['b'][1]} ({ref(e['b'][2])}) | {V[e['verdict']]} | {e['txt']} |")
    L += ["", "## 14. Bibliographie", ""]
    ordre = list(TYPES)
    for b in sorted(biblio, key=lambda b: (ordre.index(b["type"]) if b["type"] in ordre else 99, str(b["date"]))):
        t = f"[{b['titre']}]({b['url']})" if b.get("url") else b["titre"]
        L.append(f"- *{TYPES.get(b['type'], b['type'])}* — {b['auteur']}, {t}, {b['date']}. {b['apport']}")

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"{out} ({len(L)} lignes)")


if __name__ == "__main__":
    main()
