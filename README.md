# Quickhire - Automatic LinkedIn Job Application Platform

> Automate your job search on LinkedIn. Apply to jobs automatically based on your preferences. Get hired faster. ⚡

## Overview

Quickhire is an enterprise-grade platform that automatically applies to LinkedIn jobs matching your criteria. Spend less time searching, more time interviewing.

**Status**: 🚀 In Development (Phase 1: Setup Complete)

## Local Agent Operating Model

Quickhire uses repo-local docs and runtime state to describe the operating model for local agents, replicas, handoff, and merge gates. The repository can encode workflow policy, but it cannot change platform-level rules or memory.

### Live Tracking

High-level dashboard:

```bash
bash bin/live-progress.sh
```

Detailed runtime tail:

```bash
tail -f state/local-agent-runtime/company-fleet.log
```

If you want a 10-second refresh on the raw state, use:

```bash
watch -n 10 'tail -n 80 state/local-agent-runtime/company-fleet.log'
```

### Stakeholder Views

The dashboard is split by audience so each role sees the level of detail it needs without losing the shared source of truth.

- `CTO`: total progress, merge readiness, blocker count, ETA, release risk, and whether the org can safely ship.
- `VP Engineering`: capacity, throughput, queue health, CI status, and whether the current execution plan is sustainable.
- `Director`: active work items, owner assignments, replica coverage, escalation points, and task-level blockers.
- `Manager`: per-task progress, current owner, next action, tail latency, and what the team should do next.

Use the dashboard for the executive summary and the tail stream for the detailed event trail.

### Operating Rules

- Use the runtime state as the source of truth for active work.
- Overwrite the current progress state rather than creating competing trackers.
- Give each local agent a narrow ownership slice and a replica for takeover.
- Keep merges blocked until local tests, CI, and approvals are all green.
- Treat cleanup as part of the workflow, not an optional follow-up.

### Persistence Model

- Repo-local workflow policy lives in docs like this README, `PROGRESS.md`, and `docs/LOCAL_AGENT_EXECUTION_PLAN.md`.
- Live execution state lives under `state/local-agent-runtime/`.
- The runtime state should be overwritten in place so there is one active source of truth.
- CI must be green before merge; the merge loop is a terminal step, not a background assumption.

### Org Chart

```text
CTO
└── VP Engineering
    └── Director
        └── EM / Supervisor
            ├── Conflict Resolver replicas
            ├── Code Fixer replicas
            ├── CI Watcher replicas
            ├── PR Creator replicas
            ├── Merger replicas
            └── Cleanup / Verifier replicas
```

The top-down responsibilities are:
- `EM / Supervisor` keeps the queue moving and handles takeover decisions.
- `Director` validates implementation shape and readiness.
- `VP Engineering` checks risk, quality, and release discipline.
- `CTO` gives the final sign-off before merge.

---

## Features

### Core Features (MVP)
- 🔐 **Secure LinkedIn Authentication** - OAuth 2.0 integration with session management
- 🔍 **Smart Job Search** - Filter by role, location, salary, experience level
- 🤖 **Auto-Apply Engine** - Automated application submissions with resume/cover letter
- 📊 **Application Tracking** - Track all applications and their status
- 📧 **Smart Notifications** - Get alerts on new opportunities and interview invitations
- 📈 **Analytics Dashboard** - View success rates and recommendations

### Advanced Features (Roadmap)
- ML-based job matching algorithm
- Resume optimization suggestions
- Interview preparation guides
- Salary negotiation toolkit
- Integration with other job boards

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- LinkedIn Developer Account (for OAuth)

### Installation

