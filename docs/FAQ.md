# Quickhire - Frequently Asked Questions

## General

### What is Quickhire?

Quickhire is a platform that automatically applies to LinkedIn jobs matching your criteria. You set your preferences (role, location, salary, etc.) and Quickhire finds and applies to matching jobs on your behalf.

### Is Quickhire free?

Quickhire is open source. You can self-host it for free. A managed hosted version may be offered in the future.

### Which job boards does Quickhire support?

Currently, Quickhire supports LinkedIn. Support for additional job boards (Indeed, Glassdoor, etc.) is on the roadmap for Q3 2026.

### Is auto-applying safe for my LinkedIn account?

Quickhire is designed to respect LinkedIn's rate limits and terms of service. Applications are spread out over time, and daily limits are configurable to avoid suspicious activity patterns.

### Can this repository change the assistant's global rules or memory?

No. The repository can document workflow policy, org structure, and operating procedures, but it cannot change platform-level rules or memory. Those are controlled outside the repo.

---

## Setup & Installation

### What are the system requirements?

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- 2GB RAM minimum
- See [docs/SETUP.md](./SETUP.md) for detailed requirements

### Can I use Docker instead of installing everything locally?

Yes. Run `docker-compose up -d` to start all services in containers. See [docs/SETUP.md](./SETUP.md) for Docker setup instructions.

### How do I get LinkedIn API credentials?

1. Create a LinkedIn Developer account
2. Create a new application
3. Configure OAuth redirect URIs
4. Copy Client ID and Client Secret to your `.env` file

Full instructions in [docs/SETUP.md](./SETUP.md).

### I'm getting a "connection refused" error. What should I do?

This usually means PostgreSQL or Redis is not running. Check both services are started and your `.env` configuration is correct. See [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

---

## Features

### How does the job matching algorithm work?

The matching algorithm compares your preferences (roles, locations, salary range, experience level) against scraped job listings. Each job gets a match score from 0 to 1. Jobs above a configurable threshold are shown on your dashboard.

### Can I customize which jobs get auto-applied?

Yes. You can configure:
- Target roles and keywords
- Preferred locations
- Salary range
- Experience levels
- Excluded companies
- Daily application limit

### How often does Quickhire search for new jobs?

The job scraper runs nightly by default. You can also trigger manual searches from the dashboard.

### Can I review applications before they're submitted?

Yes. You can disable auto-apply and use manual apply mode, where you review and approve each application individually.

### How do I track my applications?

The dashboard shows all applications with their current status (pending, submitted, viewed, rejected, archived). You can filter and sort by any field.

---

## Security

### Is my LinkedIn data safe?

- OAuth tokens are encrypted at rest (AES-256-GCM)
- No passwords are stored
- All data transmitted over HTTPS
- See [docs/SECURITY.md](./SECURITY.md) for full details

### Can I delete my data?

Yes. You can delete your account and all associated data from the settings page. Data is permanently removed within 30 days per GDPR requirements.

### How do I report a security vulnerability?

Email security@quickhire.ai. Do not open a public GitHub issue for security vulnerabilities.

---

## Development

### How do I run tests?

```bash
npm test              # All tests
npm run test:unit     # Unit tests only
npm run test:coverage # Coverage report
```

See [docs/TESTING.md](./TESTING.md) for the full testing guide.

### What's the coding style?

ESLint + Prettier with Conventional Commits. See [GUARDRAILS.md](../GUARDRAILS.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

### How do I add a new API endpoint?

1. Create controller in `src/api/controllers/`
2. Create route in `src/api/routes/`
3. Add validation in `src/api/validators/`
4. Write unit and integration tests
5. Update [docs/API.md](./API.md)

### How do I track local-agent work live?

Use the dashboard for the high-level view:

```bash
bash bin/live-progress.sh
```

Use the runtime tail for raw state:

```bash
tail -f state/local-agent-runtime/company-fleet.log
```

The dashboard is the better option when you want overall work left, ETA, capacity, and role ownership in one place.

### What does each stakeholder see in the live dashboard?

- `CTO`: shipping readiness, blockers, ETA, merge state, and release risk.
- `VP Engineering`: utilization, throughput, queue health, and CI stability.
- `Director`: task ownership, replica coverage, blocker aging, and escalation points.
- `Manager`: current task, next action, per-task progress, and handoff status.

### How do I create a database migration?

```bash
npm run db:create-migration -- --name=your_migration_name
```

See [docs/DATABASE.md](./DATABASE.md) for migration guidelines.

---

## Deployment

### How do I deploy to production?

See [docs/DEPLOYMENT.md](./DEPLOYMENT.md) for the complete deployment guide. In short:

```bash
npm run deploy:production
```

### Can I self-host Quickhire?

Yes. Quickhire can be deployed on any infrastructure that supports Docker and has PostgreSQL and Redis available.

### What cloud providers are supported?

The default deployment targets AWS (EKS, RDS, ElastiCache), but Docker-based deployment works on any cloud provider or on-premises.

---

## Troubleshooting

### Where can I find logs?

```bash
npm run logs            # Application logs
docker-compose logs -f  # Docker logs
```

### My issue isn't listed here. Where can I get help?

1. Check [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Search GitHub Issues
3. Ask in GitHub Discussions
4. Join the Discord community

---

**Last Updated**: 2026-03-09
