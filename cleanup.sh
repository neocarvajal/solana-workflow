#!/usr/bin/env bash
set -e

# Ensure we are on the correct repository root
cd "$(git rev-parse --show-toplevel)"

# Create a backup branch in case we need to revert
git branch backup-before-cleanup

# Remove the large file from all history
git filter-branch --force \
  --index-filter "git rm --cached --ignore-unmatch .next/dev/cache/turbopack/f37fad94/00001681.sst" \
  --prune-empty \
  --tag-name-filter cat \
  -- --all

# Delete the temporary refs created by filter-branch
git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin

# Force‑push the cleaned history and tags
git push origin --force --all
git push origin --force --tags
