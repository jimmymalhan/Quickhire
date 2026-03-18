'use strict';

/**
 * agentWatchdog.js — Stuck-worker safety net.
 *
 * Every WATCH_MS:
 *  1. Read worker-state.json
 *  2. If status === 'running' AND age > WATCHDOG_TIMEOUT_MS:
 *     a. Force-reset worker to idle
 *     b. Mark the stuck command 'escalated' in orchestration-controls.json
 *     c. Append rescue record to watchdog-state.json
 *
 * agent is NOT called here. Recovery is purely local state manipulation.
 * agentWorker will pick up the next queued command on its next poll tick.
 */

const fs = require('fs');
const path = require('path');

const stateDir = path.resolve(__dirname, '../../state/local-agent-runtime');
const workerStatePath = path.join(stateDir, 'worker-state.json');
const controlsPath = path.join(stateDir, 'orchestration-controls.json');
const watchdogStatePath = path.join(stateDir, 'watchdog-state.json');

// Check every 15 s; declare stuck after 45 s (1.5× the stuck threshold in agentWorker)
const WATCH_MS = 15000;
const WATCHDOG_TIMEOUT_MS = 45000;

// ─── helpers ──────────────────────────────────────────────────────────────────

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

// ─── rescue counter (in-process, reset on restart) ────────────────────────────

let rescueCount = 0;

// ─── watch tick ───────────────────────────────────────────────────────────────

function watch() {
  const ws = readJson(workerStatePath, {});

  if (ws.status !== 'running' || !ws.startedAt || !ws.activeCommandId) {return;}

  // Use lastHeartbeatAt if available (heartbeat = active work in progress)
  // Fall back to startedAt only if heartbeat was never written
  const checkFrom = ws.lastHeartbeatAt || ws.startedAt;
  const ageMs = Date.now() - new Date(checkFrom).getTime();
  if (ageMs <= WATCHDOG_TIMEOUT_MS) {return;}

  rescueCount += 1;
  const rescuedAt = new Date().toISOString();

  // eslint-disable-next-line no-console
  console.log(
    `[agentWatchdog] RESCUE #${rescueCount}: cmd=${ws.activeCommandId} stuck ${Math.round(ageMs / 1000)}s — force-resetting`,
  );

  // (a) Reset worker to idle so agentWorker can pick up the next queued command
  writeJson(workerStatePath, {
    status: 'idle',
    activeCommandId: null,
    startedAt: null,
    lastHeartbeatAt: null,
    updatedAt: rescuedAt,
  });

  // (b) Escalate the stuck command in orchestration-controls
  const controls = readJson(controlsPath, { pendingCommands: [] });
  const commands = (controls.pendingCommands || []).map((cmd) => {
    if (cmd.id !== ws.activeCommandId) {return cmd;}
    const retryCount = (cmd.retryCount || 0) + 1;
    // Auto-requeue up to 2 times before escalating permanently
    if (retryCount <= 2) {
      return {
        ...cmd,
        status: 'queued',
        retryCount,
        lastRescueAt: rescuedAt,
        rescueReason: `watchdog retry ${retryCount}/2: stuck ${Math.round(ageMs / 1000)}s since last heartbeat`,
        updatedAt: rescuedAt,
      };
    }
    return {
      ...cmd,
      status: 'escalated',
      escalatedAt: rescuedAt,
      escalationReason: `watchdog: stuck ${Math.round(ageMs / 1000)}s after ${retryCount} rescue attempts`,
      updatedAt: rescuedAt,
    };
  });
  writeJson(controlsPath, { ...controls, pendingCommands: commands });

  // (c) Append rescue record to watchdog-state.json
  const prev = readJson(watchdogStatePath, { rescueCount: 0, rescues: [] });
  writeJson(watchdogStatePath, {
    rescueCount,
    lastRescueAt: rescuedAt,
    startedAt: prev.startedAt || rescuedAt,
    rescues: [
      { commandId: ws.activeCommandId, stuckMs: ageMs, rescuedAt },
      ...(prev.rescues || []),
    ].slice(0, 50),
  });
}

// ─── start ────────────────────────────────────────────────────────────────────

function start() {
  if (process.env.DISABLE_WORKER === 'true') {return;}

  // eslint-disable-next-line no-console
  console.log(
    `[agentWatchdog] started — checking every ${WATCH_MS / 1000}s, timeout ${WATCHDOG_TIMEOUT_MS / 1000}s`,
  );

  writeJson(watchdogStatePath, {
    rescueCount: 0,
    lastRescueAt: null,
    startedAt: new Date().toISOString(),
    rescues: [],
  });

  setInterval(watch, WATCH_MS).unref();
  setImmediate(watch);
}

module.exports = { start };
