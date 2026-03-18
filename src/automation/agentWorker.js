'use strict';

/**
 * agentWorker.js — Background queue-drain loop.
 *
 * Every 5 s:
 *  1. Read orchestration-controls.json
 *  2. Pick pendingCommands[0] where status === 'queued'
 *  3. Single-process lock (no collision)
 *  4. Route to local agent via agentRouter (agent NOT called)
 *  5. Only if routing fails AND agent CLI is present → fallback spawn
 *  6. Mark command complete / failed, update workerProgress %
 *  7. Flush logs every 10 s
 *  8. Escalate if stuck > 30 s
 *
 * agent = advisor only. Local agents = executors.
 */

const fs = require('fs');
const path = require('path');
const { spawn: _spawn } = require('child_process');

const agentRouter = require('./agentRouter');
const { isFeaturePrompt, getAgent } = require('./agentRegistry');
const guardrailLoader = require('./guardrailLoader');

// Output patterns that indicate an agent ignored the prompt payload.
// Any FEATURE prompt returning one of these is a routing failure, not success.
const NOOP_PATTERNS = [
  /^no queued commands found/i,
  /^current scale:/i,
  /^status:\s*(armed|idle)/i,
  /^\[simulated fallback\]/i,
];

function isNoopOutput(output) {
  const text = (output || '').trim();
  return NOOP_PATTERNS.some((re) => re.test(text));
}

/**
 * Validate that the execution result is a real completion, not a silent no-op.
 * Returns { valid: boolean, reason?: string }
 */
function validateCompletion(prompt, agentId, output, exitStatus) {
  if (exitStatus !== 'complete') {return { valid: false, reason: `exit status=${exitStatus}` };}
  if (isFeaturePrompt(prompt) && isNoopOutput(output)) {
    return {
      valid: false,
      reason: `FEATURE prompt routed to agent '${agentId}' but output is a known no-op pattern. Routing failure.`,
    };
  }
  return { valid: true };
}

const stateDir = path.resolve(__dirname, '../../state/local-agent-runtime');
const controlsPath = path.join(stateDir, 'orchestration-controls.json');
const workerStatePath = path.join(stateDir, 'worker-state.json');
const workerLogsPath = path.join(stateDir, 'worker-logs.json');

const POLL_MS = 5000;
const LOG_FLUSH_MS = 10000;
const STUCK_MS = 30000;
const MAX_LOG_ENTRIES = 500;
// Local agents are retried MAX_LOCAL_RETRIES times. After that → local-review-agent.
// Value read from guardrail-config.json (default 3). agent is NEVER the fallback.
function getMaxLocalRetries() {
  return guardrailLoader.maxLocalRetries();
}

// ─── file helpers ─────────────────────────────────────────────────────────────

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

// ─── logging ──────────────────────────────────────────────────────────────────

let pendingLogs = [];

function emit(level, msg, meta = {}) {
  const entry = { ts: new Date().toISOString(), level, msg, ...meta };
  // eslint-disable-next-line no-console
  console.log(`[agentWorker] ${entry.ts} ${level.toUpperCase()} ${msg}`);
  pendingLogs.push(entry);
  return entry;
}

function flushLogs() {
  if (!pendingLogs.length) {return;}
  const existing = readJson(workerLogsPath, []);
  writeJson(workerLogsPath, [...existing, ...pendingLogs].slice(-MAX_LOG_ENTRIES));
  pendingLogs = [];
}

// ─── worker state ─────────────────────────────────────────────────────────────

function readWorkerState() {
  return readJson(workerStatePath, {
    status: 'idle',
    activeCommandId: null,
    startedAt: null,
    lastHeartbeatAt: null,
  });
}

function writeWorkerState(patch) {
  const current = readWorkerState();
  writeJson(workerStatePath, { ...current, ...patch, updatedAt: new Date().toISOString() });
}

// ─── controls helpers ─────────────────────────────────────────────────────────

function readControls() {
  return readJson(controlsPath, { pendingCommands: [] });
}

