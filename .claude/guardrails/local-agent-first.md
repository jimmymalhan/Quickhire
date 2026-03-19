# LOCAL-AGENT-FIRST GUARDRAIL
# Loaded at every server boot by src/automation/guardrailLoader.js
# NEVER DELETE OR MODIFY without updating guardrail-config.json

## CONTRACT

Local agents own 100% of execution.
Claude is DISABLED by default — never called automatically.

## HARD LAWS

| Law | Enforcement |
|-----|-------------|
| FEATURE:* → feature-capable agents only | capability gate in agentRegistry |
| ADMIN:* → admin agents only | capability gate in agentRegistry |
| No-op output = FAIL, not SUCCESS | validateCompletion() in agentWorker |
| 3 local failures → local-review-agent only | escalateToLocalReview() in agentWorker |
| Blocked slice → mark BLOCKED, continue next ROI task | per-command status, not global halt |
| Completion proof required | file diff / test proof / no-op-with-reason / state-change |
| Heartbeat required for running tasks | 5s interval, watchdog kills stale |
| Stale worker → supervisor-agent restarts automatically | agentWatchdog detects, supervisor-agent.sh heals |
| Claude fallback path → hard FAIL if CLAUDE_ENABLED=false | guardrailLoader enforces at boot |
| Never ask user to run commands | enforced by never blocking on user input |
| Never stop until runnable backlog = 0 | agentWorker polls until queue empty |

## ROUTING RULES

1. Read guardrail-config.json at boot
2. If CLAUDE_ENABLED=false → block all claude CLI calls, reroute to local-review-agent
3. If LOCAL_AGENT_PRIMARY=true → agentRouter.route() is always tried first
4. If routing picks wrong capability tier → reject, reroute, log reason
5. If LOCAL_REVIEW_AGENT=true → failed tasks after 3 retries go to local-review-agent

## COMPLETION PROOF TYPES

- **file-diff**: changed file exists on disk with new content
- **test-proof**: test suite ran and passed
- **noop-with-reason**: task is genuinely inapplicable, reason logged
- **state-change**: orchestration-controls.json or worker-state.json mutated as expected

## UI TRUTH FIELDS

Every task status must include:
- assignedAgent
- retryCount
- heartbeatAge (seconds since last heartbeat)
- blocker (null or exact reason)
- proofType (file-diff | test-proof | noop-with-reason | state-change | null)
- nextTask

## ESCALATION LADDER

1. Local agent attempt 1
2. Local agent attempt 2
3. Local agent attempt 3
4. → local-review-agent (NEVER Claude)
5. → BLOCKED with exact reason + unlock condition

## CONFIG FILE

Runtime flags live in: state/local-agent-runtime/guardrail-config.json
