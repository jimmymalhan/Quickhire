---
name: never_commit_main
description: HARD RULE — all agents, sub-agents, orchestrators must use PRs, never commit/push directly to main
type: feedback
---

All changes must go through PRs. No direct commits or pushes to main — ever.

**Why:** User explicitly requires branch protection discipline. Direct pushes to main bypass CI checks and code review, risking broken builds and lost work.

**How to apply:**
1. Every agent script must `source bin/lib/git-guardrails.sh` before git operations
2. Always create a feature branch (fix/, feat/, team-/)
3. Open PR from feature branch → main
4. Poll CI until ALL checks pass
5. Only merge via squash merge + delete branch
6. The guardrail wrapper function blocks `git push origin main` and `git commit` on main branch
7. Violation = agent killed and restarted by supervisor
