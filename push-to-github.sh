#!/usr/bin/env bash
# Push the ReplyFlow repository to GitHub.
#
# Usage:
#   ./push-to-github.sh <github-personal-access-token>
#   GH_TOKEN=ghp_xxx ./push-to-github.sh
#
# The token needs the "repo" scope (classic) or "Contents: read and write"
# (fine-grained). It is used once and never written to disk, .git/config,
# or the shell history of this script.
set -euo pipefail

REPO_OWNER="ajmalshareen-maker"
REPO_NAME="CRM-"
BRANCH="main"

TOKEN="${1:-${GH_TOKEN:-}}"
if [ -z "$TOKEN" ]; then
  echo "error: no token supplied." >&2
  echo "usage: ./push-to-github.sh <token>   (or set GH_TOKEN)" >&2
  exit 1
fi

cd "$(dirname "$0")"

if [ ! -d .git ]; then
  echo "error: no git repository found here." >&2
  exit 1
fi

REMOTE="https://x-access-token:${TOKEN}@github.com/${REPO_OWNER}/${REPO_NAME}.git"

echo "→ verifying credentials…"
if ! git ls-remote "$REMOTE" >/dev/null 2>&1; then
  echo "error: GitHub rejected the token (bad token, or missing repo scope)." >&2
  exit 1
fi

git remote remove origin >/dev/null 2>&1 || true
git remote add origin "$REMOTE"

echo "→ pushing ${BRANCH} to ${REPO_OWNER}/${REPO_NAME}…"
git push -u origin "$BRANCH"

# Strip the token back out of .git/config so it does not persist on disk.
git remote set-url origin "https://github.com/${REPO_OWNER}/${REPO_NAME}.git"

echo
echo "✓ pushed to https://github.com/${REPO_OWNER}/${REPO_NAME}"
echo "  branch: ${BRANCH}"
git log --oneline -1
