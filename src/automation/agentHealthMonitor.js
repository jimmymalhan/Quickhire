'use strict';

/**
 * agentHealthMonitor.js — Tracks agent failure rates, marks agents degraded,
 * and emits recovery events when agents clear their failure window.
 *
 * Runs every 30 s. Writes to state/local-agent-runtime/agent-health.json.
 *
 * "Restart" for these stateless task-executors means:
 *   - Clearing the degraded flag once success rate recovers
 *   - Logging so the worker stops routing to degraded agents
 */

const fs = require('fs');
const path = require('path');

const { listAgents } = require('./agentRegistry');

const stateDir = path.resolve(__dirname, '../../state/local-agent-runtime');
const healthPath = path.join(stateDir, 'agent-health.json');
const patternsPath = path.join(stateDir, 'execution-patterns.json');

const MONITOR_MS = 30000;
const FAILURE_WINDOW_MS = 5 * 60 * 1000; // 5-minute rolling window
const DEGRADED_THRESHOLD = 3; // 3+ failures in window = degraded

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

// ─── health computation ───────────────────────────────────────────────────────

function computeHealth() {
  const patterns = readJson(patternsPath, []);
  const now = Date.now();
  const cutoff = now - FAILURE_WINDOW_MS;

  return listAgents().map((agent) => {
    const recent = patterns.filter(
      (p) => p.agentId === agent.id && new Date(p.recordedAt).getTime() > cutoff,
    );

    const failures = recent.filter((p) => p.resultStatus === 'failed').length;
    const successes = recent.filter((p) => p.resultStatus === 'complete').length;

    const lastSuccessEntry = recent
      .filter((p) => p.resultStatus === 'complete')
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[0];

    const minutesSinceSuccess = lastSuccessEntry
      ? Math.round((now - new Date(lastSuccessEntry.recordedAt).getTime()) / 60000)
      : null;

    const status =
      failures >= DEGRADED_THRESHOLD
        ? 'degraded'
        : failures > 0 && successes === 0
          ? 'warning'
          : 'healthy';

    return {
      id: agent.id,
      name: agent.name,
      status,
      recentFailures: failures,
      recentSuccesses: successes,
      totalRecentRuns: recent.length,
      minutesSinceSuccess,
      checkedAt: new Date().toISOString(),
    };
  });
}

// ─── monitor tick ─────────────────────────────────────────────────────────────

function monitor() {
  const agents = computeHealth();
  writeJson(healthPath, { checkedAt: new Date().toISOString(), agents });

  const degraded = agents.filter((a) => a.status === 'degraded');
  const recovered = agents.filter((a) => a.status === 'healthy' && a.totalRecentRuns > 0);

  if (degraded.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[healthMonitor] DEGRADED: ${degraded.map((a) => `${a.id}(${a.recentFailures}f)`).join(', ')}`,
    );
  }
  if (recovered.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[healthMonitor] healthy: ${recovered.map((a) => a.id).join(', ')}`);
  }
}

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Returns true if an agent is currently healthy enough to receive tasks.
 * Reads from the cached health file (written by monitor()) to avoid
 * recomputing on every route() call.
 */
function isAgentHealthy(agentId) {
  const health = readJson(healthPath, null);
  if (!health) {return true;} // no data yet — assume healthy
  const entry = (health.agents || []).find((a) => a.id === agentId);
  return !entry || entry.status !== 'degraded';
}

function start() {
  if (process.env.DISABLE_WORKER === 'true') {return;}

  monitor(); // run immediately
  setInterval(monitor, MONITOR_MS).unref();
}

module.exports = { start, computeHealth, isAgentHealthy };
