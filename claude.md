# Quickhire — Project Context

**Project**: LinkedIn Auto-Job-Applier
**Status**: 90% complete (9/10 features built)

## What's Built
- Backend API: Node.js/Express, 384 tests passing
- Frontend: React + TypeScript, 310 tests passing
- Database: PostgreSQL + Redis
- CI/CD: GitHub Actions, Docker, Kubernetes
- Monitoring: Prometheus + Grafana
- Documentation: 20+ guides

## What's Not Built
- Auto-Apply Engine (~20 hours of work)
  - Real LinkedIn scraper (replace mock)
  - Application form submission
  - Rate limiting + session management

## Development
```bash
npm install && npm run dev          # backend :8000
cd frontend && npm install && npm run dev  # frontend :3000
npm test                            # all tests
npm run lint                        # eslint
```

## Rules
- Never commit directly to main — use PRs
- All CI checks must pass before merge
- All tests must pass before merge
- Only contributor: Jimmy Malhan

## Dashboard
```bash
tail -f state/local-agent-runtime/company-fleet.log
```

## Project Structure
See ARCHITECTURE.md for full system design.
See GUARDRAILS.md for development standards.
