'use strict';

/**
 * agentRegistry.js — Maps skill keywords to deterministic local executors.
 * No Claude. No API calls. Pure local execution.
 *
 * Each agent has:
 *   id          — unique identifier
 *   name        — display name
 *   description — what it does
 *   skills      — keywords used for routing
 *   executor    — {cmd, args, cwd} passed to child_process.spawn
 *   timeout     — ms before the process is killed
 */

const path = require('path');

const root = path.resolve(__dirname, '../..');

// Agent capability tiers
// 'feature'  — can execute free-form FEATURE: prompts (writes files, calls LLMs)
// 'run'      — runs deterministic commands (test, lint, build, db, health, git)
// 'admin'    — admin-only state mutations, must never receive free-form prompts
const FEATURE_PROMPT_RE = /^FEATURE\s*:/i;

const AGENTS = [
  {
    id: 'test-agent',
    name: 'Test Runner',
    description: 'Runs Jest/Vitest unit, integration, and coverage tests',
    capabilities: ['run'],
    skills: ['test', 'spec', 'coverage', 'jest', 'vitest', 'unit', 'integration', 'passing'],
    executor: { cmd: 'npm', args: ['test', '--', '--passWithNoTests'], cwd: root },
    timeout: 120000,
  },
  {
    id: 'lint-agent',
    name: 'Lint Checker',
    description: 'Runs ESLint and Prettier checks',
    capabilities: ['run'],
    skills: ['lint', 'eslint', 'format', 'style', 'prettier', 'quality', 'errors'],
    executor: { cmd: 'npm', args: ['run', 'lint'], cwd: root },
    timeout: 30000,
  },
  {
    id: 'build-agent',
    name: 'Build Runner',
    description: 'Compiles and bundles frontend and backend',
    capabilities: ['run'],
    skills: ['build', 'compile', 'bundle', 'vite', 'webpack', 'dist', 'output'],
    executor: { cmd: 'npm', args: ['run', 'build'], cwd: root },
    timeout: 120000,
  },
  {
    id: 'db-agent',
    name: 'Database Agent',
    description: 'Runs database migrations',
    capabilities: ['run'],
    skills: ['migrate', 'migration', 'database', 'db', 'seed', 'schema', 'table'],
    executor: { cmd: 'npm', args: ['run', 'db:migrate'], cwd: root },
    timeout: 60000,
  },
  {
    id: 'health-agent',
    name: 'Health Checker',
    description: 'Pings the API server health endpoint',
    capabilities: ['run'],
    skills: ['health', 'ping', 'check', 'connectivity', 'up', 'alive'],
    executor: {
      cmd: 'node',
      args: [
        '-e',
        [
          'const h=require("http");',
          'h.get("http://localhost:8000/api/health",r=>{',
          'process.stdout.write("status:"+r.statusCode);',
          'process.exit(r.statusCode===200?0:1);',
          '}).on("error",e=>{process.stderr.write(e.message);process.exit(1);});',
        ].join(''),
      ],
      cwd: root,
    },
    timeout: 10000,
  },
  {
    id: 'git-agent',
    name: 'Git Agent',
    description: 'Reports git status, log, and diff',
    capabilities: ['run'],
    skills: ['git', 'commit', 'diff', 'log', 'status', 'branch', 'changes', 'staged'],
    executor: { cmd: 'git', args: ['status', '--short'], cwd: root },
    timeout: 15000,
  },
  {
    id: 'scale-agent',
    name: 'Scale Agent',
    description: 'Acknowledges scale requests and prints current agent config',
    capabilities: ['admin'],
    skills: ['scale', 'agents', 'concurrency', 'swarm', 'targetagentscale'],
    executor: {
      cmd: 'node',
      args: [
        '-e',
        [
          'const f=require("fs"),p=require("path");',
          'const r=process.env.QUICKHIRE_ROOT||process.cwd();',
          'const c=JSON.parse(f.readFileSync(p.resolve(r,"state/local-agent-runtime/orchestration-controls.json"),"utf8"));',
          'console.log("Current scale:",c.controller?.targetAgentScale,"/ max:",c.controller?.maxAgentScale);',
          'console.log("Status:",c.controller?.status);',
        ].join(''),
      ],
      cwd: root,
    },
    timeout: 5000,
  },
  {
    id: 'supervisor-agent',
    name: 'Supervisor',
    description: 'Self-heals stale workers: detects module cache staleness, restarts server, verifies health',
    capabilities: ['admin', 'supervisor'],
    skills: ['restart', 'reload', 'stale', 'refresh routing', 'supervisor', 'stale worker', 'module cache'],
    executor: { cmd: 'sh', args: [path.resolve(root, 'bin/supervisor-agent.sh')], cwd: root },
    timeout: 60000,
  },
  {
    id: 'code-writer-agent',
    name: 'Code Writer',
    description: 'Executes FEATURE prompts via claude CLI — writes files, builds modules, creates implementations',
    capabilities: ['feature'],
    skills: ['feature:', 'linkedin', 'session manager', 'walker', 'customqa', 'submitter', 'build module', 'create file', 'implement', 'write module', 'task 1', 'task 2', 'task 3', 'task 4'],
    executor: { cmd: 'sh', args: ['-c', `${path.resolve(root, 'bin/code-writer.sh')}`], cwd: root },
    timeout: 300000,
  },
  {
    id: 'local-review-agent',
    name: 'Local Review Agent',
    description: 'Analyzes task failures after 3 local retries. No Claude. Deterministic root-cause triage only.',
    capabilities: ['review', 'admin'],
    skills: ['review-task', 'local-review', 'escalate-local', 'triage', 'audit-failure', 'analyze-failure'],
    executor: { cmd: 'sh', args: [path.resolve(root, 'bin/local-review-agent.sh')], cwd: root },
    timeout: 30000,
  },
  {
    id: 'backlog-agent',
    name: 'Backlog Executor',
    description: 'Marks the next queued backlog command as complete — admin use only',
    capabilities: ['admin'],
    skills: ['backlog-admin', 'mark-complete-admin'],
    executor: {
      cmd: 'node',
      args: [
        '-e',
        [
          'const f=require("fs"),p=require("path");',
          'const r=process.env.QUICKHIRE_ROOT||process.cwd();',
          'const cp=p.resolve(r,"state/local-agent-runtime/orchestration-controls.json");',
          'const ctrl=JSON.parse(f.readFileSync(cp,"utf8"));',
          'const next=ctrl.pendingCommands?.find(c=>c.status==="queued");',
          'if(next){',
          '  next.status="complete";',
          '  next.completedAt=new Date().toISOString();',
          '  f.writeFileSync(cp,JSON.stringify(ctrl,null,2));',
          '  console.log("Marked complete:",next.id,"-",next.label);',
          '}else{console.log("No queued commands found.");}',
        ].join(''),
      ],
      cwd: root,
    },
    timeout: 10000,
  },
];

