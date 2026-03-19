# Quickhire — Project Context
**Updated:** 2026-03-19 23:36 UTC | **Branch:** docs/auto-update-20260319-1636 | **Tag:** v1.0.0 | **Progress:** 0% (0/62 tasks)

## Status
- CI: PASS (694 passed, 694 total)
- Agents alive: 28
- Tasks: 0 done / 59 ready / 62 total
- ETA to backlog complete: ~303hrs
- Last commit: dc3cbd7 docs: auto-update all docs with current project state [2026-03-19] (3 seconds ago)

## What's Built (20 features)
- Backend API: Node.js/Express (694 tests passing)
- Frontend: React + TypeScript
- Database: PostgreSQL + Redis
- CI/CD: GitHub Actions + Docker + Kubernetes
- Monitoring: Prometheus + Grafana
- Job Feed UI: LinkedIn/Indeed/Glassdoor scraper + match score
- Application Tracker UI: pipeline (applied/interview/offer/rejected)
- Salary Insights UI: P25/P50/P75/P90 + negotiation advisor
- ML Dashboard UI: match score, rejection predictor, profile scorer, skills gap
- Mock API Layer: all backend endpoints mocked, ready for real swap
- Auto-Apply Engine: EasyApply form filler stub
- Rate limiting: session management stub
- Email notifications: follow-up scheduler stub
- AI cover letter generator: per-job personalization stub
- AI resume optimizer: keyword injection stub
- Rejection predictor: ML model stub
- Salary negotiation advisor: AI script generator stub
- Job deduplication engine: stub
- Company blacklist/whitelist filter: stub
- 16-agent self-healing fleet: token-guard + meta-sup + watchdog + 13 workers

## What's Next (top 10 by priority)
- Feat: browser extension (1-click apply anywhere)
- Feat: white-label API for recruiting agencies
- Feat: mobile app (React Native)
- Feat: rate limit dashboard (LinkedIn/Indeed quota monitor)
- Feat: candidate tracking CRM for recruiters
- Feat: Real-time recruiter response tracker
- Feat: Browser extension for 1-click apply anywhere
- Feat: Slack bot (daily top 5 jobs + apply button)
- Feat: viral referral program (apply → share → credits)
- Feat: Zapier + Make.com integration

## Development
```bash
npm install && npm run dev          # backend :8000
cd frontend && npm install && npm run dev  # frontend :3000
npm test                            # 694 tests
npm run lint                        # eslint
```

## Agents (16 running 24/7)
```bash
bash bin/start.sh    # start all agents
bash bin/stop.sh     # stop all agents
tail -f state/local-agent-runtime/company-fleet.log  # dashboard
```

## Rules
- Never commit directly to main — use PRs
- All CI checks must pass before merge
- Only contributor: Jimmy Malhan <jimmymalhan999@gmail.com>
- AI rules (.claude/, CLAUDE.md) stay LOCAL — never commit them

## Dashboard
```bash
tail -f state/local-agent-runtime/company-fleet.log
```
