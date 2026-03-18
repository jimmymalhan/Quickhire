#!/usr/bin/env node
'use strict';

/**
 * agent CLI — Send a task directly to the local agent system.
 * No Claude. Agents execute locally.
 *
 * Primary path:  POST /api/agents/chat on localhost:8000
 * Fallback path: agentRouter.route() in-process (server not required)
 *
 * Usage:
 *   node bin/agent.js "run the tests"
 *   node bin/agent.js "run the tests" --cwd /path/to/any/project
 *   node bin/agent.js "check git status" --cwd ~/work/myrepo
 *
 * Flags:
 *   --cwd <path>    Working directory for agent execution (default: process.cwd())
 *
 * Environment:
 *   AGENT_API_HOST  (default: localhost)
 *   AGENT_API_PORT  (default: 8000)
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { route } = require('../src/automation/agentRouter');

// ─── parse --cwd flag ─────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
let cwd = process.cwd();

const cwdIdx = argv.indexOf('--cwd');
if (cwdIdx !== -1) {
  if (!argv[cwdIdx + 1]) {
    process.stderr.write('Error: --cwd requires a path argument\n');
    process.exit(1);
  }
  cwd = path.resolve(argv[cwdIdx + 1]);
  argv.splice(cwdIdx, 2); // remove --cwd <path> from args
}

const message = argv.join(' ').trim();

// ─── validate ─────────────────────────────────────────────────────────────────

if (!message) {
  process.stderr.write(
    [
      'Usage:  node bin/agent.js "<task>" [--cwd /path/to/project]',
      '',
      'Examples:',
      '  node bin/agent.js "run the tests"',
      '  node bin/agent.js "lint the code" --cwd /path/to/project',
      '  node bin/agent.js "check git status" --cwd ~/work/myrepo',
      '  node bin/agent.js "execute backlog task"',
      '  node bin/agent.js "check health"',
      '',
      'Available skills: test, lint, build, db, health, git, scale, backlog',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

if (!fs.existsSync(cwd)) {
  process.stderr.write(`Error: --cwd '${cwd}' does not exist\n`);
  process.exit(1);
}

if (!fs.statSync(cwd).isDirectory()) {
  process.stderr.write(`Error: --cwd '${cwd}' is not a directory\n`);
  process.exit(1);
}

const API_HOST = process.env.AGENT_API_HOST || 'localhost';
const API_PORT = Number(process.env.AGENT_API_PORT || '8000');
const body = JSON.stringify({ message, cwd });

const options = {
  hostname: API_HOST,
  port: API_PORT,
  path: '/api/agents/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'X-Request-ID': `cli-${Date.now()}`,
  },
};

process.stdout.write(`Sending to local agents: "${message}"\n`);
process.stdout.write(`Working directory: ${cwd}\n\n`);

const req = http.request(options, (res) => {
  let raw = '';
  res.on('data', (chunk) => { raw += chunk; });

  res.on('end', () => {
    let json;
    try {
      json = JSON.parse(raw);
    } catch (_) {
      process.stderr.write(`Failed to parse server response:\n${raw}\n`);
      process.exit(1);
    }

    if (json.status !== 'success') {
      process.stderr.write(`Error [${json.code}]: ${json.message || JSON.stringify(json)}\n`);
      process.exit(1);
    }

    printResult(json.data, 'api');
  });
});

// ─── shared result printer ────────────────────────────────────────────────────

function printResult(d, via) {
  process.stdout.write(`[${via}]\n`);

  if (!d.routed) {
    process.stdout.write('No agent matched.\n');
    process.stdout.write(`Tip: available skills — test, lint, build, db, health, git, scale, backlog\n`);
    process.stdout.write(`Error: ${d.error || 'unknown'}\n`);
    process.exit(0);
  }

  process.stdout.write(`Agent:  ${d.agentName} (${d.agentId})\n`);

  if (d.memory && d.memory.length > 0) {
    process.stdout.write(`Memory: ${d.memory.length} past execution(s) retrieved\n`);
    d.memory.forEach((m) => {
      process.stdout.write(`  • [${m.resultStatus}] "${m.promptSnippet}" — ${m.durationMs}ms\n`);
    });
  }

  const r = d.result;
  process.stdout.write('\n── Output ──────────────────────────────────────\n');
  if (r.output && r.output.trim()) {
    process.stdout.write(`${r.output.trim()}\n`);
  } else {
    process.stdout.write('(no output)\n');
  }
  if (r.error) {
    process.stderr.write(`\nstderr: ${r.error.trim()}\n`);
  }
  process.stdout.write('────────────────────────────────────────────────\n');
  process.stdout.write(`Status: ${r.status}  Duration: ${r.durationMs}ms\n`);

  process.exit(r.status === 'complete' ? 0 : 1);
}

// ─── local in-process fallback ────────────────────────────────────────────────

async function runLocal() {
  process.stdout.write(`[local-fallback] API unreachable — running agentRouter.route() in-process\n\n`);
  const d = await route(message, { cwd });
  printResult(d, 'local-fallback');
}

// ─── HTTP request ─────────────────────────────────────────────────────────────

req.on('error', (err) => {
  const networkErr = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
  if (networkErr.includes(err.code)) {
    runLocal().catch((e) => {
      process.stderr.write(`Local fallback failed: ${e.message}\n`);
      process.exit(1);
    });
  } else {
    process.stderr.write(`Agent API error: ${err.message}\n`);
    process.exit(1);
  }
});

req.write(body);
req.end();
