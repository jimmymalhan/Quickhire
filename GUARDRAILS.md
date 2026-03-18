# Quickhire Development Guardrails

## Purpose
This document establishes strict quality, security, and execution standards for the Quickhire project to ensure production-grade reliability.

---

## 1. SECURITY STANDARDS

### Credentials & Secrets
- ❌ **NEVER** commit `.env` files, API keys, tokens, or passwords
- ✓ Use `.env.example` with placeholder values only
- ✓ Store all secrets in environment variables
- ✓ Use GitHub Secrets for CI/CD
- ✓ Rotate API keys every 30 days

### Code Security
- ✓ No hardcoded URLs or credentials anywhere
- ✓ Validate all user inputs (SQL injection, XSS prevention)
- ✓ Use parameterized queries for database
- ✓ Implement rate limiting on all endpoints
- ✓ Use HTTPS only in production
- ✓ CORS policy strictly configured
- ✓ Authentication required on all protected endpoints

### Data Protection
- ✓ Hash passwords with bcrypt (min cost 12)
- ✓ Encrypt sensitive data at rest
- ✓ TLS 1.3+ for all data in transit
- ✓ No PII in logs
- ✓ GDPR-compliant data handling
- ✓ Implement access control (user can only see their data)

---

## 2. CODE QUALITY STANDARDS

### Test Coverage
- ✓ **Minimum 100% code coverage** on all new code
- ✓ Unit tests: 80% of functions tested
- ✓ Integration tests: All API endpoints tested
- ✓ E2E tests: All user workflows tested
- ✓ Performance tests: Critical paths benchmarked
- ❌ No merging code with failing tests

### Code Style
- ✓ ESLint: 0 errors, 0 warnings
- ✓ Prettier: Auto-formatted code
- ✓ Conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`
- ✓ Meaningful commit messages (not "update", "fix", "stuff")
- ✓ No commented-out code
- ✓ No debug console.log statements in production code

### Documentation
- ✓ README.md updated with every feature
- ✓ API endpoints documented
- ✓ Data structures documented
- ✓ Complex algorithms have comments
- ✓ CHANGELOG.md updated with every PR
- ✓ All functions have JSDoc comments

---

## 3. REVIEW & APPROVAL PROCESS

### Pull Request Requirements
Every PR must have:
- ✓ Clear title (feat:, fix:, docs:, test:)
- ✓ Detailed description of changes
- ✓ Related issue/task link
- ✓ Testing done (what you tested, how)
- ✓ Screenshots/links if UI changes
- ✓ No breaking changes without discussion
- ✓ CHANGELOG.md entry

### Approval Gates
```
To merge to develop branch:
✓ Pass all CI checks (linting, tests, security scan)
✓ 3 engineer approvals (code review)
✓ 1 QA approval (testing)
✓ Documentation updated
✓ 0 high-severity security issues

To merge to main branch:
✓ All develop branch gates
✓ 1 product manager approval
✓ Manual testing on staging passed
✓ No blockers or critical bugs
```

---

## 4. PERFORMANCE STANDARDS

### API Response Times
- GET endpoints: < 200ms (p95)
- POST endpoints: < 500ms (p95)
- Heavy computation: < 5 seconds (p95)
- Database queries: < 50ms (p95)

### Frontend Performance
- First Contentful Paint: < 1 second
- Time to Interactive: < 3 seconds
- Lighthouse score: > 90
- Bundle size: < 500KB (gzipped)

### Scalability
- Handle 1000 concurrent users
- Process 10,000 job applications/hour
- Support 1 million job records
- Database queries scale to 1M+ records

---

## 5. BRANCHING & RELEASE STRATEGY

### Branch Protection Rules
```
main:
- Require 1 approval
- Require status checks to pass
- Require up-to-date branch
- Dismiss stale reviews
- Require CODEOWNERS review

