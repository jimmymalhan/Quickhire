'use strict';

/**
 * agentRouter.js — Core routing engine.
 *
 * For every task:
 *  1. Retrieve relevant memory from execution-patterns.json
 *  2. Match to the best local agent via agentRegistry
 *  3. Gate on agent health — skip degraded agents
 *  4. Execute the agent (child_process.spawn)
 *  5. Write learning back to execution-patterns.json
 *  6. Return structured result to caller
 *
 * agent is NOT called here. agent = advisor only.
 * Local agents = executors.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Dynamic require so registry changes take effect without server restart
const registryPath = require.resolve('./agentRegistry');
function findBestAgent(prompt) {
  delete require.cache[registryPath];
  return require('./agentRegistry').findBestAgent(prompt);
}
const { isAgentHealthy } = require('./agentHealthMonitor');

const stateDir = path.resolve(__dirname, '../../state/local-agent-runtime');
// Absolute path to the Quickhire project root — always injected into subprocess env
// so that agents that read state files work regardless of spawn cwd.
const quickhireRoot = path.resolve(__dirname, '../..');
const patternsPath = path.join(stateDir, 'execution-patterns.json');

const MAX_PATTERNS = 200;

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

// ─── memory retrieval ─────────────────────────────────────────────────────────

/**
 * Retrieve relevant past executions for a prompt.
 * Returns up to 3 patterns whose snippets share words with the prompt.
 */
function retrieveMemory(prompt) {
  const patterns = readJson(patternsPath, []);
  const words = prompt
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  return patterns
    .filter((p) => p.promptSnippet && words.some((w) => p.promptSnippet.toLowerCase().includes(w)))
    .slice(0, 3)
    .map(({ promptSnippet, resultStatus, agentId, durationMs, recordedAt }) => ({
      promptSnippet,
      resultStatus,
      agentId,
      durationMs,
      recordedAt,
    }));
}

// ─── learning write-back ──────────────────────────────────────────────────────

function recordLearning({ agentId, prompt, resultStatus, durationMs, outputSnippet }) {
  const existing = readJson(patternsPath, []);
  const entry = {
    id: `pat-${Date.now()}`,
    agentId,
    action: 'agent-chat',
    scope: 'agentRouter',
    promptSnippet: prompt.slice(0, 120),
    resultStatus,
    durationMs,
    outputSnippet: (outputSnippet || '').slice(0, 200),
    recordedAt: new Date().toISOString(),
  };
  writeJson(patternsPath, [entry, ...existing].slice(0, MAX_PATTERNS));
}

// ─── agent execution ──────────────────────────────────────────────────────────

/**
 * @param {object} agent        - Agent definition from registry
 * @param {string} prompt       - Original user prompt
 * @param {string} [cwd]        - Working directory override; falls back to
 *                                agent.executor.cwd then process.cwd()
 */
function spawnAgent(agent, prompt, cwd) {
  return new Promise((resolve) => {
    const startMs = Date.now();

    // Resolve effective working directory:
    //   1. Caller-provided cwd  (--cwd flag or req.body.cwd)
    //   2. Agent's own default  (executor.cwd, usually the project root)
    //   3. process.cwd()        (last resort)
    const effectiveCwd = cwd || agent.executor.cwd || process.cwd();

    const env = {
      ...process.env,
      AGENT_PROMPT: prompt,
      AGENT_ID: agent.id,
      // Always points to this project's root so state-file agents (backlog,
      // scale) resolve their paths correctly even when cwd is overridden.
      QUICKHIRE_ROOT: quickhireRoot,
      // Expose the effective working directory to the subprocess.
      AGENT_CWD: effectiveCwd,
    };

    const proc = spawn(agent.executor.cmd, agent.executor.args, {
      cwd: effectiveCwd,
      timeout: agent.timeout || 30000,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (d) => {
      stdout += d;
    });
    proc.stderr?.on('data', (d) => {
      stderr += d;
    });

    proc.on('error', (err) => {
      resolve({
        status: 'failed',
        durationMs: Date.now() - startMs,
        error: err.message,
        output: '',
      });
    });

    proc.on('close', (code) => {
      resolve({
        status: code === 0 ? 'complete' : 'failed',
        durationMs: Date.now() - startMs,
        output: stdout.slice(0, 1000),
        ...(stderr.trim() ? { error: stderr.slice(0, 400) } : {}),
      });
    });
  });
}

// ─── public route() ───────────────────────────────────────────────────────────

/**
 * Route a prompt to the best local agent and execute it.
 *
 * @param {string} prompt
 * @param {object} [options]
 * @param {string} [options.cwd]  Working directory override for execution.
 *                                Defaults to the agent's own cwd, then process.cwd().
 *
 * Returns:
 *  {
 *    routed:    boolean,
 *    agentId:   string | null,
 *    agentName: string | null,
 *    cwd:       string,            // effective working directory used
 *    memory:    PatternEntry[],
 *    result:    ExecutionResult | null
 *  }
 */
async function route(prompt, { cwd } = {}) {
  const memory = retrieveMemory(prompt);
  const agent = findBestAgent(prompt);

  if (!agent) {
    return {
      routed: false,
      agentId: null,
      agentName: null,
      cwd: cwd || process.cwd(),
      memory,
      result: null,
      error: 'No local agent matched this prompt. Add skills to agentRegistry.js or use /api/runtime/control to queue.',
    };
  }

  // Health gate — skip degraded agents (3+ failures in 5-min window).
  // agentHealthMonitor writes agent-health.json every 30 s; this is a cached read.
  if (!isAgentHealthy(agent.id)) {
    return {
      routed: false,
      agentId: agent.id,
      agentName: agent.name,
      cwd: cwd || process.cwd(),
      memory,
      result: null,
      error: `Agent '${agent.id}' is degraded — skipping. Will recover once failure rate drops.`,
    };
  }

  const result = await spawnAgent(agent, prompt, cwd);
  const effectiveCwd = cwd || agent.executor.cwd || process.cwd();

  recordLearning({
    agentId: agent.id,
    prompt,
    resultStatus: result.status,
    durationMs: result.durationMs,
    outputSnippet: result.output,
  });

  return {
    routed: true,
    agentId: agent.id,
    agentName: agent.name,
    cwd: effectiveCwd,
    memory,
    result,
  };
}

module.exports = { route, retrieveMemory, recordLearning, spawnAgent };
