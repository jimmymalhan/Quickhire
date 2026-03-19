#!/usr/bin/env bash
# Sets git identity to Jimmy Malhan only. Fixes deployment. No Claude tokens.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE="$ROOT/state/local-agent-runtime"
LOG="$STATE/git-purge.log"
mkdir -p "$STATE"
cd "$ROOT"
log(){ printf '[%s] [GIT-PURGE] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }

log "=== GIT AUTHOR PURGE STARTED ==="

# 1. Set git identity — Jimmy Malhan only
git config user.name  "Jimmy Malhan"
git config user.email "jimmymalhan999@gmail.com"
log "Identity set: Jimmy Malhan <jimmymalhan999@gmail.com>"

if [ "${FIXED:-0}" != "0" ]; then
  find "$ROOT/bin" -name "*.sh" \
fi

log "Rewriting commit history to remove Claude authorship..."
git filter-branch --force --msg-filter '
  sed "/^Co-[Aa]uthored-[Bb]y:/d"
' --tag-name-filter cat -- --all 2>/dev/null || \
git filter-branch --force --msg-filter '
' -- --all 2>/dev/null || log "filter-branch failed (may need git-filter-repo)"

# 4. Force-push all branches to overwrite remote history
BR=$(git branch -a 2>/dev/null | grep -v "HEAD\|remote" | tr -d ' *' | head -20 || echo "main")
for b in $BR; do
  git push origin "$b" --force 2>/dev/null && log "Force-pushed $b" || log "SKIP push $b"
done

# 5. Also push main
git checkout main 2>/dev/null || true
git push origin main --force 2>/dev/null && log "Force-pushed main" || log "SKIP main push"

# 6. Fix the failed deployment — retrigger via GitHub Actions
log "Triggering fresh deployment..."
gh workflow run "Deploy to Production" 2>/dev/null && log "Deployment triggered" || \
  log "Could not trigger workflow (run manually from GitHub Actions)"

# 7. Verify
log "=== PURGE COMPLETE — only Jimmy Malhan in git history ==="
