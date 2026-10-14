# Baromètre des dépendances — consignes pour Claude

Site public du comité Relations internationales (programme de François Ruffin, 2027) : barometredesdependances.com.
Il mesure, produit par produit, de qui la France dépend, pour combien de jours, et avec qui bâtir d'autres alliances.

## Architecture
- Front statique sans framework : `site/index.html`, `site/assets/style.css`, `site/assets/app.js`. Le site est découpé en onglets (`.view`) ; l'adresse `#identifiant` ouvre l'onglet qui contient la section, ou la fiche du produit.
- Toutes les données sont dans `site/data/*.json` ; `app.js` les charge par `fetch` (ou depuis `window.BD_DATA` dans l'aperçu autonome).
- Collecteurs Python (bibliothèque standard uniquement) dans `collectors/`, lancés par `.github/workflows/collecte.yml`. Ils écrivent dans `site/data/live/`.
- `tools/build_artifact.py` produit un aperçu en un seul fichier dans `dist/` (ignoré par Git).
- Drapeaux (`site/assets/flags.js`) et carte (`site/data/carte.json`) sont générés par `tools/build_carte.js` : le relancer si un nouveau pays apparaît.
- Charte v0.8 : Spectral pour les titres, Fira Sans pour le texte, Fira Sans Condensed pour les chiffres. Niveaux (vert profond → lie-de-vin) et couleurs des puissances (Chine, États-Unis, Russie) validés pour le daltonisme, en clair et en sombre. Pas de hachures : une estimation se signale par « ≈ ».
- Les robots et les réglages VS Code vivent dans `tools/github-actions-*.yml` et `tools/vscode-*.json` : Claude ne peut pas écrire dans `.github/` ni `.vscode/` sur le PC. Modifier les copies dans `tools/`, puis demander de relancer `demarrer.bat` (il recopie et envoie).
- Envoi des changements : `publier.bat` (comme pour Angor). Outil GitHub : `gh`, déjà connecté.
- Même philosophie que le projet Angor (`../veille-surete`).

## Règles de contenu
- Chaque chiffre porte sa nature : `src` (donnée publiée), `calc` (calcul sur données publiques), `est` (estimation, affichée « ≈ »). Ne jamais présenter une estimation comme une donnée.
- Toute donnée `src` ou `calc` cite une source vérifiable dans le champ `src`.
- Niveaux calculés, jamais saisis : Souverain (excédent) · Indépendant (> 365 j) · Résilient (91-365 j) · Dépendant (31-90 j) · Totalement dépendant (≤ 30 j). Avec `cov` (part couverte) : ≥ 100 % Souverain, ≥ 80 % Indépendant, ≥ 50 % Résilient. Un levier déjà activé (`l: 2`) aggrave d'un niveau.
- Toute justification s'appuie sur des `preuves` : `{ref, loc, cit}` avec la source (identifiant de `bibliographie.json`), l'endroit précis (page, point, tableau, section) et une citation mot pour mot (125 caractères au plus). Source anglaise : citation originale dans `cit`, traduction dans `fr`. Extrait de tableau : `tab: true`. `src_i` désigne la preuve qui porte le chiffre principal. Préférer institutions, Parlement, instituts de recherche ; la presse seulement pour dater un fait.
- Le site est public : aucune mention de notes internes, de « comité » ou d'annexes de travail. Le site parle en « nous » (le baromètre).
- Ne citer entre guillemets que des phrases vérifiées dans le texte source. Si on n'a pas pu vérifier, on paraphrase sans guillemets (`sub: true`) ou on retire.
- Actus : `actus.json` = vérifiées par le comité ; `live/actus_auto.json` = robot, toujours affichées « à vérifier ». Ne jamais promouvoir un article automatique sans l'avoir lu.
- Citations de François Ruffin : uniquement des phrases publiées, avec la référence. Ne jamais en inventer ni en reformuler entre guillemets.
- Toute estimation (`k: est`) dit sa méthode dans `estim` (clé de `meta.methodes_estimation`) et ses sources. Une méthode « hypothèse de travail » se dit telle.
- Tout levier (`l` ≥ 1) est détaillé dans `lev` : par qui, comment, quand, quels effets, sources.
- Chiffrage (`cout`) : fourchettes en M€, jamais un chiffre précis inventé. Un coût publié (usine, rachat, fonds) cite sa source ; sinon le texte dit « notre estimation ». Ce qui est déjà financé porte `deja: true`.
- Alliances (`al`) : `redondance` (plusieurs fournisseurs) ou `codependance` (échange réciproque).
- Langue : français, phrases courtes mais complètes (sujet, verbe, complément), mots concrets (la pharmacie du coin, l'usine), ton factuel. Pas de jargon ni de formules creuses. Pas de métaphore météo. Les titres disent clairement ce que montre la section (pas de « robinet » ni de « maillons » dans les titres).
- Une alliance (`al.txt`) est une proposition : la formuler au conditionnel ou avec « peut », « doit », jamais comme un fait accompli.
- Chaque section porte un bouton « i » (`data-info`) dont le texte est dans `INFO` (app.js) : y mettre la méthode plutôt que dans le corps de la page.

## Vérifications avant chaque commit
- `python3 tools/verifier_donnees.py` (0 erreur exigée).
- `node --check site/assets/app.js` si le JS a changé.
- Ouvrir le site en local (Live Server, port 5600) et vérifier le mur des 100 et une fiche.

## Publication
- Le site reste en `noindex` et la publication GitHub Pages est désactivée tant que la variable de dépôt `PUBLICATION` ne vaut pas `oui` (voir DEMARRAGE.md).