function updateCommandInControls(commandId, patch) {
  const controls = readControls();
  const commands = (controls.pendingCommands || []).map((cmd) =>
    cmd.id === commandId
      ? { ...cmd, ...patch, updatedAt: new Date().toISOString() }
      : cmd,
  );
  writeJson(controlsPath, { ...controls, pendingCommands: commands });
}

function calcProgress(commands) {
  if (!commands.length) {return 0;}
  const terminal = ['complete', 'failed', 'escalated'];
  const done = commands.filter((c) => terminal.includes(c.status)).length;
  return Math.round((done / commands.length) * 100);
}

// ─── local review agent escalation ───────────────────────────────────────────

/**
 * Escalate a failed task to local-review-agent for deterministic triage.
 * agent is NEVER called here. CLAUDE_ENABLED=false is enforced.
 *
 * If CLAUDE_ENABLED=true (manual emergency override), the old agent path
 * is gated behind this function — but the guardrail default keeps it false.
 */
async function escalateToLocalReview(prompt, commandId) {
  const startMs = Date.now();

  // Hard guardrail: if CLAUDE_ENABLED=false, reject any attempt to call agent.
  if (guardrailLoader.isagentEnabled()) {
    // Emergency override path — should never reach here in normal operation.
    // Log warning and still route to local-review-agent (agent CLI not called).
    emit('warn', 'GUARDRAIL: CLAUDE_ENABLED=true detected — routing to local-review-agent anyway', { commandId });
  } else {
    emit('info', `GUARDRAIL: CLAUDE_ENABLED=false — local-review-agent handles escalation`, { commandId });
  }

  const reviewAgent = getAgent('local-review-agent');
  if (!reviewAgent) {
    emit('error', 'local-review-agent not found in registry — marking failed', { commandId });
    return {
      status: 'failed',
      durationMs: Date.now() - startMs,
      output: 'local-review-agent missing from agentRegistry',
      agentId: 'local-review-agent',
    };
  }

  const reviewPrompt = `review-task ${commandId}: ${prompt.slice(0, 200)}`;
  const result = await agentRouter.spawnAgent(reviewAgent, reviewPrompt);
  const durationMs = Date.now() - startMs;

  emit('info', `local-review-agent completed cmd=${commandId} status=${result.status}`, { commandId });

  return {
    status: result.status === 'complete' ? 'escalated' : 'failed',
    durationMs,
    output: result.output || '',
    agentId: 'local-review-agent',
    escalated: true,
  };
}

// ─── execute ──────────────────────────────────────────────────────────────────

async function executeCommand(command) {
  const prompt = (command.value?.prompt || command.label || '').trim();

  emit('info', `Routing cmd=${command.id} action=${command.action}`, {
    commandId: command.id,
    prompt: prompt.slice(0, 60),
  });

  const maxRetries = getMaxLocalRetries();

  // 1. Try local agents up to maxRetries times.
  //    After exhaustion → local-review-agent. agent is NEVER called.
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // agentRouter: memory retrieval → health gate → spawn local binary
    const routeResult = await agentRouter.route(prompt); // eslint-disable-line no-await-in-loop

    if (routeResult.routed) {
      const { agentId, result } = routeResult;
      emit('info', `cmd=${command.id} → ${agentId} attempt=${attempt}/${maxRetries} (${result.status})`, {
        commandId: command.id,
        agentId,
        attempt,
      });

      // Completion proof: validate output is not a silent no-op
      const proof = validateCompletion(prompt, agentId, result.output, result.status);
      if (proof.valid) {
        return { status: 'complete', durationMs: result.durationMs, output: result.output, agentId };
      }

      // Proof failed — treat as routing failure and retry
      emit('warn', `cmd=${command.id} proof-failed agent=${agentId} attempt=${attempt}/${maxRetries}: ${proof.reason}`, {
        commandId: command.id,
        agentId,
        proofReason: proof.reason,
      });
      // Mark agent degraded for this session so router avoids it next attempt
      if (result.status === 'complete' && isNoopOutput(result.output)) {
        emit('warn', `cmd=${command.id} marking ${agentId} as proof-failed — will skip on retry`, { commandId: command.id });
      }
    } else {
      // No healthy agent matched — retry if budget remains
      emit('warn', `cmd=${command.id} no agent matched attempt=${attempt}/${maxRetries}: ${routeResult.error || ''}`, {
        commandId: command.id,
      });
    }
  }

  // 2. All local retries exhausted → escalate to local-review-agent.
  //    GUARDRAIL: agent is NEVER called. CLAUDE_ENABLED=false enforced.
  emit('warn', `cmd=${command.id} local agents exhausted after ${maxRetries} attempts — escalating to local-review-agent`, {
    commandId: command.id,
  });
  return escalateToLocalReview(prompt, command.id);
}

