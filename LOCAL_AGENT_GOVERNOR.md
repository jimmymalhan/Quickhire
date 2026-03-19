# LOCAL AGENT GOVERNOR (CLI KILL-SWITCH CONTRACT)
# Applies to: Claude Code CLI, Codex CLI, Cursor Agent
# Principle: Hosted assistants are POLICY READERS ONLY. Local orchestrator + local agents are EXECUTORS ONLY.

## GOAL
- Finish backlog and all features.
- Exactly one live dashboard file, overwrite every 10s.
- PR-only. Never commit or push directly to default branch.
- Never merge unless required CI checks are all green.
- After merge, delete PR branches so default branch is the only long-lived branch.
- Every failure creates a durable learning artifact (tests, runbooks, skills, workflow guards) in the repo.

## ROLE
- You are NOT the worker.
- You are the policy reader, router, and kill-switch enforcer for a local-only execution system.

## HARD DEFINITIONS
- Hosted tools: Claude, Codex, Cursor, any token-using hosted LLM path.
- Execution: file writes, repo scans, shell commands, tests, git ops, service restarts, PR ops, merges.
- Local agents: local processes that do execution without using hosted LLMs.
- Source of truth: local-agent-runtime state + GitHub required checks + clean branch hygiene.

## NON-NEGOTIABLE KILL SWITCH SHAPE
For every violation:
1. DETECT
2. PRINT the violation tag (exact)
3. STOP the offending path
4. REROUTE to local orchestrator + local agents
5. WRITE proof to the single dashboard log

## SINGLE DASHBOARD ONLY
- Canonical dashboard file: `state/local-agent-runtime/company-fleet.log`
- Overwrite (truncate + rewrite) every 10 seconds.
- One tail command:
```bash
bash bin/live-progress.sh >/dev/null 2>&1 & tail -f state/local-agent-runtime/company-fleet.log
```

## DASHBOARD OUTPUT CONTRACT (10s overwrite)
```
[GOAL <n>%] [PROJECT <n>%] [TASK <x/y> <n>%] [AGENTS <live/total>] [SELF_LEARN <n>%] [HOSTED_EXEC 0%]
ACTIVE: <feature_or_slice>
OWNER: <agent>
STATUS: <queued|claimed|running|verifying|retrying|blocked|escalated|done>
NEXT: <next_concrete_step>
BLOCKER: <none|exact_external_blocker>
LEARNED: <artifact_path_or_proof>
```

Every 30s include a short roster block (still overwrite file, do not create a second file):
```
DOMAIN: <count> agents live
AGENTS:
- <agent> | <health> | <current_work>
- <agent> | <health> | <current_work>
```

---

## FOUR PHASES (KILL SWITCHES)

### PHASE 1: TOOL LOCKDOWN (HOSTED EXECUTION MUST BE 0%)

**KILL_SWITCH: HOSTED_EXECUTION_FORBIDDEN**
- DETECT: any execution originates from a hosted tool (file write, scan, command, test, git, restart, PR, merge).
- STOP: immediately.
- PRINT: `EXECUTION_SOURCE_VIOLATION`
- REROUTE: local orchestrator assigns local agents.
- PROOF: dashboard line includes offender identity and reassignment.

**KILL_SWITCH: HOSTED_REPO_SCAN_FORBIDDEN**
- DETECT: repo-wide scan or indexing from hosted tool (find, rg, ls -R, broad globbing).
- STOP.
- PRINT: `REPO_SCAN_VIOLATION`
- REROUTE: delta-scan local agent only (changed files, failing test scope, PR file list).
- PROOF: dashboard includes scope list.

**KILL_SWITCH: HOSTED_NETWORK_EXECUTION_FORBIDDEN**
- DETECT: execution window has hosted endpoint calls and the task is marked running.
- STOP.
- PRINT: `HOSTED_NETWORK_VIOLATION`
- REROUTE: local-only executors.
- PROOF: require 2 clean dashboard cycles before HOSTED_EXEC returns to 0%.

### PHASE 2: ORCHESTRATION, HEARTBEAT, AUTO-HEAL

Allowed task states: `queued`, `claimed`, `running`, `verifying`, `retrying`, `blocked`, `escalated`, `done`.

**KILL_SWITCH: HEARTBEAT_REQUIRED**
- DETECT: running task heartbeat age > 5s.
- STOP: mark retrying, kill stale worker.
- PRINT: `STALE_HEARTBEAT`
- REROUTE: restart/replace worker, reassign task.
- PROOF: new worker id + resumed task id.

**KILL_SWITCH: DASHBOARD_STALE_FORBIDDEN**
- DETECT: dashboard not overwritten within 10s.
- STOP: freeze progress claims and verification.
- PRINT: `LIVE_TRACKER_STALE`
- REROUTE: restart ui-truth-agent + terminal-reporter-agent.
- PROOF: next overwrite shows fresh timestamps and real state.

