@echo off
REM Envoie vos modifications sur GitHub (comme pour Angor).
cd /d "%~dp0"
REM 1. Recuperer d abord ce que le robot a enregistre en ligne (donnees de gaz, etc.)
git pull --rebase --autostash
REM 2. Envoyer vos modifications
git add -A
git commit -m "Mise a jour %date% %time%"
git push
pause
