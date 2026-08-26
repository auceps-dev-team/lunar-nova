#!/usr/bin/env bash
# bump_version.sh <patch|feature|major>
#
# Synchronise la version dans : package.json (racine + backend), les deux
# package-lock.json, README.md (racine + whatsapp-ai-saas/), index.html,
# build/installer.iss et le placeholder du gabarit de bug — en partant de la
# version du package.json racine.
#
# Modes (alignés sur CONTRIBUTING.md) :
#   patch   (alias : mineur) → +0.0.1  correctif notable
#   feature (alias : minor)  → +0.1.0  nouvelle fonctionnalité / changement de contrat
#   major   (alias : majeur) → +1.0.0  rupture majeure
#
# Les alias « mineur »/« majeur » sont conservés pour compatibilité avec les
# appels historiques (l'ancien script ne connaissait que ces deux noms, mais
# « mineur » faisait en réalité un bump de correctif +0.0.1).
set -euo pipefail
cd "$(dirname "$0")/whatsapp-ai-saas"

MODE="${1:-patch}"
case "$MODE" in
    patch|mineur)   KIND=patch ;;
    feature|minor)  KIND=feature ;;
    major|majeur)   KIND=major ;;
    *) echo "Mode inconnu : $MODE (attendu : patch, feature, major)" >&2; exit 1 ;;
esac

CUR=$(grep '"version"' package.json | head -1 | sed -E 's/.*"version": "([^"]+)".*/\1/')
IFS='.' read -r MAJ MIN PAT <<< "$CUR"
case "$KIND" in
    patch)   PAT=$((PAT + 1)) ;;
    feature) MIN=$((MIN + 1)); PAT=0 ;;
    major)   MAJ=$((MAJ + 1)); MIN=0; PAT=0 ;;
esac
NEW="$MAJ.$MIN.$PAT"
echo "Version : $CUR -> $NEW ($KIND)"

# 1. package.json (racine + backend) et leurs lockfiles (champ racine + entrée "").
sed -i -E "s/\"version\": \"$CUR\"/\"version\": \"$NEW\"/" \
    package.json backend/package.json package-lock.json backend/package-lock.json

# 2. Badges README (racine + imbriqué).
for f in ../README.md README.md; do
    sed -i -E "s/badge\/version-[0-9.]+-blue\.svg\" alt=\"Version [0-9.]+\"/badge\/version-$NEW-blue.svg\" alt=\"Version $NEW\"/" "$f"
    sed -i -E "s/badge\/version-[0-9.]+-blue\.svg/badge\/version-$NEW-blue.svg/" "$f"
done

# 3. Page d'accueil (racine du dépôt).
sed -i -E "s/>Version [0-9.]+</>Version $NEW</" ../index.html

# 4. Installeur Inno Setup.
sed -i -E "s/#define AppVersion   \"[0-9.]+\"/#define AppVersion   \"$NEW\"/" build/installer.iss

# 5. Placeholder du gabarit de bug (anti-dérive : ne doit plus rester figé).
BUGTPL=../.github/ISSUE_TEMPLATE/bug_report.yml
if [ -f "$BUGTPL" ]; then
    sed -i -E "s/placeholder: \"[0-9.]+\"/placeholder: \"$NEW\"/" "$BUGTPL"
fi

# Vérification : plus aucune trace de l'ancienne version dans les fichiers gérés.
grep -rn "$CUR" ../README.md README.md ../index.html build/installer.iss \
    package.json backend/package.json package-lock.json backend/package-lock.json \
    "$BUGTPL" 2>/dev/null | grep -v "$NEW" || true
echo "OK -> $NEW"
