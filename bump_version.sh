#!/usr/bin/env bash
# bump_version.sh <patch|feature|major>
#
# Synchronise la version dans les 9 sources, depuis la version du package.json
# racine (whatsapp-ai-saas/package.json) :
#   - package.json                      (racine applicative)
#   - backend/package.json
#   - package-lock.json                 (racine applicative)
#   - backend/package-lock.json
#   - README.md                         (racine du dépôt)
#   - whatsapp-ai-saas/README.md        (README imbriqué)
#   - index.html
#   - build/installer.iss
#   - .github/ISSUE_TEMPLATE/bug_report.yml (placeholder de version)
#
# Modes :
#   patch   -> Z+1   (correctif / changement de comportement)
#   feature -> Y+1   (nouvelle fonctionnalité / changement de contrat)
#   major   -> X+1   (rupture de compatibilité)
set -euo pipefail
cd "$(dirname "$0")/whatsapp-ai-saas"

MODE="${1:-patch}"
CUR=$(grep '"version"' package.json | head -1 | sed -E 's/.*"version": "([^"]+)".*/\1/')
IFS='.' read -r MAJ MIN PAT <<< "$CUR"
case "$MODE" in
  patch)   PAT=$((PAT + 1)) ;;
  feature) MIN=$((MIN + 1)); PAT=0 ;;
  major)   MAJ=$((MAJ + 1)); MIN=0; PAT=0 ;;
  *) echo "Usage: $0 <patch|feature|major>" >&2; exit 1 ;;
esac
NEW="$MAJ.$MIN.$PAT"
echo "Version : $CUR -> $NEW ($MODE)"

# package.json + backend/package.json (champ "version" racine)
sed -i -E "s/\"version\": \"$CUR\"/\"version\": \"$NEW\"/" package.json backend/package.json

# lockfiles : seul le "version" racine (indentation 2 espaces) est visé,
# les versions de dépendances (indentation 4+ espaces) sont préservées.
sed -i -E "s/^  \"version\": \"$CUR\",/  \"version\": \"$NEW\",/" package-lock.json backend/package-lock.json

# Badges de version des deux README (racine + imbriqué)
for f in ../README.md README.md; do
  sed -i -E "s/badge\/version-[0-9.]+\-blue\.svg\" alt=\"Version [0-9.]+\"/badge\/version-$NEW-blue.svg\" alt=\"Version $NEW\"/" "$f"
  sed -i -E "s/badge\/version-[0-9.]+\-blue\.svg/badge\/version-$NEW-blue.svg/" "$f"
done

# index.html + installer InnoSetup
sed -i -E "s/>Version [0-9.]+</>Version $NEW</" ../index.html
sed -i -E "s/#define AppVersion   \"[0-9.]+\"/#define AppVersion   \"$NEW\"/" build/installer.iss

# Placeholder de version du gabarit de bug GitHub
sed -i -E "s/(placeholder: \")[0-9.]+\"/\1$NEW\"/" ../.github/ISSUE_TEMPLATE/bug_report.yml

echo "OK -> $NEW"
