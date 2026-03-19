#!/usr/bin/env bash
# CI check: block AI-specific rule files from being committed
# These should stay local to each engineer's machine
BLOCKED_FILES="AGENTS.md LOCAL_AGENT_GOVERNOR.md AUTONOMOUS_AGENT_PROMPT.md .cursor/rules .codex/ .orchestrator/"
FOUND=0
for pattern in $BLOCKED_FILES; do
  if git diff --cached --name-only | grep -q "$pattern" 2>/dev/null; then
    echo "BLOCKED: $pattern should not be committed. Keep AI rules local."
    FOUND=1
  fi
  if [ -f "$pattern" ] && git ls-files --error-unmatch "$pattern" 2>/dev/null; then
    echo "BLOCKED: $pattern is tracked. Remove it with: git rm $pattern"
    FOUND=1
  fi
done
if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "AI assistant rules must stay local. See CONTRIBUTING.md for details."
  exit 1
fi
echo "OK: No AI-specific rule files in commit."