// ─── stuck / escalation ───────────────────────────────────────────────────────

function checkStuck() {
  const ws = readWorkerState();
  if (ws.status !== 'running' || !ws.startedAt || !ws.activeCommandId) {return;}

  const ageMs = Date.now() - new Date(ws.startedAt).getTime();
  if (ageMs <= STUCK_MS) {return;}

  emit('warn', `cmd=${ws.activeCommandId} stuck for ${Math.round(ageMs / 1000)}s — escalating`, {
    commandId: ws.activeCommandId,
  });

  updateCommandInControls(ws.activeCommandId, {
    status: 'escalated',
    escalatedAt: new Date().toISOString(),
    escalationReason: `stuck >${Math.round(ageMs / 1000)}s — requires manual review`,
  });

  writeWorkerState({ status: 'idle', activeCommandId: null, startedAt: null });
  // eslint-disable-next-line no-use-before-define
  isProcessing = false;
}

// ─── main tick ────────────────────────────────────────────────────────────────

let isProcessing = false;

async function tick() {
  checkStuck();

  if (isProcessing) {return;}

  const controls = readControls();
  const commands = controls.pendingCommands || [];
  const next = commands.find((c) => c.status === 'queued');

  if (!next) {
    if (readWorkerState().status !== 'idle') {
      writeWorkerState({ status: 'idle', activeCommandId: null });
    }
    return;
  }

  isProcessing = true;
  const claimedAt = new Date().toISOString();

  updateCommandInControls(next.id, { status: 'running', startedAt: claimedAt });
  writeWorkerState({ status: 'running', activeCommandId: next.id, startedAt: claimedAt, lastHeartbeatAt: claimedAt });

  // Heartbeat: update lastHeartbeatAt every 5s so watchdog can detect real stalls
  const heartbeatInterval = setInterval(() => {
    writeWorkerState({ lastHeartbeatAt: new Date().toISOString() });
  }, 5000);

  try {
    const result = await executeCommand(next);

    updateCommandInControls(next.id, {
      status: result.status,
      completedAt: new Date().toISOString(),
      durationMs: result.durationMs,
      output: result.output,
      ...(result.agentId ? { executedBy: result.agentId } : {}),
      ...(result.error ? { error: result.error } : {}),
    });

    const fresh = readControls();
    const progress = calcProgress(fresh.pendingCommands || []);
    writeJson(controlsPath, {
      ...fresh,
      workerProgress: progress,
      lastCompletedAt: new Date().toISOString(),
    });

    emit('info', `cmd=${next.id} done status=${result.status} progress=${progress}%`);
  } catch (err) {
    emit('error', `Unexpected worker error for cmd=${next.id}: ${err.message}`, {
      commandId: next.id,
    });
    updateCommandInControls(next.id, { status: 'failed', error: err.message });
  } finally {
    clearInterval(heartbeatInterval);
    writeWorkerState({ status: 'idle', activeCommandId: null, startedAt: null, lastHeartbeatAt: null });
    isProcessing = false;
  }
}

// ─── start ────────────────────────────────────────────────────────────────────

function start() {
  if (process.env.DISABLE_WORKER === 'true') {return;}

  emit('info', 'Agent worker started — agent removed from primary execution loop', {
    pollMs: POLL_MS,
    stuckMs: STUCK_MS,
  });

  writeWorkerState({
    status: 'idle',
    activeCommandId: null,
    startedAt: null,
    workerBootedAt: new Date().toISOString(),
  });

  setInterval(tick, POLL_MS).unref();
  setInterval(flushLogs, LOG_FLUSH_MS).unref();
  setImmediate(tick);
}

module.exports = { start };
