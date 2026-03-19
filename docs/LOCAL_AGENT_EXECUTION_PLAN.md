# Quickhire Local-Agent Execution Plan

**Date**: 2026-03-18
**Status**: Active
**Primary Goal**: Stabilize the repo, make progress visible in realtime, and enable safe local-agent/browser testing against mock or local flows.

## Guardrails

- Do not auto-submit real job applications.
- Do not mass-customize or send resumes/CVs to real employers.
- Restrict browser automation to local, mock, or sandbox flows until verification and controls are complete.
- Prefer local-agent execution and local models first; use hosted tooling only as fallback.
- No destructive Git or GitHub actions without confirmed credentials and a verified clean path.
- The repository can document workflow policy, org structure, and operating habits, but it cannot change platform-level rules or memory.

## Live Tracking

High-level dashboard:

```bash
bash bin/live-progress.sh
```

Detailed runtime tail:

```bash
tail -f state/local-agent-runtime/company-fleet.log
```

Use the dashboard when you want overall work left, ETA, and active owners. Use the tail command when you want the raw state feed for agent, task, and session details.

### Stakeholder Split

The live dashboard should adapt to the audience without changing the underlying state source.

- `CTO`: merge readiness, release risk, blockers, ETA, and whether the fleet can safely ship.
- `VP Engineering`: capacity, throughput, CI health, queue health, and resource utilization.
- `Director`: active work items, replica coverage, escalation points, and blocker aging.
- `Manager`: current task, next action, owner, handoff state, and per-task progress.

The tail stream is the detailed feed for auditability. It should be the place to inspect raw events, not the primary executive summary.

## Persistence Model

- Repo-local workflow policy is stored in docs in this repository.
- Live orchestration state is stored in `state/local-agent-runtime/`.
- The runtime should be overwritten in place so there is exactly one current view of work.
- CI-green-before-merge is a hard gate, not a suggestion.
- The merge loop starts only after the gate is satisfied and ends with cleanup.

## Phase 0: Repo Stabilization

- [ ] Ignore duplicate agent worktrees in test/tooling config.
  - Update [`/Users/jimmymalhan/Doc/Quickhire/jest.config.js`](/Users/jimmymalhan/Doc/Quickhire/jest.config.js) to exclude `.agent/worktrees/**`.
- [ ] Fix backend lint failures.
  - Clean browser globals and unused variables in automation and scheduler files.
  - Remove or refactor `process.exit()` usage in runtime entrypoints.
- [ ] Fix backend test failures caused by model contract drift.
  - Reconcile [`/Users/jimmymalhan/Doc/Quickhire/src/database/models/Job.js`](/Users/jimmymalhan/Doc/Quickhire/src/database/models/Job.js) with [`/Users/jimmymalhan/Doc/Quickhire/tests/integration/database/models.test.js`](/Users/jimmymalhan/Doc/Quickhire/tests/integration/database/models.test.js).
  - Ensure the Job model has a valid DB access path in tests.
- [ ] Fix frontend local toolchain failures.
  - Repair the missing Rollup optional dependency issue in the frontend environment.
  - Fix TypeScript test globals and test typing errors.
- [ ] Make `backend test`, `backend lint`, `frontend test`, and `frontend build` pass locally.

## Phase 1: API Contract Alignment

- [ ] Align frontend auth endpoints with backend routes.
  - Reconcile [`/Users/jimmymalhan/Doc/Quickhire/frontend/src/context/AuthContext.tsx`](/Users/jimmymalhan/Doc/Quickhire/frontend/src/context/AuthContext.tsx) with [`/Users/jimmymalhan/Doc/Quickhire/src/api/routes/auth.js`](/Users/jimmymalhan/Doc/Quickhire/src/api/routes/auth.js).
- [ ] Align job service calls with backend job routes.
  - Reconcile [`/Users/jimmymalhan/Doc/Quickhire/frontend/src/services/jobService.ts`](/Users/jimmymalhan/Doc/Quickhire/frontend/src/services/jobService.ts) with [`/Users/jimmymalhan/Doc/Quickhire/src/api/routes/jobs.js`](/Users/jimmymalhan/Doc/Quickhire/src/api/routes/jobs.js).
