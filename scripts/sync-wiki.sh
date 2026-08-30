#!/usr/bin/env bash
set -euo pipefail

# sync-wiki.sh — Synchronizes local wiki/ directory with GitHub Wiki repository
# Usage: ./scripts/sync-wiki.sh [--dry-run]

DRY_RUN=false
for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then
    DRY_RUN=true
  fi
done

REPO_URL="https://github.com/tamld/defense-in-depth.wiki.git"
TEMP_DIR=$(mktemp -d /tmp/did-wiki-sync.XXXXXX)

echo "==> Synchronizing defense-in-depth wiki..."

if [ "$DRY_RUN" = true ]; then
  echo "==> [dry-run] Files in wiki/ to synchronize:"
  ls -la wiki/
  rm -rf "$TEMP_DIR"
  exit 0
fi

# Clone or init remote wiki repo
if git clone "$REPO_URL" "$TEMP_DIR" 2>/dev/null; then
  echo "==> Cloned existing remote wiki."
else
  echo "==> Remote wiki is empty. Initializing new repository..."
  cd "$TEMP_DIR"
  git init
  git remote add origin "$REPO_URL"
  git checkout -b master || git checkout -b main
fi

# Copy all wiki markdown files
cp -r wiki/* "$TEMP_DIR/"

cd "$TEMP_DIR"
git add .

if git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "==> Wiki is already up to date. No changes to commit."
else
  git commit -m "docs(wiki): synchronize wiki knowledge base from main repository"
  echo "==> Pushing to remote GitHub wiki..."
  git push -u origin HEAD
  echo "==> Successfully synchronized GitHub Wiki!"
fi

rm -rf "$TEMP_DIR"