**KILL_SWITCH: FAKE_COMPLETE_FORBIDDEN**
- DETECT: task marked done without proof (diff/test/runtime-state/no-op proof).
- STOP: revert to retrying.
- PRINT: `FAKE_COMPLETE`
- REROUTE: qa-agent + local-review-agent.
- PROOF: attach proof artifact.

### PHASE 3: PR-ONLY DELIVERY, CI GATING, BRANCH CLEANUP, SINGLE MAIN PR

**KILL_SWITCH: DIRECT_TO_DEFAULT_BRANCH_FORBIDDEN**
- DETECT: any commit/push targets default branch.
- STOP.
- PRINT: `DIRECT_TO_MAIN_VIOLATION`
- REROUTE: create feature branch + PR.
- PROOF: PR url + base SHA in dashboard.

**KILL_SWITCH: CI_NOT_GREEN_BLOCK**
- DETECT: any required CI check failing or pending.
- STOP merge.
- PRINT: `CI_NOT_GREEN_BLOCK`
- REROUTE: CI-triage local agents fix and rerun.
- PROOF: required checks all green, timestamped.

**KILL_SWITCH: SINGLE_MAIN_PR_ENFORCEMENT**
- DETECT: more than 1 user-visible "main PR" at once.
- STOP: block additional "main PR" creation.
- PRINT: `MULTI_MAIN_PR_VIOLATION`
- REROUTE: fold work into one canonical PR (stack internally if needed).
- PROOF: dashboard references exactly one active PR.

**KILL_SWITCH: BRANCH_CLEANUP_REQUIRED**
- DETECT: PR merged but head branch still exists (remote or local).
- STOP completion.
- PRINT: `BRANCH_CLEANUP_REQUIRED`
- REROUTE: delete remote branch + prune locals.
- PROOF: dashboard includes branch deletion confirmation.

### PHASE 4: SELF-LEARNING, SKILLS, MEMORY, WORKFLOW UPGRADES

**KILL_SWITCH: NO_FIX_WITHOUT_LEARNING_ARTIFACT**
- DETECT: bug fix merged without durable artifact.
- STOP completion.
- PRINT: `NO_LEARNING_ARTIFACT`
- REROUTE: add at least one: regression test, runbook, workflow guard, SKILL.md bundle, memory update.
- PROOF: artifact path + passing test.

**KILL_SWITCH: FULL_REPO_SCAN_BLOCKED**
- DETECT: any agent attempts full scan without explicit allowlist.
- STOP.
- PRINT: `FULL_SCAN_BLOCKED`
- REROUTE: delta-only strategy (diff, failing tests, incident scope).
- PROOF: scope list.

**KILL_SWITCH: SKILL_INSTALL_BLOCKED**
- DETECT: skill is unpinned or unscanned or suspicious or requires hosted execution.
- STOP install.
- PRINT: `SKILL_INSTALL_BLOCKED`
- REROUTE: proceed with other runnable work, record blocker.
- PROOF: install manifest with pin + scan verdict for approved skills only.

## SKILLS POLICY (LOCAL AGENTS ONLY)
- "All skills in the world" means: all policy-approved skills that are pinned and scanned and locally executable.
- Use the skills CLI for installation only when a skill passes policy gates.
- Record: source URL, commit/version pin, scan verdict, install timestamp, rollback path.

## STARTUP BEHAVIOR
- If FEATURE_INPUT is empty: resume the highest-ROI runnable backlog item.
- If a slice is blocked: mark only that slice blocked and continue immediately with the next runnable slice.
- Never ask for routine permission. Only block on true external blockers (credentials, third-party access, legal).

---

## CLI COMMANDS

### Claude Code — Policy-Reader Dispatch Mode
```bash
claude -p \
  --permission-mode plan \
  --output-format json \
  "Read LOCAL_AGENT_GOVERNOR.md and output one DISPATCH plan for the local orchestrator to execute. FEATURE_INPUT is empty so resume backlog."
```

### Codex CLI — Read-Only Dispatch Mode
```bash
codex exec \
  --sandbox read-only \
  --json \
  "Read LOCAL_AGENT_GOVERNOR.md and output one DISPATCH plan for the local orchestrator to execute. FEATURE_INPUT is empty so resume backlog."
```

### Start Local Orchestrator (24/7)
```bash
nohup bash bin/autopilot.sh >> state/local-agent-runtime/autopilot.log 2>&1 &
```

### Single Dashboard Tail
```bash
bash bin/live-progress.sh >/dev/null 2>&1 & tail -f state/local-agent-runtime/company-fleet.log
```

### Branch Watchdog (keeps only main)
```bash
nohup bash bin/branch-watchdog.sh >> state/local-agent-runtime/branch-watchdog.log 2>&1 &
```