- [ ] Align application service calls with backend application routes.
  - Reconcile [`/Users/jimmymalhan/Doc/Quickhire/frontend/src/services/applicationService.ts`](/Users/jimmymalhan/Doc/Quickhire/frontend/src/services/applicationService.ts) with [`/Users/jimmymalhan/Doc/Quickhire/src/api/routes/applications.js`](/Users/jimmymalhan/Doc/Quickhire/src/api/routes/applications.js).
- [ ] Align settings service calls with backend settings routes.
  - Reconcile [`/Users/jimmymalhan/Doc/Quickhire/frontend/src/services/settingsService.ts`](/Users/jimmymalhan/Doc/Quickhire/frontend/src/services/settingsService.ts) with [`/Users/jimmymalhan/Doc/Quickhire/src/api/routes/settings.js`](/Users/jimmymalhan/Doc/Quickhire/src/api/routes/settings.js).
- [ ] Decide whether analytics is a real backend feature or a frontend-only placeholder.
  - Either implement `/analytics*` routes or remove/mock those calls cleanly.

## Phase 2: Safe Browser-Control Testing

- [ ] Inventory and harden the existing browser automation modules.
  - Start with [`/Users/jimmymalhan/Doc/Quickhire/src/automation/browserManager.js`](/Users/jimmymalhan/Doc/Quickhire/src/automation/browserManager.js).
  - Review [`/Users/jimmymalhan/Doc/Quickhire/src/automation/applicationSubmitter.js`](/Users/jimmymalhan/Doc/Quickhire/src/automation/applicationSubmitter.js), [`/Users/jimmymalhan/Doc/Quickhire/src/automation/linkedInFormSubmitter.js`](/Users/jimmymalhan/Doc/Quickhire/src/automation/linkedInFormSubmitter.js), and [`/Users/jimmymalhan/Doc/Quickhire/src/automation/formFiller.js`](/Users/jimmymalhan/Doc/Quickhire/src/automation/formFiller.js).
- [ ] Add a strict mock mode for browser-control tests.
  - Use local HTML fixtures or a local test server.
  - Prevent outbound submits by configuration.
- [ ] Build an end-to-end browser smoke test against a local/mock flow.
  - Launch browser.
  - Navigate to fixture/local page.
  - Fill a sample form.
  - Capture screenshot and status.
  - Assert no external submission occurred.
- [ ] Add clear runtime flags for safe execution.
  - Example: `ENABLE_MOCK_LINKEDIN_API`, `BROWSER_TEST_MODE`, `DISABLE_EXTERNAL_SUBMIT`.

## Phase 3: Local-Agent Runtime and CLI Upgrades

- [ ] Add a central task model for work items, agent sessions, blockers, ownership, ETA, and status.
- [ ] Add runtime event streaming so the UI can show active work in realtime.
- [ ] Add progress breakdowns by:
  - overall project
  - current task
  - blocker resolution
  - agent/session utilization
  - local-model vs hosted-model usage
- [ ] Add local-agent coordination rules.
  - task claiming
  - conflict avoidance
  - timeout/takeover rules
  - fallback escalation when a local agent stalls
- [ ] Add replica and failover policy.
  - one primary supervisor
  - replica workers for each operational role
  - takeover on timeout or heartbeat loss
  - continuation from persisted runtime state
- [ ] Add runtime learning hooks.
  - capture failure reason
  - store remediation
  - update prompt/workflow templates for the next run
- [ ] Add ROI controls.
  - checkpoint before expensive fan-out
  - kill switch on negative ROI trend
  - pre-delete diff
  - dry-run restore path

## Phase 4: Realtime UI Improvements

- [ ] Add a top-level completion bar for:
  - total work complete
  - total work left
  - blocker count
  - estimated time remaining
- [ ] Add live panels for:
  - todo list
  - in-progress tasks
  - blocked tasks
  - upcoming tasks
  - active agent sessions
  - runtime decisions
  - lessons learned
- [ ] Add one overall bar plus per-task bars in the dashboard and tail output.
  - project completion
  - task completion
  - agent/session ownership
  - capacity target at 80-90%
