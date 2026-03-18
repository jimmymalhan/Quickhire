'use strict';

const fs = require('fs');
const path = require('path');

const { route } = require('../../automation/agentRouter');
const { listAgents, getAgent } = require('../../automation/agentRegistry');
const { computeHealth } = require('../../automation/agentHealthMonitor');

const stateDir = path.resolve(__dirname, '../../../state/local-agent-runtime');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

// ─── POST /api/agents/chat ────────────────────────────────────────────────────

const chat = async (req, res) => {
  const message = req.body?.message;
  const rawCwd = req.body?.cwd;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'message is required and must be a non-empty string',
      traceId: req.headers['x-request-id'] || null,
      meta: { recovery: 'Include a "message" field in the request body' },
    });
  }

  // Validate cwd when provided
  let cwd;
  if (rawCwd !== undefined) {
    if (typeof rawCwd !== 'string' || !rawCwd.trim()) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'cwd must be a non-empty string path',
        traceId: req.headers['x-request-id'] || null,
        meta: { recovery: 'Provide an absolute directory path or omit cwd to use the default' },
      });
    }
    cwd = path.resolve(rawCwd.trim());
    if (!fs.existsSync(cwd)) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_CWD',
        message: `cwd '${cwd}' does not exist`,
        traceId: req.headers['x-request-id'] || null,
        meta: { recovery: 'Provide a path to an existing directory' },
      });
    }
    if (!fs.statSync(cwd).isDirectory()) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_CWD',
        message: `cwd '${cwd}' is not a directory`,
        traceId: req.headers['x-request-id'] || null,
        meta: { recovery: 'Provide a path to a directory, not a file' },
      });
    }
  }

  const result = await route(message.trim(), { cwd });

  res.json({
    status: 'success',
    code: 200,
    data: result,
    meta: { timestamp: new Date().toISOString() },
  });
};

// ─── GET /api/agents ──────────────────────────────────────────────────────────

const listAgentsHandler = async (_req, res) => {
  const agents = listAgents();
  const healthData = readJson(path.join(stateDir, 'agent-health.json'), { agents: [] });
  const healthMap = Object.fromEntries((healthData.agents || []).map((a) => [a.id, a.status]));

  const enriched = agents.map((a) => ({
    ...a,
    healthStatus: healthMap[a.id] || 'unknown',
  }));

  res.json({
    status: 'success',
    code: 200,
    data: { agents: enriched, total: enriched.length },
    meta: { timestamp: new Date().toISOString() },
  });
};

// ─── GET /api/agents/health ───────────────────────────────────────────────────

const getAgentHealth = async (_req, res) => {
  // Recompute live (not cached) so the response is always current
  const agents = computeHealth();

  res.json({
    status: 'success',
    code: 200,
    data: {
      agents,
      summary: {
        healthy: agents.filter((a) => a.status === 'healthy').length,
        warning: agents.filter((a) => a.status === 'warning').length,
        degraded: agents.filter((a) => a.status === 'degraded').length,
        total: agents.length,
      },
      checkedAt: new Date().toISOString(),
    },
    meta: { timestamp: new Date().toISOString() },
  });
};

// ─── GET /api/agents/:id ──────────────────────────────────────────────────────

const getAgentById = async (req, res) => {
  const agent = getAgent(req.params.id);

  if (!agent) {
    return res.status(404).json({
      status: 'error',
      code: 'NOT_FOUND',
      message: `Agent '${req.params.id}' not found`,
      traceId: req.headers['x-request-id'] || null,
      meta: { recovery: 'Call GET /api/agents to list available agent IDs' },
    });
  }

  const healthData = readJson(path.join(stateDir, 'agent-health.json'), { agents: [] });
  const healthEntry = (healthData.agents || []).find((a) => a.id === agent.id);

  res.json({
    status: 'success',
    code: 200,
    data: { ...agent, health: healthEntry || null },
    meta: { timestamp: new Date().toISOString() },
  });
};

module.exports = { chat, listAgentsHandler, getAgentHealth, getAgentById };