/**
 * Score an agent against a prompt based on keyword overlap.
 * Returns number of matching skills (0 = no match).
 */
function scoreAgent(agent, prompt) {
  const lower = prompt.toLowerCase();
  return agent.skills.filter((skill) => lower.includes(skill)).length;
}

/**
 * Find the best matching agent for a prompt.
 * GUARDRAIL: if prompt is a FEATURE: prompt, only agents with capabilities=['feature']
 * are eligible. Admin-only agents are never selected for free-form prompts.
 * Returns null if no agent matches.
 */
function findBestAgent(prompt) {
  const isFeature = FEATURE_PROMPT_RE.test(prompt);
  let best = null;
  let bestScore = 0;

  for (const agent of AGENTS) {
    const caps = agent.capabilities || ['run'];
    // GUARDRAIL: FEATURE prompts must only go to feature-capable agents.
    // Admin, supervisor, and run agents are never eligible for FEATURE: work.
    if (isFeature && !caps.includes('feature')) {continue;}

    const score = scoreAgent(agent, prompt);
    if (score > bestScore) {
      bestScore = score;
      best = agent;
    }
  }

  return bestScore > 0 ? best : null;
}

/**
 * Returns true if this prompt requires a feature-capable agent.
 */
function isFeaturePrompt(prompt) {
  return FEATURE_PROMPT_RE.test(prompt);
}

function getAgent(id) {
  return AGENTS.find((a) => a.id === id) || null;
}

function listAgents() {
  return AGENTS.map(({ id, name, description, skills }) => ({ id, name, description, skills }));
}

module.exports = { findBestAgent, getAgent, listAgents, isFeaturePrompt, AGENTS, FEATURE_PROMPT_RE };
