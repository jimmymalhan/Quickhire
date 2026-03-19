#!/usr/bin/env bash
# project-tracker-tail.sh — Shows the latest runtime snapshot, then tails the tracker log.

set -uo pipefail
ROOT="${QUICKHIRE_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
STATE="$ROOT/state/local-agent-runtime"
SNAPSHOT="$STATE/dashboard.json"
LOG="$STATE/company-fleet.log"

mkdir -p "$STATE"

if [ -f "$SNAPSHOT" ]; then
  python3 - "$SNAPSHOT" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
try:
    data = json.loads(path.read_text())
except Exception as exc:
    print(f"snapshot=unavailable error={exc}")
    raise SystemExit(0)

project = data.get("project", {})
capacity = data.get("controls", {}).get("capacity", {})
agents = data.get("agents", {})
handoff = data.get("handoff", {})
print(
    "snapshot="
    f"{project.get('status', 'unknown')} "
    f"overall={project.get('overallPercent', 0)}% "
    f"left={project.get('remainingPercent', 0)}% "
    f"eta={project.get('etaLabel', 'unknown')} "
    f"capacity={capacity.get('currentPercent', 0)}% "
    f"agents={agents.get('alive', 0)}/{agents.get('total', 0)} "
    f"handoff={handoff.get('status', 'none')}"
)
PY
fi

echo "tailing=$LOG"
exec tail -f "$LOG"
