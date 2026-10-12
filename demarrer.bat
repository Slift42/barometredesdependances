@echo off
REM Demarrage du projet : robots, depot Git local, depot GitHub prive. A lancer une seule fois.
cd /d "%~dp0"

echo.
echo === 1/4  Installation des robots et des reglages VS Code ===
if not exist .github\workflows mkdir .github\workflows
copy /Y tools\github-actions-collecte.yml .github\workflows\collecte.yml >nul
copy /Y tools\github-actions-publication.yml .github\workflows\publication.yml >nul
if not exist .vscode mkdir .vscode
copy /Y tools\vscode-settings.json .vscode\settings.json >nul
copy /Y tools\vscode-extensions.json .vscode\extensions.json >nul
if exist a-installer rmdir /s /q a-installer
echo OK

echo.
echo === 2/4  Verification des outils ===
where git >nul 2>&1
if errorlevel 1 (
  echo Git est introuvable. Installez-le : winget install -e --id Git.Git , puis relancez ce fichier.
  pause & exit /b 1
)
where gh >nul 2>&1
if errorlevel 1 (
  echo L'outil GitHub est introuvable. Installez-le : winget install -e --id GitHub.cli , puis relancez ce fichier.
  pause & exit /b 1
)
gh auth status >nul 2>&1
if errorlevel 1 (
  echo Vous n'etes pas connecte a GitHub. Tapez : gh auth login , puis relancez ce fichier.
  pause & exit /b 1
)
echo OK

echo.
echo === 3/4  Depot Git local ===
if not exist .git git init -b main
git add -A
git commit -m "Barometre des dependances : demarrage" >nul 2>&1
git rev-parse HEAD >nul 2>&1
if errorlevel 1 (
  echo Git ne connait pas encore votre nom. Tapez : git config --global user.name "Stef" puis git config --global user.email "votre-adresse-github" , puis relancez ce fichier.
  pause & exit /b 1
)
git log --oneline -1

echo.
echo === 4/4  Depot GitHub (prive) ===
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  gh repo create barometredesdependances --private --source . --push
) else (
  git pull --rebase --autostash origin main
  git push -u origin main
)
if errorlevel 1 (
  echo L'envoi vers GitHub a echoue : copiez le message ci-dessus a Claude.
  pause & exit /b 1
)

echo.
echo Termine. Votre depot :
gh repo view --json url -q .url
echo.
echo Etape suivante : voir DEMARRAGE.md, partie 3 (cle AGSI pour le gaz en direct).
pause
