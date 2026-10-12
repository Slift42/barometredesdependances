# Démarrer le Baromètre des dépendances

Même méthode qu'Angor : VS Code, l'outil `gh` déjà connecté à ton compte GitHub, des robots GitHub Actions, `publier.bat` pour envoyer les changements.

Résultat : un dépôt **privé** `barometredesdependances` sur GitHub, le site visible sur ton PC, les données de gaz mises à jour chaque matin. La mise en ligne publique et le domaine OVH viennent dans un second temps (parties 5 et 6).

---

## 1. Tout lancer d'un coup (≈ 2 min)

Dans l'Explorateur Windows, ouvrir le dossier `barometredesdependances` et double-cliquer sur **`demarrer.bat`**.

Il fait, dans l'ordre :
1. installe les robots (`.github\workflows`) et les réglages VS Code (`.vscode`) à partir de `tools\` ;
2. vérifie que Git et `gh` sont installés et connectés ;
3. crée le dépôt Git local et le premier commit ;
4. crée le dépôt **privé** sur GitHub et y envoie le projet.

À la fin, il affiche l'adresse du dépôt. En cas d'erreur, il dit quoi faire ; sinon, copier le message à Claude.

> Pourquoi privé : les chiffres « ≈ » sont des estimations de travail. Le dépôt passera en public au lancement, ce qui sert le discours : la méthode est publique pour pouvoir être contestée.

## 2. Ouvrir dans VS Code et voir le site (≈ 2 min)

1. VS Code → **Fichier > Ouvrir le dossier…** → `barometredesdependances`.
2. Accepter l'installation des **extensions recommandées** (Live Server, Python, GitHub Actions).
3. Cliquer sur **Go Live** en bas à droite : le site s'ouvre sur `http://127.0.0.1:5600` et se recharge à chaque modification.

Les fiches se modifient dans `site\data\produits.json` (format décrit dans le README).

## 3. Brancher le gaz en direct (≈ 5 min)

1. Créer un compte gratuit sur **https://agsi.gie.eu** (*Register*), puis copier la clé d'API affichée dans le profil.
2. Dans le terminal de VS Code (PowerShell), dans le dossier du projet :
   ```
   gh secret set AGSI_API_KEY
   ```
   Coller la clé (elle reste invisible), Entrée.
3. Premier lancement du robot :
   ```
   gh workflow run collecte.yml
   ```
   Suivi : github.com → dépôt → onglet **Actions**. Coche verte = réussi. Le robot repasse ensuite chaque matin vers 9 h.
4. Double-cliquer sur **`publier.bat`** pour récupérer sur le PC les données enregistrées par le robot.

## 3 bis. Résumés automatiques des actus (facultatif)

Le robot de veille lit chaque matin des flux de presse et d'instituts et garde les articles qui touchent un des 100 produits. Ils apparaissent dans « Actus » avec la mention **à vérifier**.
Pour qu'il ajoute une phrase de résumé (comme sur Angor), donner une clé d'API Anthropic :
```
gh secret set ANTHROPIC_API_KEY
```
Au plus 12 résumés par jour. Sans clé, la veille fonctionne quand même, sans résumé.

## 4. Travailler au quotidien

Claude modifie les fichiers sur ton PC → tu vérifies dans le navigateur (Go Live) → double-clic sur **`publier.bat`**.

`publier.bat` récupère d'abord ce que le robot a enregistré en ligne, puis envoie tes changements.

---

## 5. Mettre en ligne (le jour où le comité valide)

Un site GitHub Pages est **public**, même quand le dépôt est privé (sauf abonnement payant). Ne publier qu'après validation.

1. Retirer les garde-fous de la phase de travail :
   - `site\index.html` : supprimer la ligne `<meta name="robots" content="noindex, nofollow">` ;
   - `site\robots.txt` : appliquer la version « lancement » indiquée dans le fichier.
2. Dans le terminal :
   ```
   gh repo edit --visibility public --accept-visibility-change-consequences
   gh variable set PUBLICATION --body oui
   ```
3. github.com → dépôt → **Settings → Pages → Source : GitHub Actions**.
4. **`publier.bat`**. Le site part en ligne sur `https://<identifiant>.github.io/barometredesdependances/`.

## 6. Domaine OVH (deuxième temps)

1. Acheter `barometredesdependances.com` et `barometredesdependances.fr` chez OVHcloud. Avant achat : vérifier sur data.inpi.fr qu'aucune marque n'existe sous ce nom.
2. **Protéger le domaine côté GitHub** : photo de profil → **Settings → Pages → Add a domain** → `barometredesdependances.com`. Ajouter chez OVH l'enregistrement **TXT** affiché, puis **Verify**.
3. Zone DNS OVH du `.com` :
   - supprimer les enregistrements A et AAAA posés par défaut sur le domaine nu ;
   - ajouter 4 enregistrements **A** sur le domaine nu : `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` ;
   - ajouter un **CNAME** `www` → `<identifiant>.github.io.`
4. Dépôt → **Settings → Pages → Custom domain** : `barometredesdependances.com` → **Save**. Après la coche verte, cocher **Enforce HTTPS**.
5. OVH : rediriger le `.fr` vers `https://barometredesdependances.com`.

Pour héberger chez OVH plutôt que sur GitHub Pages : le dossier `site\` se dépose tel quel sur n'importe quel hébergement web (ni base de données ni serveur à faire tourner). Claude adaptera le robot de publication.

---

## Mettre à jour les robots

Quand Claude modifie un fichier `tools\github-actions-*.yml` ou `tools\vscode-*.json`, relancer simplement **`demarrer.bat`** : il recopie tout et envoie la nouvelle version, sans rien recréer.