```bash
# Clone repository
git clone https://github.com/quickhire/quickhire-auto-apply.git
cd quickhire-auto-apply

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Database setup
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

Backend: http://localhost:8000
Frontend: http://localhost:3000

---

## Project Structure

```
quickhire-auto-apply/
├── src/
│   ├── api/              # API endpoints & controllers
│   ├── automation/       # Job matching & auto-apply logic
│   ├── database/         # Database schemas & migrations
│   ├── scheduler/        # Cron jobs & task scheduling
│   └── utils/            # Helper functions & validators
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/              # End-to-end tests
├── docs/                 # Documentation
├── GUARDRAILS.md         # Development standards
├── CHANGELOG.md          # Version history
└── README.md             # This file
```

---

## Development

### Running Tests
```bash
npm test                  # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e         # E2E tests
npm run test:coverage    # Coverage report
```

### Code Quality
```bash
npm run lint             # ESLint check
npm run format           # Prettier format
npm run type-check       # TypeScript check (if applicable)
```

### Documentation
- [Architecture](./docs/ARCHITECTURE.md) - System design & data flow
- [API Reference](./docs/API.md) - All API endpoints
- [Setup Guide](./docs/SETUP.md) - Detailed setup instructions
- [Deployment](./docs/DEPLOYMENT.md) - Production deployment guide

---

## API Endpoints

### Authentication
- `POST /auth/login` - LinkedIn OAuth login
- `POST /auth/logout` - Logout
- `GET /auth/profile` - Get current user

### Jobs
- `GET /jobs/search?role=&location=&salary=` - Search jobs
- `GET /jobs/:id` - Get job details
- `POST /jobs/:id/apply` - Apply to a job

### Applications
- `GET /applications` - List user applications
- `GET /applications/:id` - Get application details
- `PATCH /applications/:id/status` - Update application status

### Settings
- `GET /settings` - Get user preferences
- `PATCH /settings` - Update preferences
- `GET /settings/notifications` - Get notification settings

See [API.md](./docs/API.md) for full details.

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Development Process
1. Create feature branch: `git checkout -b feat/feature-name`
2. Make changes following [GUARDRAILS.md](./GUARDRAILS.md)
3. Write tests (100% coverage required)
4. Submit PR for review
5. Merge after approval

---

## Progress Tracking

### Current Execution Model

- Work is tracked in `state/local-agent-runtime/`.
- Live progress should refresh every 10 seconds.
- The visible bars should answer three questions: what is done, what is left, and who owns the current step.
- The dashboard should show overall project progress, task progress, and agent/session utilization together.

### Merge Gate

1. Local tests and lint must pass.
2. CI must be green.
3. The approval chain must complete in order.
4. The merge loop may run only after all gates are satisfied.

---

## Security

Quickhire takes security seriously. See [SECURITY.md](./SECURITY.md) for:
- Reporting vulnerabilities
- Security best practices
- Data protection policies
- Incident response procedures

---

## Performance

Target performance metrics:
- API response: < 200ms (p95)
- Job matching: < 1 second (1M jobs)
- Frontend load: < 3 seconds
- Uptime: 99.9%

See [docs/PERFORMANCE.md](./docs/PERFORMANCE.md) for benchmarks.

---

## Deployment

### Staging
```bash
npm run deploy:staging
```

### Production
```bash
npm run deploy:production
```

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for detailed instructions.

---

## Support

- 📧 Email: support@quickhire.ai
- 💬 Discord: [Join Community](https://discord.gg/quickhire)
- 🐛 Issues: [GitHub Issues](https://github.com/quickhire/quickhire-auto-apply/issues)
- 📚 Docs: [Full Documentation](./docs/)

---

## Roadmap

### Q1 2026
- [x] Project setup
- [ ] Core authentication
- [ ] Job scraping & matching
- [ ] Auto-apply engine
- [ ] Application tracking

### Q2 2026
- [ ] ML-based matching
- [ ] Dashboard analytics
- [ ] Notification system
- [ ] Mobile app (iOS)
- [ ] Mobile app (Android)

### Q3 2026
- [ ] Resume optimization
- [ ] Interview prep
- [ ] Salary negotiation
- [ ] Other job board integrations

---

## License

[MIT License](./LICENSE) - See LICENSE file for details

---

## Team

- **Product Manager**: [Name]
- **Lead Engineer**: [Name]
- **DevOps Lead**: [Name]
- **QA Lead**: [Name]

---

## Acknowledgments

- LinkedIn for API access
- Contributors and community
- Open source libraries and frameworks

---

**Last Updated**: 2026-03-09
**Status**: 🚀 In Development
**Version**: 0.0.1-alpha