- [ ] Add per-session visibility.
  - assigned owner
  - model/provider
  - elapsed time
  - last event
  - current command/action
- [ ] Add organization-role views.
  - EM / Supervisor
  - Manager
  - Director
  - VP Engineering
  - CTO
  - each view should expose priority, tradeoffs, and blockers differently
- [ ] Add charts for:
  - task throughput
  - blocker aging
  - success/failure rate
  - agent utilization
  - CPU/memory/disk health

## Phase 5: Product Completeness Gaps

- [ ] Implement real feedback persistence in [`/Users/jimmymalhan/Doc/Quickhire/src/api/controllers/feedbackController.js`](/Users/jimmymalhan/Doc/Quickhire/src/api/controllers/feedbackController.js).
- [ ] Decide whether real LinkedIn OAuth belongs in this repo; if yes, implement it behind verified config in [`/Users/jimmymalhan/Doc/Quickhire/src/api/controllers/authController.js`](/Users/jimmymalhan/Doc/Quickhire/src/api/controllers/authController.js).
- [ ] Replace shallow UI placeholders.
  - Dashboard metric placeholders in [`/Users/jimmymalhan/Doc/Quickhire/frontend/src/pages/DashboardPage.tsx`](/Users/jimmymalhan/Doc/Quickhire/frontend/src/pages/DashboardPage.tsx).
  - Stubbed application detail actions in [`/Users/jimmymalhan/Doc/Quickhire/frontend/src/pages/ApplicationsPage.tsx`](/Users/jimmymalhan/Doc/Quickhire/frontend/src/pages/ApplicationsPage.tsx).
- [ ] Improve error surfacing and retry UX across frontend pages.

## Phase 6: Documentation and Operational Hygiene

- [ ] Update repo status docs to match reality.
  - [`/Users/jimmymalhan/Doc/Quickhire/PROGRESS.md`](/Users/jimmymalhan/Doc/Quickhire/PROGRESS.md)
  - [`/Users/jimmymalhan/Doc/Quickhire/README.md`](/Users/jimmymalhan/Doc/Quickhire/README.md)
- [ ] Reconcile deployment docs with the actual `k8s/` layout.
  - [`/Users/jimmymalhan/Doc/Quickhire/docs/DEPLOYMENT.md`](/Users/jimmymalhan/Doc/Quickhire/docs/DEPLOYMENT.md)
- [ ] Convert the launch checklist from generic placeholders into repo-specific gates.
  - [`/Users/jimmymalhan/Doc/Quickhire/docs/LAUNCH_CHECKLIST.md`](/Users/jimmymalhan/Doc/Quickhire/docs/LAUNCH_CHECKLIST.md)
- [ ] Add a documented local-agent operating model.
  - task routing
  - model routing
  - escalation rules
  - review requirements

## Phase 7: Delivery Workflow

- [ ] Create a feature branch using repo naming conventions.
- [ ] Make small, reviewable commits by workstream.
- [ ] Add or repair CI checks so local and CI verification match.
- [ ] Run an end-of-task review pass before merge.
- [ ] Open a PR once local verification is green.
- [ ] Merge only after checks pass.

## Merge Loop

1. Local work finishes and overwrites the runtime state.
2. The CI watcher keeps polling until checks are green.
3. The approval chain reviews the result in order.
4. The merger runs only after all gates are green.
5. Cleanup removes stale branches, processes, and temporary runtime artifacts.

## Deferred or Blocked Until Credentials/Confirmation

- [ ] GitHub PR creation, merge, branch cleanup, tag/release management.
- [ ] Branch protection rule verification or modification.
- [ ] Pushing changes to remote.
- [ ] Integrations that require external accounts, secrets, or gateway tokens.
- [ ] Any live browser automation against real job platforms.

## Success Criteria

- [ ] All local tests and builds pass.
- [ ] The frontend and backend agree on API contracts.
- [ ] Browser control works safely in mock/local mode.
- [ ] The UI shows realtime task/session/progress/blocker data.
- [ ] The local-agent runtime can coordinate work with visible ownership and ETA.
- [ ] Repo docs match the actual implementation state.
