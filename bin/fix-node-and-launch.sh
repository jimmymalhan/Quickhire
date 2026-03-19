#!/usr/bin/env bash
# fix-node-and-launch.sh — Installs Node 20 via nvm, installs deps, opens browser.
# Fixes npm once and for all. No Claude tokens.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
S="$ROOT/state/local-agent-runtime"
LOG="$S/fix-node.log"
mkdir -p "$S"
log(){ printf '[%s] [FIX-NODE] %s\n' "$(date +%H:%M:%S)" "$1" | tee -a "$LOG"; }

log "=== FIX-NODE-AND-LAUNCH ==="

# ── 1. Install nvm if missing ─────────────────────────────────────────────────
if ! command -v nvm >/dev/null 2>&1 && [ ! -f "$HOME/.nvm/nvm.sh" ]; then
  log "Installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# ── 2. Load nvm ───────────────────────────────────────────────────────────────
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

if ! command -v nvm >/dev/null 2>&1; then
  log "nvm still not found — trying brew node@20..."
  brew install node@20 2>/dev/null || true
  brew link node@20 --force 2>/dev/null || true
fi

# ── 3. Install Node 20 (LTS) ─────────────────────────────────────────────────
if command -v nvm >/dev/null 2>&1; then
  log "Installing Node 20 LTS..."
  nvm install 20
  nvm use 20
  nvm alias default 20
fi

NODE_V=$(node --version 2>/dev/null || echo "unknown")
NPM_V=$(npm --version 2>/dev/null || echo "unknown")
log "Node: $NODE_V  npm: $NPM_V"

# ── 4. Install frontend deps ──────────────────────────────────────────────────
cd "$ROOT/frontend"
log "Installing frontend dependencies..."
npm install --prefer-offline 2>&1 | tail -5
log "Frontend deps installed"

# ── 5. Install backend deps ───────────────────────────────────────────────────
cd "$ROOT"
log "Installing backend dependencies..."
npm install --prefer-offline 2>&1 | tail -5
log "Backend deps installed"

# ── 6. Copy new UI components to right location ───────────────────────────────
# Ensure routes are wired in App.jsx/main.jsx
APP_FILE="$ROOT/frontend/src/App.jsx"
if [ -f "$APP_FILE" ] && ! grep -q "CommandPalette" "$APP_FILE" 2>/dev/null; then
  log "Wiring CommandPalette into App.jsx..."
  # Add import at top of App.jsx
  sed -i '' '1s/^/import CommandPalette from ".\/components\/ui\/CommandPalette";\n/' "$APP_FILE" 2>/dev/null || true
fi

# ── 7. Start frontend dev server ──────────────────────────────────────────────
cd "$ROOT/frontend"
log "Starting frontend dev server..."
nohup npm run dev >> "$S/frontend-dev.log" 2>&1 &
FE_PID=$!
echo $FE_PID > "$S/frontend-dev.pid"
log "Frontend server PID=$FE_PID"

# Wait for it to be ready
log "Waiting for localhost:3000..."
for i in $(seq 1 30); do
  curl -s http://localhost:3000 >/dev/null 2>&1 && { log "Frontend READY"; break; }
  sleep 2
done

# ── 8. Open browser ───────────────────────────────────────────────────────────
log "Opening browser..."
open http://localhost:3000 2>/dev/null || \
  xdg-open http://localhost:3000 2>/dev/null || \
  log "Open manually: http://localhost:3000"

log "=== DONE — http://localhost:3000 ==="
log "Dashboard: tail -f $S/company-fleet.log"
log "Frontend log: tail -f $S/frontend-dev.log"
