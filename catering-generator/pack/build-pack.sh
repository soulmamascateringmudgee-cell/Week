#!/usr/bin/env bash
#
# Builds the zip you send a buyer.
#
#   ./build-pack.sh
#
# Refuses to build while any [PLACEHOLDER] is still unfilled, so a licence with
# no ABN on it can't accidentally go out the door.

set -euo pipefail

cd "$(dirname "$0")"

OUT_DIR="dist"
STAGE="$OUT_DIR/prep-and-ordering"
ZIP="$OUT_DIR/prep-and-ordering.zip"

# What the buyer gets. SALES-SHEET.md is deliberately NOT here — it carries
# your pricing and your margin, and it is not their business.
BUYER_FILES=(
  "SKILL.md"
  "SETUP.md"
  "LICENCE.md"
  "references/event-quantities.md"
  "references/par-levels.md"
  "references/countdown-and-kit.md"
)

echo "Checking the buyer files…"

missing=0
for file in "${BUYER_FILES[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "  MISSING: $file"
    missing=1
  fi
done
if [[ $missing -eq 1 ]]; then
  echo
  echo "Can't build — files are missing."
  exit 1
fi

# Placeholders are written [LIKE THIS], in capitals. Lowercase brackets are
# ordinary prose and examples, so they're left alone.
found=$(grep -nE '\[[A-Z][A-Z0-9 ]*\]' "${BUYER_FILES[@]}" || true)
if [[ -n "$found" ]]; then
  echo
  echo "STOP — these still need filling in before you send this to anyone:"
  echo
  echo "$found" | sed 's/^/  /'
  echo
  echo "See BEFORE-YOU-SELL.md in the folder above for what goes in each one."
  exit 1
fi

echo "  No unfilled placeholders."

rm -rf "$OUT_DIR"
mkdir -p "$STAGE/references"

for file in "${BUYER_FILES[@]}"; do
  cp "$file" "$STAGE/$file"
done

if command -v zip >/dev/null 2>&1; then
  (cd "$OUT_DIR" && zip -qr "prep-and-ordering.zip" "prep-and-ordering")
  echo
  echo "Built $ZIP"
  echo "Send that file. It contains:"
  printf '  %s\n' "${BUYER_FILES[@]}"
else
  echo
  echo "zip isn't installed, so the folder is staged but not zipped:"
  echo "  $STAGE"
  echo "Compress that folder yourself and send the zip."
fi
