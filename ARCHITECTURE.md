# Quickhire — System Architecture
**Updated:** 2026-03-19 23:52 UTC

## Overview
LinkedIn Auto-Job-Applier — scrapes jobs, scores them with ML, auto-applies, tracks results.

## Tech Stack
| Layer | Technology |
|---|---|
| Backend | Node.js / Express |
| Frontend | React + TypeScript |
| Database | PostgreSQL (jobs, applications, users) |
| Cache | Redis (rate limiting, session, job dedup) |
| Queue | Bull (apply jobs, email jobs) |
| ML | Python (scikit-learn) — match scoring, rejection prediction |
| CI/CD | GitHub Actions → Docker → Kubernetes |
| Monitoring | Prometheus + Grafana |
| Scraping | Playwright (LinkedIn, Indeed, Glassdoor) |

## Agent Fleet (16 agents, self-healing 24/7)
| Agent | Role | Interval |
|---|---|---|
| token-guard | Kill any Anthropic API call | 10s |
| meta-supervisor | Watch watchdog + dashboard | 20s |
| watchdog | Restart dead agents | 15s |
| company-fleet | Overwrite dashboard log | 10s |
| branch-watchdog | Enforce no-direct-main | 30s |
| autopilot | Work backlog tasks | continuous |
| governor | 7 guardrails | 30s |
| ci-green-orchestrator | Run tests + lint | 30s |
| orchestration-monitor | State snapshot | 10s |
| team-platform | Git ops + CI + cleanup | 60s |
| team-quality | Lint + security + scan | 45s |
| team-product | Feature backlog | 45s |
| engine | Spawn workers per task | 30s |
| self-healer | Fix stale dashboard + workers | 30s |
| feedback-agent | 50-persona org negotiation | 120s |
| frontend-mock-agent | React pages + mock API | one-shot |
| doc-update-agent | Keep docs in sync | 300s |

## Data Flow
```
Scraper (LinkedIn/Indeed/Glassdoor)
  → Job dedup engine
  → ML match scorer (0-100)
  → Job feed UI (React)
  → User reviews → Auto-apply
  → Form filler (Playwright)
  → Application tracker (DB)
  → Email notifications (Bull)
  → Follow-up scheduler (7d)
  → Feedback loop (ML learns from outcomes)
```

## Frontend Pages
| Path | Component | Status |
|---|---|---|
| / | JobFeedPage | LIVE (mock API) |
| /tracker | ApplicationTrackerPage | LIVE (mock API) |
| /salary | SalaryInsightsPage | LIVE (mock API) |
| /ml | MLDashboardPage | LIVE (mock API) |
| /resume | ResumeBuildlerPage | TODO |
| /interview | InterviewPrepPage | TODO |

## State Files (state/local-agent-runtime/)
| File | Written by | Content |
|---|---|---|
| company-fleet.log | company-fleet.sh | Live dashboard |
| backlog.json | engine + feedback-agent | 41+ tasks with priority/ETA |
| ci-status.json | ci-enforcer-agent | Test/lint results |
| autopilot-progress.json | autopilot + feedback-agent | goal_pct, phase, task |
| eta.json | engine | Per-task ETA hours |
| agent-health-live.json | watchdog | PID + LIVE/OFF per agent |
| feedback.json | feedback-agent | 50-org vote results |
| learnings.log | self-healer | Self-learning log |
