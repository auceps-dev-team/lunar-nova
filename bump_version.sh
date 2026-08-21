#!/usr/bin/env bash
# bump_version.sh <majeur|mineur>
# Synchronise la version dans : package.json, backend/package.json, README.md,
# index.html, build/installer.iss — en partant de la version du package.json racine.
set -euo pipefail
cd "$(dirname "$0")/whatsapp-ai-saas"

MODE="${1:-mineur}"
CUR=$(grep '"version"' package.json | head -1 | sed -E 's/.*"version": "([^"]+)".*/\1/')
IFS='.' read -r MAJ MIN PAT <<< "$CUR"
if [ "$MODE" = "majeur" ]; then
  MAJ=$((MAJ + 1)); MIN=0; PAT=0
else
  PAT=$((PAT + 1))
fi
NEW="$MAJ.$MIN.$PAT"
echo "Version : $CUR -> $NEW ($MODE)"

sed -i -E "s/\"version\": \"$CUR\"/\"version\": \"$NEW\"/" package.json backend/package.json
sed -i -E "s/badge\/version-[0-9.]+-blue\.svg\" alt=\"Version [0-9.]+\"/badge\/version-$NEW-blue.svg\" alt=\"Version $NEW\"/" ../README.md
sed -i -E "s/badge\/version-[0-9.]+-blue\.svg/badge\/version-$NEW-blue.svg/" ../README.md
sed -i -E "s/>Version [0-9.]+</>Version $NEW</" ../index.html
sed -i -E "s/#define AppVersion   \"[0-9.]+\"/#define AppVersion   \"$NEW\"/" build/installer.iss
grep -rn "$CUR" ../README.md ../index.html build/installer.iss package.json backend/package.json 2>/dev/null | grep -v "$NEW" || true
echo "OK -> $NEW"
