#!/usr/bin/env bash
# code-writer.sh — Execute FEATURE prompts via LocalAgent CLI.
# Called by code-writer-agent in agentRegistry.js.
# AGENT_PROMPT is injected by agentRouter.spawnAgent().

set -euo pipefail

if [ -z "${AGENT_PROMPT:-}" ]; then
  echo "ERROR: AGENT_PROMPT is empty — nothing to execute" >&2
  exit 1
fi

# Try LocalAgent CLI first
if command -v LocalAgent >/dev/null 2>&1; then
  exec LocalAgent --print "$AGENT_PROMPT"
fi

# Fallback: LocalAgent not installed — emit structured error so completion
# proof validator rejects this as a failure, not a silent success
echo "BLOCKED: LocalAgent CLI not found. Install LocalAgent CLI to enable code-writer-agent."
echo "Prompt preview: ${AGENT_PROMPT:0:120}"
exit 1
