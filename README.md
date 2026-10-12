# barometredesdependances.com

Baromètre public des dépendances françaises : de qui la France dépend, sur quoi, pour combien de jours, et avec qui bâtir d'autres alliances.

Même logique technique qu'Angor : un front statique, des données en JSON versionnées dans le dépôt, des collecteurs Python lancés par GitHub Actions, aucune base de données obligatoire pour afficher le site.

## Arborescence

```
site/                      → racine publiée (GitHub Pages ou tout hébergeur statique)
  index.html               → page unique
  assets/style.css         → thème clair/sombre, 5 niveaux de dépendance
  assets/app.js            → rendu (cadran, mur des 100, ligne de flottaison, fiches, matrice, vigie)
  data/meta.json           → niveaux, familles, mesures, pistes d'alliance par famille
  data/produits.json       → les 100 produits (39 instruits) avec leurs alliances
  data/matrice.json        → « Qui tient le robinet ? » (6 vecteurs × 3 puissances)
  data/vigie.json          → signaux, échéances, publications
  data/atouts.json, sources.json, propositions.json
  data/live/gaz.json       → écrit chaque jour par le collecteur AGSI+
  CNAME                    → barometredesdependances.com
collectors/agsi_gaz.py     → stocks de gaz France (API AGSI+)
tools/build_artifact.py    → fabrique un aperçu autonome en un seul fichier HTML (dist/)
tools/github-actions-*.yml → robots (copiés dans .github/workflows par demarrer.bat)
tools/vscode-*.json        → réglages VS Code (copiés dans .vscode par demarrer.bat)
demarrer.bat               → démarrage en un double-clic (robots, Git, dépôt GitHub privé)
publier.bat                → envoie les modifications (comme pour Angor)
```

## Démarrer

Double-cliquer sur **`demarrer.bat`**, puis suivre **[DEMARRAGE.md](DEMARRAGE.md)** : aperçu dans VS Code (bouton « Go Live »), gaz en direct, travail quotidien avec `publier.bat`, mise en ligne, domaine OVH.

Garde-fous de la phase de travail :
- le site est en `noindex` et `robots.txt` bloque les moteurs de recherche ;
- la publication GitHub Pages ne part que si la variable de dépôt `PUBLICATION` vaut `oui`.

Aperçu sans serveur : `python3 tools/build_artifact.py` puis ouvrir `dist/barometre-dependances.html`.

## Ajouter ou instruire un produit

Éditer l'entrée dans `site/data/produits.json`. Champs :

| Champ | Sens |
|---|---|
| `d` | jours de tenue (nombre) ou `"auto"` si production nationale excédentaire |
| `k` | `src` donnée publiée · `calc` calcul sur données publiques · `est` estimation de travail (affichée « ≈ ») |
| `h` | détenteurs du robinet (codes de `meta.json`) |
| `l` | levier : 0 aucun, 1 prise structurelle ou menace, 2 déjà activé (aggrave d'un niveau) |
| `al` | alliances : `type` `redondance` ou `codependance`, `pays`, `txt` |
| `m` | mesure proposée (clé de `meta.mesures`) |
| `live` | branche le produit sur un flux en direct (`gaz`) |

Niveaux calculés automatiquement : Souverain (excédent) · Indépendant (> 365 j) · Résilient (91-365 j) · Dépendant (31-90 j) · Totalement dépendant (≤ 30 j).

Chaque fiche a son lien direct : `barometredesdependances.com/#gallium`.

## Feuille de route

- [x] Front statique, données JSON, 100 produits, alliances
- [x] Collecteur AGSI+ (gaz)
- [ ] Collecteurs : SDES/CPSSP (pétrole), RTE (électricité), ANSM (ruptures), Douanes/Comext (importations NC8 et pays)
- [ ] Veille automatique des restrictions d'export et sanctions (Global Trade Alert, MOFCOM, JOUE), tri par IA marqué « à vérifier »
- [ ] Back-office du comité (Supabase, comme Angor) : validation des fiches, badge « vérifié »
- [ ] Indice de prise 0-100 (pondérations à valider)
- [ ] Version anglaise, export PDF des fiches, application installable hors ligne