develop:
- Require 3 approvals
- Require status checks to pass
- Require tests passing
```

### Version Numbering
- Format: MAJOR.MINOR.PATCH (semver)
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Bug fixes

### Release Process
1. Create release branch: `release/v1.2.3`
2. Update CHANGELOG.md
3. Create PR to main
4. QA testing on staging
5. Merge to main (creates tag)
6. Deploy to production
7. Create GitHub release

---

## 6. QA & TESTING GATES

### Before Merge to Develop
- [ ] All unit tests passing (Jest)
- [ ] All integration tests passing
- [ ] 0 linting errors
- [ ] No security vulnerabilities
- [ ] Code coverage > 100% on new code
- [ ] README updated
- [ ] CHANGELOG updated

### Before Merge to Main
- [ ] All tests passing
- [ ] Manual testing on staging passed
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Product manager sign-off
- [ ] Release notes ready
- [ ] Rollback plan documented

---

## 7. MONITORING & ALERTING

### Production Monitoring
- ✓ Error rate < 0.1%
- ✓ Response time p95 < 200ms
- ✓ CPU usage < 70%
- ✓ Memory usage < 80%
- ✓ Disk space > 20% free
- ✓ Database connection pool healthy

### Alerts (Immediate Response)
- Error rate > 1%
- Response time p95 > 1 second
- Service down/unreachable
- Database connection failed
- High memory/CPU usage
- Disk space < 10% free
- Security issue detected

---

## 8. TEAM RESPONSIBILITIES

### Backend Engineers
- Write clean, tested code
- Follow security standards
- Document APIs
- Participate in code reviews
- Monitor performance

### Frontend Engineers
- Responsive design
- Accessibility (WCAG 2.1 AA)
- Performance optimization
- Component documentation
- E2E testing

### QA Engineers
- Test all features
- Regression testing
- Performance testing
- Security testing
- Create test automation

### DevOps Engineers
- CI/CD pipeline reliability
- Production deployment
- Monitoring & alerting
- Disaster recovery
- Infrastructure as code

### Product Manager
- Prioritize features
- Review user feedback
- Approve releases
- Define acceptance criteria
- Make trade-off decisions

---

## 9. INCIDENT RESPONSE

### Critical Issues (P0)
- Response time: < 15 minutes
- Root cause analysis: < 1 hour
- Fix and deploy: < 4 hours
- Post-mortem: < 24 hours

### High Issues (P1)
- Response time: < 1 hour
- Root cause analysis: < 4 hours
- Fix and deploy: < 24 hours
- Post-mortem: < 3 days

### Medium Issues (P2)
- Response time: < 4 hours
- Root cause analysis: < 24 hours
- Fix and deploy: < 1 week
- Post-mortem: < 1 week

---

## 10. CI/CD ENFORCEMENT (HARD RULES)

### Tests in CI
- ❌ **NEVER** skip or disable tests in CI pipeline
- ❌ **NEVER** use `--passWithNoTests` as an escape hatch
- ✓ All tests MUST run on every PR
- ✓ Tests MUST pass (exit code 0) or merge is BLOCKED
- ✓ Auto-merge requires: test pass + lint pass
- ✓ No bypass: tests are hardcoded, not conditional

### Merge Gate Enforcement
- ✓ Test job runs unconditionally (no `if:` condition to skip)
- ✓ Lint job runs unconditionally
- ✓ Auto-merge requires: `needs: [test, lint]` (blocks if either fails)
- ✓ CI Status gate checks: `needs.test.result == "success"` (explicit pass)
- ✓ No direct commits to main (PR required)

**RESULT:** Any test failure → merge BLOCKED. Both must be green.

## 11. ENFORCEMENT

- All PRs are automatically checked by CI/CD
- Manual reviews required before merge
- Tests CANNOT be skipped (hardcoded in workflow)
- Violations logged and escalated
- Weekly metrics review
- Monthly retrospectives

**No exceptions. Quality is non-negotiable. Tests are mandatory.**

---

## 12. USER FEEDBACK & REQUIREMENTS (Jimmy Malhan)

### Execution Model
- ✓ Local agents do ALL work (zero agent/Codex/Cursor tokens during execution)
- ✓ agent only for planning/approval, never implementation
- ✓ 90/10 split: local agents execute, agent audits
- ✓ Autonomous workflow: agents self-heal, fix own bugs
- ✓ Continuous polling: status updates every 10 seconds

### Commit & Merge Policy
- ✓ Only contributor: Jimmy Malhan (verify author on all commits)
- ✓ NEVER commit directly to main (PR-only workflow)
- ✓ Feature branches → PR → test green → auto-merge on CI pass
- ✓ All uncommitted changes pushed (no orphaned state)
- ✓ Cleanup stale background jobs/processes after done

### CI/CD Pipeline
- ✓ Tests CANNOT be skipped (hardcoded, unconditional)
- ✓ Lint MUST pass 100% (0 errors)
- ✓ Build MUST succeed before merge
- ✓ Auto-merge on CI green + auto-approve
- ✓ GitHub Actions enforces all gates

### Code Quality
- ✓ All tests passing locally before PR
- ✓ All tests passing in CI before merge
- ✓ Code reviewed by agents (no manual review required for CI)
- ✓ Linting fixes applied automatically where safe
- ✓ No technical debt bypass

### Agent Behavior
- ✓ Agents self-update skills over time
- ✓ Custom templates created for reuse (can export to other projects like Kiro)
- ✓ Agents fix own issues (self-healing network)
- ✓ Agents escalate to local-review-agent, never agent
- ✓ Org chart: session-chief → [ci-enforcer, test-agent, lint-agent, etc.]

### Documentation
- ✓ README updated with custom agents, sub-agents, MCPs, skills
- ✓ Reusable templates exported for other projects
- ✓ All feedback added to GUARDRAILS.md as rules
- ✓ CHANGELOG updated per commit

### Guardrail Enforcement
- ✓ CLAUDE_ENABLED=false (hard block, no agent in execution)
- ✓ CLAUDE_FALLBACK=false (no agent fallback)
- ✓ LOCAL_AGENT_PRIMARY=true (local agents first, always)
- ✓ Escalation target: local-review-agent (never agent)

## 13. LOCAL AGENTS ONLY EXECUTION (HARD RULE)

### agent Zero-Execution Model
- ❌ **NEVER** execute work directly (Bash, Edit, Write, etc.)
- ❌ **NEVER** spawn agents for multi-task coordination
- ❌ agent uses 0% tokens during execution phase
- ✓ agent queues work in orchestration-controls.json
- ✓ Local agents execute all tasks autonomously
- ✓ Local agents self-heal and fix own bugs
- ✓ Escalation target: local-review-agent (never agent)

### Multi-Orchestrator Replica System
- ✓ 4 orchestrator types: CI/CD, Git Ops, PR Review, Docs
- ✓ 2+ replicas per orchestrator (fault tolerance)
- ✓ Parallel execution: all orchestrators work simultaneously
- ✓ Auto-failover: if primary crashes, replica takes over
- ✓ Never-stop principle: system continues working even if one orchestrator fails
- ✓ Work queues: test-queue, lint-queue, build-queue, git-branch-queue, etc.
- ✓ Heartbeat monitoring: each orchestrator reports status every 30 seconds
- ✓ System state: stored in orchestrator-system.json

### Agent Network Organization
- CEO Agent (1): Master orchestrator, queue management
- CI-Enforcer Agent (1): Polls every 30s, validates tests/lint
- Test Agents (50+): Run test suites, report failures
- Lint Agents (10+): Run ESLint, enforce 0 errors
- Git Agents (20+): Branch creation, commits, pushes
- PR Agents (10+): Create/manage PRs
- Merge Agents (5+): Auto-merge on CI green
- Cleanup Agents (10+): Delete stale branches
- Monitor Agents (5+): Poll GitHub Actions
- Review Agents (20+): Code review, escalation
- Documentation Agents (10+): Write/update docs
- Backlog Agent (1): Continuous queue drain

### When agent Receives a Request
1. **STOP** (do not execute)
2. **READ** current state (understand context only)
3. **QUEUE** work in orchestration-controls.json
4. **STEP BACK** (let agents execute)
5. Agents self-report progress to user (no agent intermediary)

### Hard Blocks
- `CLAUDE_ENABLED=false` — No agent execution
- `CLAUDE_FALLBACK=false` — No fallback to agent
- `CLAUDE_TOKENS_ALLOWED=0` — Zero tokens during execution
- `LOCAL_AGENTS_ONLY=true` — Local agents only, always

### Session Timeout Enforcement
- ✓ session-timeout-agent.sh starts at T+0 of every session
- ✓ All worker agents (ci-enforcer, monitor) spawn immediately at T+0
- ✓ agent gets MAX 60 seconds to queue work
- ✓ At T+60: agent session TERMINATED, agents continue
- ✓ Zero pause during handoff: agents already running before agent exits
- ✓ Handoff state saved to session-handoff.json
- ✓ No work lost: orchestration-controls.json has full task queue

### Agent Scripts (bin/)
- `bin/agent-supervisor.sh` — MASTER: starts all agents, restarts crashed, dashboard every 10s
- `bin/ci-enforcer-agent.sh` — Tests + lint every 30s, writes ci-status.json
- `bin/orchestration-monitor.sh` — Live dashboard every 10s, reads all state files
- `bin/session-timeout-agent.sh` — Starts agents at T+0, kills agent at T+60
- `bin/chaos-monkey-agent.sh` — Kills random agent every 2min, tests resilience (Netflix/Amazon)
- `bin/pr-watcher-agent.sh` — Monitors PRs, auto-merges when CI green, cleanups
- `bin/queue-drain-agent.sh` — Reads orchestration-controls.json, executes pending tasks

### Chaos Monkey Strategy (Netflix/Amazon)
- ✓ Randomly kill 1 agent every 2 minutes
- ✓ Supervisor auto-restarts killed agents within 10 seconds
- ✓ System NEVER goes down — if it can't survive chaos, it's not production-ready
- ✓ Proves fault tolerance continuously
- ✓ Agents are disposable, the SYSTEM is immortal

### Startup Command (One Command to Rule Them All)
```bash
bash bin/agent-supervisor.sh
```
This starts ALL agents, prints dashboard every 10s, and auto-heals crashed agents.

**RESULT:** Infinite agent scalability. Zero token bloat. True autonomy. Chaos-proven resilience.

---

Last Updated: 2026-03-18
Approval: Jimmy Malhan
