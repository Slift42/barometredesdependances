# Baromètre des dépendances — consignes pour Claude

Site public du comité Relations internationales (programme de François Ruffin, 2027) : barometredesdependances.com.
Il mesure, produit par produit, de qui la France dépend, pour combien de jours, et avec qui bâtir d'autres alliances.

## Architecture
- Front statique sans framework : `site/index.html`, `site/assets/style.css`, `site/assets/app.js`.
- Toutes les données sont dans `site/data/*.json` ; `app.js` les charge par `fetch` (ou depuis `window.BD_DATA` dans l'aperçu autonome).
- Collecteurs Python (bibliothèque standard uniquement) dans `collectors/`, lancés par `.github/workflows/collecte.yml`. Ils écrivent dans `site/data/live/`.
- `tools/build_artifact.py` produit un aperçu en un seul fichier dans `dist/` (ignoré par Git).
- Les robots et les réglages VS Code vivent dans `tools/github-actions-*.yml` et `tools/vscode-*.json` : Claude ne peut pas écrire dans `.github/` ni `.vscode/` sur le PC. Modifier les copies dans `tools/`, puis demander de relancer `demarrer.bat` (il recopie et envoie).
- Envoi des changements : `publier.bat` (comme pour Angor). Outil GitHub : `gh`, déjà connecté.
- Même philosophie que le projet Angor (`../veille-surete`).

## Règles de contenu
- Chaque chiffre porte sa nature : `src` (donnée publiée), `calc` (calcul sur données publiques), `est` (estimation, affichée « ≈ »). Ne jamais présenter une estimation comme une donnée.
- Toute donnée `src` ou `calc` cite une source vérifiable dans le champ `src`.
- Niveaux calculés, jamais saisis : Souverain (excédent) · Indépendant (> 365 j) · Résilient (91-365 j) · Dépendant (31-90 j) · Totalement dépendant (≤ 30 j). Avec `cov` (part couverte) : ≥ 100 % Souverain, ≥ 80 % Indépendant, ≥ 50 % Résilient. Un levier déjà activé (`l: 2`) aggrave d'un niveau.
- Toute justification cite ses sources par identifiant (`refs`) de `bibliographie.json`. Préférer institutions, Parlement, instituts de recherche ; la presse seulement pour dater un fait.
- Actus : `actus.json` = vérifiées par le comité ; `live/actus_auto.json` = robot, toujours affichées « à vérifier ». Ne jamais promouvoir un article automatique sans l'avoir lu.
- Citations de François Ruffin : uniquement des phrases publiées, avec la référence. Ne jamais en inventer ni en reformuler entre guillemets.
- Alliances (`al`) : `redondance` (plusieurs fournisseurs) ou `codependance` (échange réciproque).
- Langue : français, phrases courtes, mots concrets (le robinet, la pharmacie du coin, l'usine), ton factuel. Pas de jargon ni de formules creuses. Pas de métaphore météo.

## Vérifications avant chaque commit
- `python3 tools/verifier_donnees.py` (0 erreur exigée).
- `node --check site/assets/app.js` si le JS a changé.
- Ouvrir le site en local (Live Server, port 5600) et vérifier le mur des 100 et une fiche.

## Publication
- Le site reste en `noindex` et la publication GitHub Pages est désactivée tant que la variable de dépôt `PUBLICATION` ne vaut pas `oui` (voir DEMARRAGE.md).
