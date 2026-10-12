#!/usr/bin/env python3
"""Assemble une version autonome (un seul fichier HTML) du site pour l'aperçu.

Usage : python3 tools/build_artifact.py [sortie.html]
Le CSS, le JS et toutes les données JSON sont intégrés ; le fichier s'ouvre sans serveur.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
FILES = ["meta", "produits", "matrice", "atouts", "sources", "propositions", "bibliographie", "kii", "europe", "allies", "strategies",
         "chaines", "actus", "echeances", "zoom_armees"]
LIVE = ["gaz", "electricite", "actus_auto", "veille_etat", "sources_etat"]


def between(text, start, end):
    i, j = text.index(start), text.index(end)
    return text[i + len(start):j]


def main():
    out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist" / "barometre-dependances.html"
    html = (SITE / "index.html").read_text(encoding="utf-8")
    title = re.search(r"<title>.*?</title>", html, re.S).group(0)
    head = between(html, "<!--HEAD-START-->", "<!--HEAD-END-->").strip()
    body = between(html, "<!--BODY-START-->", "<!--BODY-END-->").strip()
    css = (SITE / "assets" / "style.css").read_text(encoding="utf-8")
    js = (SITE / "assets" / "app.js").read_text(encoding="utf-8")

    data = {f: json.loads((SITE / "data" / f"{f}.json").read_text(encoding="utf-8")) for f in FILES}
    data["live"] = {}
    for f in LIVE:  # données collectées par les robots, si elles existent déjà
        chemin = SITE / "data" / "live" / f"{f}.json"
        if chemin.exists():
            data["live"][f] = json.loads(chemin.read_text(encoding="utf-8"))
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")

    page = "\n".join([
        title, head, f"<style>\n{css}</style>", body,
        f"<script>window.BD_DATA = {payload};</script>",
        f"<script>\n{js}</script>",
    ])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    print(f"{out} ({len(page) // 1024} Ko)")


if __name__ == "__main__":
    main()
