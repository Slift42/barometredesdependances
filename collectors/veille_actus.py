#!/usr/bin/env python3
"""Veille automatique : lit des flux RSS/Atom, garde les articles qui touchent un produit du baromètre.

Écrit site/data/live/actus_auto.json (affiché sur le site avec la mention « détection automatique, à vérifier »)
et site/data/live/veille_etat.json (santé de chaque source).

Option : si ANTHROPIC_API_KEY est défini, un court résumé en français est demandé à Claude pour
les articles retenus, dans la limite de VEILLE_MAX_IA appels par passage. Ces résumés portent la
mention « IA – à vérifier », comme sur Angor.
"""
import datetime as dt
import email.utils
import hashlib
import html
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

from commun import DATA, LIVE, ROOT, ecrire_json, http_get, lire_json

CONFIG = ROOT / "collectors" / "veille_sources.json"
SORTIE = LIVE / "actus_auto.json"
ETAT = LIVE / "veille_etat.json"
MAX_IA = int(os.environ.get("VEILLE_MAX_IA", "12"))
MODELE = os.environ.get("VEILLE_MODELE", "claude-haiku-5-5")


def texte(el, *noms):
    for n in noms:
        x = el.find(n)
        if x is not None and (x.text or x.attrib.get("href")):
            return (x.text or x.attrib.get("href") or "").strip()
    return ""


def date_iso(s):
    if not s:
        return None
    try:
        return email.utils.parsedate_to_datetime(s).astimezone(dt.timezone.utc).date().isoformat()
    except Exception:
        pass
    m = re.match(r"(\d{4}-\d{2}-\d{2})", s)
    return m.group(1) if m else None


def lire_flux(contenu):
    """Renvoie une liste de dicts {titre, url, date, resume} pour RSS 2.0 ou Atom."""
    racine = ET.fromstring(contenu)
    ns = {"a": "http://www.w3.org/2005/Atom"}
    items = []
    for it in racine.iter("item"):
        items.append({
            "titre": html.unescape(texte(it, "title")),
            "url": texte(it, "link"),
            "date": date_iso(texte(it, "pubDate", "{http://purl.org/dc/elements/1.1/}date")),
            "resume": re.sub(r"<[^>]+>", " ", html.unescape(texte(it, "description")))[:400],
            "source_article": texte(it, "source"),
        })
    for it in racine.iterfind("a:entry", ns):
        lien = it.find("a:link", ns)
        items.append({
            "titre": html.unescape(texte(it, "{http://www.w3.org/2005/Atom}title")),
            "url": lien.attrib.get("href", "") if lien is not None else "",
            "date": date_iso(texte(it, "{http://www.w3.org/2005/Atom}updated", "{http://www.w3.org/2005/Atom}published")),
            "resume": re.sub(r"<[^>]+>", " ", html.unescape(texte(it, "{http://www.w3.org/2005/Atom}summary")))[:400],
            "source_article": "",
        })
    return items


def correspondances(item, mots):
    blob = f"{item['titre']} {item['resume']}".lower()
    trouves = []
    for pid, liste in mots.items():
        for m in liste:
            if re.search(r"(?<!\w)" + re.escape(m.lower()) + r"(?!\w)", blob):
                trouves.append(pid)
                break
    return trouves


def resumer_ia(item, noms):
    cle = os.environ.get("ANTHROPIC_API_KEY")
    if not cle:
        return None
    consigne = (
        "Tu aides un baromètre public des dépendances de la France. En une phrase de 30 mots maximum, "
        "en français simple, dis ce que cette actualité change pour la dépendance de la France sur : "
        + ", ".join(noms) + ". Si l'article ne parle pas vraiment de cela, réponds exactement HORS SUJET.\n\n"
        f"Titre : {item['titre']}\nExtrait : {item['resume']}"
    )
    corps = json.dumps({"model": MODELE, "max_tokens": 120,
                        "messages": [{"role": "user", "content": consigne}]}).encode()
    req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=corps, headers={
        "x-api-key": cle, "anthropic-version": "2023-06-01", "content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            rep = json.load(r)
        txt = "".join(b.get("text", "") for b in rep.get("content", [])).strip()
        return None if not txt or "HORS SUJET" in txt.upper() else txt
    except Exception as e:
        print(f"  résumé IA impossible : {e}", file=sys.stderr)
        return None


def main():
    conf = lire_json(CONFIG, {})
    produits = {p["id"]: p["n"] for p in lire_json(DATA / "produits.json", [])}
    mots = conf.get("mots", {})
    for pid, nom in produits.items():  # le nom du produit sert toujours de mot-clé
        mots.setdefault(pid, []).append(nom.split(" (")[0])
    etat = lire_json(ETAT, {})
    limite = (dt.date.today() - dt.timedelta(days=conf.get("fenetre_jours", 14))).isoformat()
    vus, retenus = set(), []

    for f in conf.get("flux", []):
        st = etat.setdefault(f["id"], {"nom": f["nom"], "erreurs": 0})
        if st.get("erreurs", 0) >= 3:
            st["statut"] = "en pause (3 échecs)"
            continue
        try:
            code, contenu = http_get(f["url"], timeout=20, tries=1)
            if code != 200 or not contenu:
                raise RuntimeError(f"HTTP {code}")
            items = lire_flux(contenu)
            st.update({"statut": "ok", "erreurs": 0, "items": len(items), "derniere": dt.date.today().isoformat()})
        except Exception as e:
            st["erreurs"] = st.get("erreurs", 0) + 1
            st["statut"] = f"erreur : {e}"[:120]
            print(f"✘ {f['nom']} : {e}", file=sys.stderr)
            continue
        for it in items:
            if not it["titre"] or not it["url"] or (it["date"] and it["date"] < limite):
                continue
            cle = hashlib.sha1(re.sub(r"\W+", "", it["titre"].lower())[:80].encode()).hexdigest()[:12]
            if cle in vus:
                continue
            pids = correspondances(it, mots)
            if not pids:
                continue
            vus.add(cle)
            retenus.append({"id": cle, "d": it["date"] or dt.date.today().isoformat(), "titre": it["titre"],
                            "url": it["url"], "source": it["source_article"] or f["nom"], "type": f["type"],
                            "produits": sorted(set(pids))[:6], "auto": True})
        print(f"✔ {f['nom']} : {len(items)} articles lus")

    retenus.sort(key=lambda x: x["d"], reverse=True)
    retenus = retenus[: conf.get("max_items", 60)]

    anciens = {a["id"]: a for a in lire_json(SORTIE, {}).get("items", [])}
    appels = 0
    for a in retenus:
        if a["id"] in anciens and anciens[a["id"]].get("resume_ia"):
            a["resume_ia"] = anciens[a["id"]]["resume_ia"]
        elif appels < MAX_IA and os.environ.get("ANTHROPIC_API_KEY"):
            appels += 1
            r = resumer_ia({"titre": a["titre"], "resume": ""}, [produits.get(p, p) for p in a["produits"]])
            if r:
                a["resume_ia"] = r

    ecrire_json(SORTIE, {"maj": dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes"), "items": retenus})
    ecrire_json(ETAT, etat)
    print(f"{len(retenus)} actualités retenues, {appels} résumés IA demandés.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
