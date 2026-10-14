# barometredesdependances.com

Baromètre public des dépendances françaises : de qui la France dépend, sur quoi, pour combien de jours, et avec qui bâtir d'autres alliances.

Même logique technique qu'Angor : un front statique, des données en JSON versionnées dans le dépôt, des collecteurs Python lancés par GitHub Actions, aucune base de données obligatoire pour afficher le site.

## Arborescence

```
site/                      → racine publiée (GitHub Pages ou tout hébergeur statique)
  index.html               → page unique
  assets/style.css         → charte v0.8 : Spectral (titres), Fira Sans (texte), 5 niveaux, une couleur par puissance, clair/sombre
  assets/app.js            → rendu par onglets (accueil, les 100 produits, analyse détaillée, puissances et carte, Europe, actualités, propositions et chiffrage, méthode, sources)
  assets/flags.js          → drapeaux en SVG (flag-icons, MIT), générés par tools/build_carte.js
  data/carte.json          → fond de carte Equal Earth précalculé (Natural Earth), généré par tools/build_carte.js
  data/meta.json           → niveaux, familles, mesures, pistes d'alliance par famille
  data/produits.json       → les 100 produits, tous notés, avec leurs alliances
  data/chaines.json        → 7 chaînes de valeur, maillon par maillon
  data/zoom_armees.json    → dépendances de nos armées (mission AN avril 2026), avec le pays fournisseur (`pays`)
  data/actus.json          → actualités vérifiées par le comité (effet : aggrave / ameliore / surveille)
  data/echeances.json      → prochaines échéances (`approx: true` si la date n'est pas officielle)
  data/bibliographie.json  → toutes les sources citées (identifiants utilisés dans `refs`)
  data/kii.json, strategies.json, matrice.json → leviers, textes et six moyens de pression des puissances (fusionnés à l'écran sur une frise)
  data/europe.json         → chiffres européens (`theme`, `jauge` facultative en %)
  data/allies.json         → choix d'achat des voisins (`acheteurs`, `fournisseurs`, `choix`, `part` en codes ISO)
  data/atouts.json, sources.json, propositions.json
  data/vigie.json          → ancien fil, remplacé par actus.json et echeances.json (plus utilisé)
  data/live/               → écrit par les robots : gaz, electricite, actus_auto, veille_etat, sources_etat
  CNAME                    → barometredesdependances.com
collectors/commun.py       → fonctions partagées (HTTP avec reprises, JSON)
collectors/agsi_gaz.py     → stocks de gaz France (API AGSI+)
collectors/rte_electricite.py → solde des échanges d'électricité sur 7 jours (ODRÉ / RTE éCO2mix)
collectors/veille_actus.py → veille RSS : articles qui touchent un produit, résumé IA facultatif « à vérifier »
collectors/veille_sources.json → flux suivis et mots-clés par produit
tools/verifier_donnees.py  → contrôle de cohérence (bloque la publication en cas d'erreur)
tools/verifier_sources.py  → vérifie chaque lundi que les liens de la bibliothèque répondent
tools/dossier_sources.py   → génère le dossier de sources du comité (Markdown) depuis les données
tools/build_artifact.py    → fabrique un aperçu autonome en un seul fichier HTML (dist/)
tools/build_carte.js       → régénère la carte et les drapeaux (à relancer si un nouveau pays apparaît dans les données)
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
| `cov` | à la place de `d` : part des besoins couverts par la production française, en % |
| `k` | `src` donnée publiée · `calc` calcul sur données publiques · `est` estimation de travail (affichée « ≈ ») |
| `h` | détenteurs du robinet (codes de `meta.json`) |
| `l` | levier : 0 aucun, 1 prise structurelle ou menace, 2 déjà activé (aggrave d'un niveau) |
| `al` | alliances : `type` `redondance` ou `codependance`, `pays`, `txt` |
| `m` | mesure proposée (clé de `meta.mesures`) |
| `live` | branche le produit sur un flux en direct (`gaz`) |
| `gens` | une phrase : ce que ça change pour les gens |
| `refs` | identifiants de `bibliographie.json` qui justifient la note |
| `note`, `note_refs` | encadré « À savoir » et ses sources |
| `lev` | détail du levier (`qui`, `comment`, `quand`, `effet`, `refs`), obligatoire si `l` vaut 1 ou 2 |
| `estim` | pour `k: est` : méthode (`m`, clé de `meta.methodes_estimation`), explication (`txt`), sources |
| `seuil` | seuil légal de stock (clé de `meta.seuils`) ; sous 100 jours, la fiche affiche « Pourquoi seulement N jours ? » |
| `cout` | chiffrage : liste de `{r: remède, lo, hi (M€), per: "u" une fois ou "an" par an, txt, refs, deja}` |

Niveaux calculés automatiquement : Souverain (excédent) · Indépendant (> 365 j) · Résilient (91-365 j) · Dépendant (31-90 j) · Totalement dépendant (≤ 30 j).
Avec `cov` : ≥ 100 % Souverain · 80-99 % Indépendant · 50-79 % Résilient · en dessous, on revient aux jours (ou Dépendant).
Un levier déjà activé (`l: 2`) fait perdre un niveau.

## Drapeaux et carte

Les drapeaux sont dessinés en SVG, car Windows n'affiche pas les drapeaux en émoji. Si un nouveau pays apparaît (détenteur, alliance, armées, alliés, échéance), relancer :

```
npm i --no-save world-atlas@2.0.2 d3-geo@3.1.1 topojson-client@3.1.0 i18n-iso-countries@7.13.0 flag-icons@7.2.3
node tools/build_carte.js
```

Les noms de pays en français (`al.pays`, `chaines.qui`) sont reconnus automatiquement ; les autres champs utilisent les codes ISO à deux lettres (`FR`, `CN`, `US`…), plus `EU` et `DIV` (fournisseurs diversifiés).

## Ajouter une actu

Ajouter en tête de `site/data/actus.json` : `d` (date), `titre`, `texte` (deux ou trois phrases simples), `produits` (identifiants), `effet` (`aggrave`, `ameliore` ou `surveille`), `refs`.
Les articles repérés par le robot (`live/actus_auto.json`) s'affichent avec la mention « à vérifier » ; on les promeut dans `actus.json` une fois relus.

Chaque fiche a son lien direct : `barometredesdependances.com/#gallium`.

## Feuille de route

- [x] Front statique, données JSON, 100 produits, alliances
- [x] Collecteurs AGSI+ (gaz) et RTE (électricité)
- [x] Veille automatique RSS, tri par mots-clés, résumé IA facultatif marqué « à vérifier »
- [x] Contrôle de cohérence avant publication, vérification hebdomadaire des liens
- [ ] Collecteurs : SDES/CPSSP (pétrole), ANSM (ruptures), Douanes/Comext (importations NC8 et pays)
- [ ] Veille des restrictions d'export et sanctions (Global Trade Alert, MOFCOM, JOUE)
- [ ] Back-office du comité (Supabase, comme Angor) : validation des fiches, badge « vérifié »
- [ ] Indice de prise 0-100 (pondérations à valider)
- [ ] Version anglaise, export PDF des fiches, application installable hors ligne
