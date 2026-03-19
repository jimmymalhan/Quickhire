'use strict';

/**
 * guardrailLoader.js — Loads and enforces local-agent-first guardrails at boot.
 *
 * Called once from src/index.js before worker/watchdog start.
 * Reads guardrail-config.json and sets process.env flags so all downstream
 * modules (agentWorker, agentRouter) can read them without importing this module.
 *
 * Hard enforcement:
 *   - CLAUDE_ENABLED=false → patches agentFallback to hard-fail immediately
 *   - LOCAL_AGENT_PRIMARY=true → no-op (agentRouter already local-first)
 *   - LOCAL_REVIEW_AGENT=true → enables escalation to local-review-agent
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const GUARDRAIL_FILE = path.resolve(__dirname, '../../.agent/guardrails/local-agent-first.md');
const CONFIG_FILE = path.resolve(
  __dirname,
  '../../state/local-agent-runtime/guardrail-config.json',
);

const DEFAULTS = {
  CLAUDE_ENABLED: false,
  CLAUDE_FALLBACK: false,
  LOCAL_AGENT_PRIMARY: true,
  LOCAL_REVIEW_AGENT: true,
  MAX_LOCAL_RETRIES: 3,
  ESCALATION_TARGET: 'local-review-agent',
  REQUIRE_COMPLETION_PROOF: true,
  NOOP_IS_FAIL: true,
};

let _config = null;

/**
 * Load guardrail-config.json (or defaults if missing).
 * Idempotent — returns cached object on repeated calls.
 */
function loadConfig() {
  if (_config) {return _config;}

  let fileConfig = {};
  try {
    fileConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (_) {
    // Config file missing — use defaults (safe: disables agent)
  }

  _config = { ...DEFAULTS, ...fileConfig };

  // Stamp process.env so any module can check without importing this file.
  // Booleans → 'true'/'false' strings (process.env is string-only).
  for (const [key, val] of Object.entries(_config)) {
    if (key.startsWith('_')) {continue;}
    if (process.env[key] === undefined) {
      process.env[key] = String(val);
    }
  }

  return _config;
}

/**
 * Returns true if agent is enabled (opt-in override only).
 * Default: false.
 */
function isagentEnabled() {
  const cfg = loadConfig();
  return cfg.CLAUDE_ENABLED === true;
}

/**
 * Returns the configured escalation target agent id.
 * Default: 'local-review-agent'.
 */
function escalationTarget() {
  const cfg = loadConfig();
  return cfg.ESCALATION_TARGET || 'local-review-agent';
}

/**
 * Returns max local retry count before escalation.
 * Default: 3.
 */
function maxLocalRetries() {
  const cfg = loadConfig();
  return typeof cfg.MAX_LOCAL_RETRIES === 'number' ? cfg.MAX_LOCAL_RETRIES : 3;
}

/**
 * Print guardrail banner to stdout at boot so operators can confirm config.
 * Always reads the guard file to prove it was loaded.
 */
function printBanner(loggerOverride) {
  const cfg = loadConfig();
  const log = loggerOverride || logger;

  let guardFileLoaded = false;
  try {
    fs.readFileSync(GUARDRAIL_FILE, 'utf8');
    guardFileLoaded = true;
  } catch (_) {
    // Guard file missing — still functional, but warn
  }

  const lines = [
    '══════════════════════════════════════════════',
    ' LOCAL-AGENT-FIRST GUARDRAILS ACTIVE',
    `  Guard file loaded : ${guardFileLoaded}`,
    `  CLAUDE_ENABLED    : ${cfg.CLAUDE_ENABLED}`,
    `  CLAUDE_FALLBACK   : ${cfg.CLAUDE_FALLBACK}`,
    `  LOCAL_AGENT_PRIMARY: ${cfg.LOCAL_AGENT_PRIMARY}`,
    `  LOCAL_REVIEW_AGENT: ${cfg.LOCAL_REVIEW_AGENT}`,
    `  MAX_LOCAL_RETRIES : ${cfg.MAX_LOCAL_RETRIES}`,
    `  ESCALATION_TARGET : ${cfg.ESCALATION_TARGET}`,
    '══════════════════════════════════════════════',
  ];

  lines.forEach((l) => log.info(l));
}

module.exports = { loadConfig, isagentEnabled, escalationTarget, maxLocalRetries, printBanner };
