# Quickhire — Project Context
**Updated:** 2026-03-19 23:58 UTC | **Branch:** ci/block-ai-rules-1773964667 | **Tag:** v1.0.0 | **Progress:** 0% (0/62 tasks)

## Status
- CI: PASS (694 passed, 694 total)
- Agents alive: 26
- Tasks: 0 done / 62 ready / 62 total
- ETA to backlog complete: ~303hrs
- Last commit: 9850fa9 feat: add all backend features to frontend with mock API layer (75 seconds ago)

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
- Test: chaos engineering (kill scraper mid-apply, verify recovery)
- Test: apply to 3 sandbox jobs end-to-end
- Feat: job application funnel analytics (apply→screen→offer)
- Feat: email notification on apply
- Feat: Slack bot (daily top 5 jobs + apply button)
- Feat: bulk apply (100 jobs in 1 click)
- Feat: weekly digest email (new top-matched jobs)
- Feat: A/B test framework for apply message variants
- Feat: browser extension (1-click apply anywhere)
- Feat: rate limit dashboard (LinkedIn/Indeed quota monitor)

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
