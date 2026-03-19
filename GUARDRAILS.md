# Quickhire — Guardrails
**Updated:** 2026-03-19 23:23 UTC

## 7 Active Guardrails (enforced by governor.sh every 30s)

| # | Rule | Status |
|---|---|---|
| 1 | No direct commits to main — PRs required | ENFORCED |
| 2 | AI rules (.claude/, CLAUDE.md) stay local, not in git | ENFORCED |
| 3 | No .env files committed | ENFORCED |
| 4 | PRs required before merge | ENFORCED |
| 5 | CI must pass before merge | ENFORCED |
| 6 | Tests must pass before merge | ENFORCED |
| 7 | Token guard active — zero Anthropic API calls | ENFORCED |

## Git Rules
- Only contributor: **Jimmy Malhan <jimmymalhan999@gmail.com>**
- One branch per feature: `feat/*`, `fix/*`, `test/*`, `release/*`
- Delete branch after merge
- Tag every release: `v1.x.0`

## What Must Stay Local (never commit)
- `.claude/` — Claude Code memory and rules
- `CLAUDE.md` — Claude project context (kept local via .gitignore)
- `AGENTS.md`, `.codex/` — Codex rules
- `.cursor/` — Cursor rules
- `state/local-agent-runtime/` — Runtime state, logs, PID files
- `.env`, `.env.local`, `.env.production` — Secrets

## CI Gate (GitHub Actions)
- `no-ai-rules.yml` — Fails PR if AI rule files detected
- `test.yml` — Must pass 694 tests
- `lint.yml` — Zero ESLint errors

## Token Guard
- `bin/token-guard.sh` runs every 10s
- Kills any process calling `api.anthropic.com`
- Scans `bin/*.sh` for API key references
- Zero Claude tokens used for any project work
