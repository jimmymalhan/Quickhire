const fs = require('fs');
const path = require('path');
const config = require('../../utils/config');

const fallbackStateDir = path.resolve(__dirname, '../../../state/local-agent-runtime');
const learningsDir = path.resolve(__dirname, '../../../.learnings');

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_err) {
    return fallback;
  }
}

function resolveStateDir() {
  const configuredPath = config.runtime.stateDir;
  const configuredProgress = path.join(configuredPath, 'progress.json');

  if (fs.existsSync(configuredProgress)) {
    return configuredPath;
  }

  return fallbackStateDir;
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

  if (!progress) {
    return {
      generatedAt: new Date().toISOString(),
      overallProgress: 0,
      remainingPercent: 100,
      blockerCount: 0,
      tasks: [],
      sessions: [],
      blockers: [],
      upcomingTasks: ['Connect local-agent-runtime progress feed'],
      source: {
        provider: 'local-agent-runtime',
        stateDir,
        connected: false,
      },
    };
  }

  const tasks = (progress.stages || []).map((stage) => ({
    id: stage.id,
    title: stage.label || stage.id,
    status: toTaskStatus(stage.status),
    progress: Number(stage.percent || 0),
    owner: stage.id,
    etaMinutes: stage.status === 'completed' ? 0 : null,
    blockerId: stage.status === 'failed' ? `failed-${stage.id}` : null,
  }));

  const blockers = [
    ...(coordination.collisions || []).map((collision, index) => ({
      id: collision.id || `collision-${index}`,
      title: collision.title || collision.reason || 'Agent coordination collision',
      severity: 'high',
      etaMinutes: 15,
      options: ['Reassign owner', 'Retry stage', 'Take over in lead lane'],
    })),
    ...tasks
      .filter((task) => task.status === 'blocked')
      .map((task) => ({
        id: `task-${task.id}`,
        title: `${task.title} is blocked`,
        severity: 'medium',
        etaMinutes: 20,
        options: ['Inspect stage detail', 'Fallback executor', 'Repair runtime state'],
      })),
  ];

  const sessions = (coordination.claims || []).map((claim, index) => ({
    id: claim.id || `claim-${index}`,
    owner: claim.owner || claim.agent || 'local-agent',
    model: claim.model || 'local-agent-runtime',
    status: claim.status || 'running',
    currentTask: claim.task || claim.stage || 'Assigned work',
    startedAt: claim.started_at || progress.started_at || new Date().toISOString(),
    lastHeartbeatAt: claim.updated_at || progress.updated_at || new Date().toISOString(),
  }));

  const syntheticSessions = sessions.length > 0
    ? sessions
    : tasks
      .filter((task) => task.status === 'in_progress')
      .map((task) => ({
        id: `session-${task.id}`,
        owner: task.owner,
        model: 'local-agent-runtime',
        status: 'running',
        currentTask: task.title,
        startedAt: progress.started_at || new Date().toISOString(),
        lastHeartbeatAt: progress.updated_at || new Date().toISOString(),
      }));

  const activeTasks = tasks.filter((t) => t.status === 'in_progress');
  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const startedAt = progress.started_at ? new Date(progress.started_at) : new Date();
  const elapsedHours = Math.max(0.1, (Date.now() - startedAt.getTime()) / 3600000);
  const remainingPercent = Number(progress.overall?.remaining_percent || 100);
  const etaTotalMinutes = completedCount > 0
    ? Math.round((remainingPercent / (100 - remainingPercent)) * elapsedHours * 60)
    : activeTasks.length * 30;

  const executiveDecisions = (coordination.decisions || []).map((d, i) => ({
    id: d.id || `dec-${i}`,
    role: d.role || 'manager',
    owner: d.owner || 'System',
    action: d.action || d.title || 'Decision recorded',
    priority: d.priority || 'medium',
    timestamp: d.timestamp || progress.updated_at || new Date().toISOString(),
    outcome: d.outcome || null,
  }));

  const resourceUsage = workflow.resourceUsage
    ? {
        cpuPercent: workflow.resourceUsage.cpuPercent || 0,
        memoryPercent: workflow.resourceUsage.memoryPercent || 0,
        cpuThreshold: workflow.resourceUsage.cpuThreshold || 90,
        memoryThreshold: workflow.resourceUsage.memoryThreshold || 90,
      }
    : { cpuPercent: 0, memoryPercent: 0, cpuThreshold: 90, memoryThreshold: 90 };

  return {
    generatedAt: progress.updated_at || new Date().toISOString(),
    overallProgress: Number(progress.overall?.percent || 0),
    remainingPercent,
    blockerCount: blockers.length,
    etaTotalMinutes,
    tasks,
    sessions: syntheticSessions,
    blockers,
    upcomingTasks: workflow.inProgressWorkflows?.length
      ? workflow.inProgressWorkflows
      : ['Stream runtime events', 'Resolve active blockers', 'Advance queued stages'],
    completedWorkflows: workflow.completedWorkflows || [],
    executiveDecisions,
    resourceUsage,
    roiMetrics: {
      tasksCompletedPerHour: Math.round(completedCount / elapsedHours * 10) / 10,
      blockersResolvedPerHour: Math.round((coordination.resolvedCollisions || 0) / elapsedHours * 10) / 10,
      localAgentUtilization: syntheticSessions.length > 0
        ? Math.round((syntheticSessions.filter((s) => s.status === 'running').length / syntheticSessions.length) * 100)
        : 0,
      cloudApiCallsSaved: coordination.localCompletions || 0,
    },
    lessons: parseLearningHeadings(path.join(learningsDir, 'LEARNINGS.md')),
    decisions: parseLearningHeadings(path.join(learningsDir, 'FEATURE_REQUESTS.md')),
    source: {
      provider: 'local-agent-runtime',
      stateDir,
      connected: true,
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

const streamRuntimeProgress = async (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

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

module.exports = { getRuntimeProgress, streamRuntimeProgress };
