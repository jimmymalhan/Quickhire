const fs = require('fs');
const path = require('path');
const config = require('../../utils/config');

const fallbackStateDir = path.resolve(__dirname, '../../../state/local-agent-runtime');
const learningsDir = path.resolve(__dirname, '../../../.learnings');
const runtimeSchemaVersion = '1.1';
const orchestrationSchemaVersion = '1.0';

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_err) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max, fallback) {
  const parsed = toNumber(value, fallback);
  return Math.min(max, Math.max(min, parsed));
}

function isValidDate(value) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function toIsoString(value, fallback = null) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function minutesBetween(start, end = new Date()) {
  if (!start || !isValidDate(start)) {
    return null;
  }

  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

function resolveStateDir() {
  const configuredPath = config.runtime.stateDir;
  const configuredProgress = path.join(configuredPath, 'progress.json');

  if (fs.existsSync(configuredProgress)) {
    return configuredPath;
  }

  return fallbackStateDir;
}

function resolveControlsPath(stateDir) {
  return path.join(stateDir, 'orchestration-controls.json');
}

function buildToolLinks() {
  return [
    {
      id: 'local-agent-runtime',
      label: 'Local Agent Runtime',
      href: 'https://github.com/jimmymalhan/local-agent-runtime',
      category: 'runtime',
    },
    {
      id: 'openclaw',
      label: 'OpenClaw',
      href: 'https://github.com/openclaw/openclaw',
      category: 'ui',
    },
    {
      id: 'agency',
      label: 'Agency Agents',
      href: 'https://github.com/msitarzewski/agency-agents',
      category: 'teams',
    },
    {
      id: 'promptfoo',
      label: 'Promptfoo',
      href: 'https://github.com/promptfoo/promptfoo',
      category: 'validation',
    },
    {
      id: 'nanochat',
      label: 'NanoChat',
      href: 'https://github.com/karpathy/nanochat',
      category: 'models',
    },
  ];
}

function buildDefaultOrchestrationState(options = {}) {
  const generatedAt = new Date().toISOString();

  return {
    schemaVersion: orchestrationSchemaVersion,
    controller: {
      mode: 'clawbot-assisted',
      owner: 'clawbot-ceo',
      preferredProvider: 'local',
      preferredLane: 'local-agents',
      targetAgentScale: 12,
      maxAgentScale: 24,
      mainSessionCapPercent: 10,
      cloudFallbackEnabled: false,
      takeoverEnabled: true,
      backlogStrategy: 'parallel-first',
      status: 'armed',
      updatedAt: generatedAt,
    },
    guardrails: {
      cpuLimitPercent: options.cpuThreshold ?? 90,
      memoryLimitPercent: options.memoryThreshold ?? 90,
      requireApprovalForDestructive: true,
      autoRestoreDryRun: true,
      roiKillSwitch: true,
    },
    pendingCommands: [],
    toolLinks: buildToolLinks(),
    lastCommandAt: null,
  };
}

function readOrchestrationState(stateDir, options = {}) {
  const defaults = buildDefaultOrchestrationState(options);
  const persisted = readJson(resolveControlsPath(stateDir), null);

  if (!persisted) {
    return defaults;
  }

  return {
    ...defaults,
    ...persisted,
    controller: {
      ...defaults.controller,
      ...(persisted.controller || {}),
    },
    guardrails: {
      ...defaults.guardrails,
      ...(persisted.guardrails || {}),
    },
    pendingCommands: Array.isArray(persisted.pendingCommands)
      ? persisted.pendingCommands.slice(0, 12)
      : defaults.pendingCommands,
    toolLinks:
      Array.isArray(persisted.toolLinks) && persisted.toolLinks.length > 0
        ? persisted.toolLinks
        : defaults.toolLinks,
  };
}

function persistOrchestrationState(stateDir, nextState) {
  writeJson(resolveControlsPath(stateDir), nextState);
  return nextState;
}

function parseLearningHeadings(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.startsWith('## '))
      .map((line) => line.replace(/^##\s*/, '').trim())
      .slice(0, 5);
  } catch (_err) {
    return [];
  }
}

function toTaskStatus(status) {
  if (status === 'completed') {
    return 'done';
  }
  if (status === 'failed') {
    return 'blocked';
  }
  if (status === 'running') {
    return 'in_progress';
  }
  return 'queued';
}

function countBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildEmptySnapshot(stateDir) {
  const orchestration = buildDefaultOrchestrationState();
  return {
    generatedAt: new Date().toISOString(),
    project: {
      name: 'Quickhire runtime integration',
      currentStage: null,
      status: 'idle',
      percent: 0,
      remainingPercent: 100,
      stageCount: 0,
      completedStageCount: 0,
      activeStageCount: 0,
      etaMinutes: null,
      startedAt: null,
      updatedAt: null,
    },
    overallProgress: 0,
    remainingPercent: 100,
    blockerCount: 0,
    etaTotalMinutes: null,
    tasks: [],
    sessions: [],
    sessionOwnership: {
      activeCount: 0,
      owners: [],
      ownersByModel: {},
      ownersByRole: {},
    },
    blockers: [],
    blockerMetadata: {
      source: 'local-agent-runtime',
      total: 0,
      bySeverity: { low: 0, medium: 0, high: 0 },
    },
    projectProgress: {
      completedStageCount: 0,
      activeStageCount: 0,
      remainingStageCount: 0,
      status: 'idle',
      currentStage: null,
    },
    upcomingTasks: ['Connect local-agent-runtime progress feed'],
    completedWorkflows: [],
    executiveDecisions: [],
    resourceUsage: {
      cpuPercent: 0,
      memoryPercent: 0,
      cpuThreshold: 90,
      memoryThreshold: 90,
    },
    roiMetrics: {
      tasksCompletedPerHour: 0,
      blockersResolvedPerHour: 0,
      localAgentUtilization: 0,
      cloudApiCallsSaved: 0,
    },
    lessons: [],
    decisions: [],
    orchestration,
    source: {
      provider: 'local-agent-runtime',
      stateDir,
      connected: false,
      schemaVersion: runtimeSchemaVersion,
      files: {
        progress: path.join(stateDir, 'progress.json'),
        coordination: path.join(stateDir, 'agent-coordination.json'),
        workflow: path.join(stateDir, 'workflow-state.json'),
        controls: resolveControlsPath(stateDir),
      },
      capturedAt: new Date().toISOString(),
      refreshIntervalMs: 3000,
    },
  };
}

function buildSnapshot() {
  const stateDir = resolveStateDir();
  const progress = readJson(path.join(stateDir, 'progress.json'), null);
  const coordination = readJson(path.join(stateDir, 'agent-coordination.json'), {
    claims: [],
    collisions: [],
  });
  const workflow = readJson(path.join(stateDir, 'workflow-state.json'), {
    inProgressWorkflows: [],
    completedWorkflows: [],
  });
  const workflowState = readJson(path.join(stateDir, 'workflow-state.json'), {
    inProgressWorkflows: [],
    completedWorkflows: [],
    resourceUsage: {
      cpuPercent: 0,
      memoryPercent: 0,
      cpuThreshold: 90,
      memoryThreshold: 90,
    },
  });

  if (!progress) {
    return buildEmptySnapshot(stateDir);
  }

  const stages = Array.isArray(progress.stages) ? progress.stages : [];
  const claims = Array.isArray(coordination.claims) ? coordination.claims : [];
  const collisions = Array.isArray(coordination.collisions) ? coordination.collisions : [];
  const decisions = Array.isArray(coordination.decisions) ? coordination.decisions : [];
  const progressStatus = progress.overall?.status || 'running';
  const overallProgress = clamp(progress.overall?.percent, 0, 100, 0);
  const remainingPercent = clamp(
    progress.overall?.remaining_percent,
    0,
    100,
    Math.max(0, 100 - overallProgress),
  );
  const startedAt = toIsoString(progress.started_at, new Date().toISOString());
  const updatedAt = toIsoString(progress.updated_at, new Date().toISOString());
  const activeStages = stages.filter((stage) => stage.status === 'running');
  const blockedStages = stages.filter((stage) => stage.status === 'failed');

  const tasks = stages.map((stage, index) => {
    const taskStatus = toTaskStatus(stage.status);
    return {
      id: stage.id || `stage-${index}`,
      title: stage.label || stage.id || `Stage ${index + 1}`,
      status: taskStatus,
      progress: clamp(stage.percent, 0, 100, 0),
      owner: stage.owner || stage.id || 'local-agent',
      etaMinutes:
        taskStatus === 'done'
          ? 0
          : minutesBetween(
              stage.started_at || progress.started_at,
              stage.completed_at || updatedAt,
            ),
      blockerId: taskStatus === 'blocked' ? `blocker-${stage.id || index}` : null,
      source: {
        file: 'progress.json',
        stageId: stage.id || null,
      },
      startedAt: toIsoString(stage.started_at, null),
      completedAt: toIsoString(stage.completed_at, null),
      weight: clamp(stage.weight, 0, 100, 0),
      detail: stage.detail || '',
    };
  });

  const blockerTasks = tasks.filter((task) => task.status === 'blocked');
  const blockers = [
    ...collisions.map((collision, index) => ({
      id: collision.id || `collision-${index}`,
      title: collision.title || collision.reason || 'Agent coordination collision',
      severity: collision.severity || 'high',
      etaMinutes: clamp(collision.etaMinutes, 1, 1440, 15),
      options:
        Array.isArray(collision.options) && collision.options.length > 0
          ? collision.options
          : ['Reassign owner', 'Retry stage', 'Take over in lead lane'],
      source: {
        file: 'agent-coordination.json',
        type: 'collision',
      },
      owner: collision.owner || null,
      stageId: collision.stageId || null,
      createdAt: toIsoString(collision.created_at, null),
      updatedAt: toIsoString(collision.updated_at, updatedAt),
      resolutionPath: collision.resolutionPath || collision.resolution_path || [],
    })),
    ...blockerTasks.map((task) => ({
      id: task.blockerId || `task-${task.id}`,
      title: task.detail ? `${task.title}: ${task.detail}` : `${task.title} is blocked`,
      severity: 'medium',
      etaMinutes: clamp(task.etaMinutes, 1, 1440, 20),
      options: ['Inspect stage detail', 'Fallback executor', 'Repair runtime state'],
      source: {
        file: 'progress.json',
        type: 'blocked-stage',
      },
      owner: task.owner,
      stageId: task.id,
      createdAt: task.startedAt,
      updatedAt,
      resolutionPath: ['Inspect current stage', 'Assign fallback lane', 'Unblock runtime state'],
    })),
  ];

  const sessions = claims.map((claim, index) => ({
    id: claim.id || `claim-${index}`,
    owner: claim.owner || claim.agent || 'local-agent',
    model: claim.model || 'local-agent-runtime',
    status: claim.status || 'running',
    currentTask: claim.task || claim.stage || 'Assigned work',
    role: claim.role || 'agent',
    provider: claim.provider || 'local',
    startedAt: toIsoString(claim.started_at || startedAt, new Date().toISOString()),
    lastHeartbeatAt: toIsoString(claim.updated_at || progress.updated_at, new Date().toISOString()),
    source: {
      file: 'agent-coordination.json',
      claimId: claim.id || null,
    },
  }));

  const syntheticSessions =
    sessions.length > 0
      ? sessions
      : tasks
          .filter((task) => task.status === 'in_progress')
          .map((task) => ({
            id: `session-${task.id}`,
            owner: task.owner,
            model: 'local-agent-runtime',
            status: 'running',
            currentTask: task.title,
            role: 'agent',
            provider: 'local',
            startedAt: startedAt || new Date().toISOString(),
            lastHeartbeatAt: updatedAt,
            source: {
              file: 'progress.json',
              stageId: task.id,
              synthetic: true,
            },
          }));

  const activeTasks = tasks.filter((t) => t.status === 'in_progress');
  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const elapsedHours = Math.max(0.1, (Date.now() - new Date(startedAt).getTime()) / 3600000);
  const etaTotalMinutes =
    progressStatus === 'completed'
      ? 0
      : activeTasks.length > 0
        ? activeTasks.reduce((sum, task) => sum + (task.etaMinutes || 0), 0) ||
          activeTasks.length * 30
        : Math.round((remainingPercent / 100) * stages.length * 30);

  const executiveDecisions = decisions.map((d, i) => ({
    id: d.id || `dec-${i}`,
    role: d.role || 'manager',
    owner: d.owner || 'System',
    action: d.action || d.title || 'Decision recorded',
    priority: d.priority || 'medium',
    timestamp: toIsoString(d.timestamp, updatedAt),
    outcome: d.outcome || null,
    source: {
      file: 'agent-coordination.json',
      decisionId: d.id || null,
    },
  }));

  const resourceUsage = workflowState.resourceUsage
    ? {
        cpuPercent: clamp(workflowState.resourceUsage.cpuPercent, 0, 100, 0),
        memoryPercent: clamp(workflowState.resourceUsage.memoryPercent, 0, 100, 0),
        cpuThreshold: clamp(workflowState.resourceUsage.cpuThreshold, 1, 100, 90),
        memoryThreshold: clamp(workflowState.resourceUsage.memoryThreshold, 1, 100, 90),
      }
    : { cpuPercent: 0, memoryPercent: 0, cpuThreshold: 90, memoryThreshold: 90 };

  const bySeverity = countBy(blockers, (blocker) => blocker.severity || 'low');
  const activeOwners = syntheticSessions.map((session) => session.owner);
  const ownersByModel = countBy(syntheticSessions, (session) => session.model || 'unknown');
  const ownersByRole = countBy(syntheticSessions, (session) => session.role || 'agent');
  const orchestration = readOrchestrationState(stateDir, {
    cpuThreshold: resourceUsage.cpuThreshold,
    memoryThreshold: resourceUsage.memoryThreshold,
  });

  return {
    generatedAt: updatedAt,
    project: {
      name: progress.task || 'Quickhire runtime integration',
      currentStage: progress.current_stage || null,
      status: progressStatus,
      percent: overallProgress,
      remainingPercent,
      stageCount: stages.length,
      completedStageCount: completedCount,
      activeStageCount: activeStages.length,
      blockedStageCount: blockedStages.length,
      etaMinutes: etaTotalMinutes,
      startedAt,
      updatedAt,
    },
    projectProgress: {
      totalStages: stages.length,
      completedStageCount: completedCount,
      activeStageCount: activeStages.length,
      blockedStageCount: blockedStages.length,
      remainingStageCount: Math.max(0, stages.length - completedCount),
      status: progressStatus,
      currentStage: progress.current_stage || null,
    },
    overallProgress,
    remainingPercent,
    blockerCount: blockers.length,
    etaTotalMinutes,
    tasks,
    sessions: syntheticSessions,
    sessionOwnership: {
      activeCount: syntheticSessions.filter((session) => session.status === 'running').length,
      owners: Array.from(new Set(activeOwners)),
      ownersByModel,
      ownersByRole,
    },
    blockers,
    blockerMetadata: {
      source: 'local-agent-runtime',
      total: blockers.length,
      bySeverity,
      activeCount: blockers.length,
    },
    upcomingTasks: workflowState.inProgressWorkflows?.length
      ? workflowState.inProgressWorkflows
      : ['Stream runtime events', 'Resolve active blockers', 'Advance queued stages'],
    completedWorkflows: workflowState.completedWorkflows || [],
    executiveDecisions,
    resourceUsage,
    roiMetrics: {
      tasksCompletedPerHour: Math.round((completedCount / elapsedHours) * 10) / 10,
      blockersResolvedPerHour:
        Math.round(((coordination.resolvedCollisions || 0) / elapsedHours) * 10) / 10,
      localAgentUtilization:
        syntheticSessions.length > 0
          ? Math.round(
              (syntheticSessions.filter((s) => s.status === 'running').length /
                syntheticSessions.length) *
                100,
            )
          : 0,
      cloudApiCallsSaved: coordination.localCompletions || 0,
    },
    lessons: parseLearningHeadings(path.join(learningsDir, 'LEARNINGS.md')),
    decisions: parseLearningHeadings(path.join(learningsDir, 'FEATURE_REQUESTS.md')),
    orchestration,
    source: {
      provider: 'local-agent-runtime',
      stateDir,
      connected: true,
      schemaVersion: runtimeSchemaVersion,
      files: {
        progress: path.join(stateDir, 'progress.json'),
        coordination: path.join(stateDir, 'agent-coordination.json'),
        workflow: path.join(stateDir, 'workflow-state.json'),
        controls: resolveControlsPath(stateDir),
        learnings: path.join(learningsDir, 'LEARNINGS.md'),
        featureRequests: path.join(learningsDir, 'FEATURE_REQUESTS.md'),
      },
      fields: {
        stateDir,
        progressFile: path.join(stateDir, 'progress.json'),
        coordinationFile: path.join(stateDir, 'agent-coordination.json'),
        workflowFile: path.join(stateDir, 'workflow-state.json'),
        controlsFile: resolveControlsPath(stateDir),
        learningsFile: path.join(learningsDir, 'LEARNINGS.md'),
        featureRequestsFile: path.join(learningsDir, 'FEATURE_REQUESTS.md'),
      },
      capturedAt: updatedAt,
      refreshIntervalMs: 3000,
    },
  };
}

const getRuntimeProgress = async (_req, res) => {
  const snapshot = buildSnapshot();

  res.json({
    status: 'success',
    code: 200,
    data: snapshot,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
};

const getRuntimeControl = async (_req, res) => {
  const snapshot = buildSnapshot();

  res.json({
    status: 'success',
    code: 200,
    data: snapshot.orchestration,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
};

const updateRuntimeControl = async (req, res) => {
  const snapshot = buildSnapshot();
  const stateDir = resolveStateDir();
  const current = readOrchestrationState(stateDir, {
    cpuThreshold: snapshot.resourceUsage?.cpuThreshold,
    memoryThreshold: snapshot.resourceUsage?.memoryThreshold,
  });

  const nextState = {
    ...current,
    controller: {
      ...current.controller,
      ...((req.body && req.body.controller) || {}),
      updatedAt: new Date().toISOString(),
    },
    guardrails: {
      ...current.guardrails,
      ...((req.body && req.body.guardrails) || {}),
    },
  };

  persistOrchestrationState(stateDir, nextState);

  res.json({
    status: 'success',
    code: 200,
    data: nextState,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
};

const handleRuntimePrompt = async (req, res) => {
  const prompt = req.body?.prompt;
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'prompt is required and must be a non-empty string',
      traceId: req.headers['x-request-id'] || null,
      meta: { recovery: 'Include a "prompt" field in the request body' },
    });
  }

  const stateDir = resolveStateDir();
  const snapshot = buildSnapshot();
  const current = readOrchestrationState(stateDir, {
    cpuThreshold: snapshot.resourceUsage?.cpuThreshold,
    memoryThreshold: snapshot.resourceUsage?.memoryThreshold,
  });
  const createdAt = new Date().toISOString();
  const command = {
    id: `cmd-${Date.now()}`,
    label: prompt.slice(0, 80),
    action: 'agent-router-dispatch',
    scope: 'agentRouter',
    requestedBy: req.body?.requestedBy || 'clawbot-ui',
    target: current.controller.preferredLane,
    value: { prompt: prompt.trim() },
    status: 'queued',
    createdAt,
  };

  const nextState = {
    ...current,
    pendingCommands: [command, ...current.pendingCommands].slice(0, 12),
    lastCommandAt: createdAt,
  };

  persistOrchestrationState(stateDir, nextState);

  res.json({
    status: 'success',
    code: 200,
    data: { command, orchestration: nextState },
    meta: { timestamp: createdAt },
  });
};

const queueRuntimeCommand = async (req, res) => {
  const snapshot = buildSnapshot();
  const stateDir = resolveStateDir();
  const current = readOrchestrationState(stateDir, {
    cpuThreshold: snapshot.resourceUsage?.cpuThreshold,
    memoryThreshold: snapshot.resourceUsage?.memoryThreshold,
  });
  const createdAt = new Date().toISOString();
  const command = {
    id: `cmd-${Date.now()}`,
    label: req.body?.label || req.body?.action || 'runtime-command',
    action: req.body?.action || 'update',
    scope: req.body?.scope || 'runtime',
    requestedBy: req.body?.requestedBy || 'clawbot-ui',
    target: req.body?.target || current.controller.preferredLane,
    value: req.body?.value ?? null,
    status: 'queued',
    createdAt,
  };

  const nextState = {
    ...current,
    pendingCommands: [command, ...current.pendingCommands].slice(0, 12),
    lastCommandAt: createdAt,
  };

  persistOrchestrationState(stateDir, nextState);

  res.json({
    status: 'success',
    code: 200,
    data: nextState,
    meta: {
      timestamp: createdAt,
    },
  });
};

const streamRuntimeProgress = async (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
  res.write('retry: 3000\n');

  const writeSnapshot = () => {
    const snapshot = buildSnapshot();
    res.write(`event: progress\n`);
    res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
  };

  writeSnapshot();
  const intervalId = setInterval(writeSnapshot, 3000);

  _req.on('close', () => {
    clearInterval(intervalId);
    res.end();
  });
};

const VALID_CMD_STATUSES = ['queued', 'running', 'complete', 'failed', 'escalated'];

const updateCommandStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};

  if (!status || !VALID_CMD_STATUSES.includes(status)) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: `status must be one of: ${VALID_CMD_STATUSES.join(', ')}`,
      traceId: req.headers['x-request-id'] || null,
      meta: { recovery: 'Provide a valid status in the request body' },
    });
  }

  const stateDir = resolveStateDir();
  const current = readOrchestrationState(stateDir);
  const found = (current.pendingCommands || []).find((c) => c.id === id);

  if (!found) {
    return res.status(404).json({
      status: 'error',
      code: 'NOT_FOUND',
      message: `Command ${id} not found`,
      traceId: req.headers['x-request-id'] || null,
    });
  }

  const updatedAt = new Date().toISOString();
  const commands = (current.pendingCommands || []).map((cmd) =>
    cmd.id === id ? { ...cmd, status, updatedAt } : cmd,
  );

  const nextState = { ...current, pendingCommands: commands };
  persistOrchestrationState(stateDir, nextState);

  res.json({
    status: 'success',
    code: 200,
    data: { id, status, updatedAt },
    meta: { timestamp: updatedAt },
  });
};

const getWorkerStatus = async (_req, res) => {
  const stateDir = resolveStateDir();
  const workerState = readJson(path.join(stateDir, 'worker-state.json'), { status: 'not-started' });
  const recentLogs = readJson(path.join(stateDir, 'worker-logs.json'), []).slice(-20);
  const controls = readOrchestrationState(stateDir);
  const commands = controls.pendingCommands || [];
  const terminal = ['complete', 'failed', 'escalated'];
  const done = commands.filter((c) => terminal.includes(c.status)).length;
  const total = commands.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  res.json({
    status: 'success',
    code: 200,
    data: {
      workerState,
      progress,
      counts: {
        total,
        done,
        queued: commands.filter((c) => c.status === 'queued').length,
        running: commands.filter((c) => c.status === 'running').length,
        escalated: commands.filter((c) => c.status === 'escalated').length,
      },
      recentLogs,
    },
    meta: { timestamp: new Date().toISOString() },
  });
};

module.exports = {
  getRuntimeProgress,
  streamRuntimeProgress,
  getRuntimeControl,
  updateRuntimeControl,
  queueRuntimeCommand,
  handleRuntimePrompt,
  updateCommandStatus,
  getWorkerStatus,
};
