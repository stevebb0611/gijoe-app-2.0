#!/bin/bash
# Fires on PostToolUse for Edit/Write/NotebookEdit. When 5+ files are dirty
# in `git status --porcelain`, auto-commits and pushes to the current
# branch's existing upstream. No force-push; skips silently if no upstream.

cd "${CLAUDE_PROJECT_DIR:-/Users/steveblumrick/gijoe-app-2.0}" || exit 0

dirty=$(git status --porcelain | wc -l | tr -d ' ')
[ "$dirty" -ge 5 ] || exit 0

upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)
if [ -z "$upstream" ]; then
  branch=$(git rev-parse --abbrev-ref HEAD)
  printf '{"systemMessage": "Auto-push skipped: %s files dirty but branch %s has no upstream configured."}\n' "$dirty" "$branch"
  exit 0
fi

if ! git add -A; then
  printf '{"systemMessage": "Auto-push: git add failed, skipping this cycle."}\n'
  exit 0
fi

if ! git commit -q -m "Auto-commit: $dirty files changed (automated)"; then
  printf '{"systemMessage": "Auto-push: git commit failed (possibly nothing staged), skipping."}\n'
  exit 0
fi

if git push; then
  printf '{"systemMessage": "Auto-committed and pushed %s files to %s."}\n' "$dirty" "$upstream"
else
  printf '{"systemMessage": "Auto-commit succeeded (%s files) but push to %s failed — commit is local only, push manually."}\n' "$dirty" "$upstream"
fi
exit 0
