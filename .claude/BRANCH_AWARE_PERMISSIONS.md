# Branch-Aware Permissions Guide

**Status**: ✅ Active
**Location**: `.claude/settings.local.json` (local-only, not committed)
**Current Branch**: Check with `git branch --show-current`

---

## How It Works

Claude Code reads your current git branch at each permission decision point and applies the appropriate ruleset:

### Feature Branches (Not main/master)
**Mode**: `auto_allow_with_safeguards`

**Auto-Allows** (no approval needed):
- ✅ Read/Edit/Write files
- ✅ npm test, npm run lint, npm run build, npm run dev
- ✅ npm install
- ✅ git status, git diff, git log
- ✅ git add, git commit, git branch
- ✅ git checkout (local feature branches only)
- ✅ ls, find, grep, cat
- ✅ curl http://localhost:*
- ✅ Most dev workflows

**Asks for Approval** (safety gates):
- ❌ git push (any)
- ❌ git checkout main / git checkout master
- ❌ git merge, git rebase, git cherry-pick
- ❌ git reset --hard
- ❌ rm -rf (any)
- ❌ Edit .env, .env.*, *.key, secrets/, credentials.*
- ❌ npm publish, docker, kubectl
- ❌ Deploy commands

### Protected Branches (main/master/production)
**Mode**: `ask_for_approvals_no_bypass`

**Auto-Allows** (read-only):
- ✅ Read files
- ✅ Glob patterns
- ✅ Grep searches

**Asks for Approval**:
- ❌ Edit/Write files (all)
- ❌ Bash commands (all)

**Key**: No bypass mode. Always asks instead of blocking.

---

## Why This Design

| Scenario | Behavior | Reason |
|----------|----------|--------|
| Editing form on feature branch | ✅ Auto-allow | Safe, local work |
| Running tests on feature branch | ✅ Auto-allow | Need this for development |
| Git commit on feature branch | ✅ Auto-allow | Normal feature work |
| git push from feature branch | ❓ Ask approval | Still safe but worth confirming |
| Editing .env on feature branch | ❓ Ask approval | Secrets safety |
| Editing any file on main | ❓ Ask approval | Main is protected |
| git push to main | ❓ Ask approval | Critical operation |
| rm -rf anything | ❓ Ask approval | Always dangerous |

---

## Your Current State

**Branch**: `feat/production-ui-backend-framework`
**Permissions Mode**: `auto_allow_with_safeguards` (feature branch)
**Your Auto-Allows**: Edits, tests, builds, git work (except push), grep, ls, find
**Your Ask-Only**: git push, main/master checkout, rm -rf, edit secrets

---

## Quick Reference

### Auto-Allowed Commands

```bash
# File work
npm test
npm run lint
npm run format
npm run build
npm run dev

# Git
git status
git diff
git log
git add .
git commit -m "message"
git branch
git checkout local-feature-branch

# Inspection
ls -la
find . -name "*.js"
grep -r "pattern" src/
cat file.js
curl http://localhost:3000
```

### Ask-Only Commands

```bash
# Dangerous git
git push origin feat/my-branch  # Will ask
git checkout main               # Will ask
git merge develop               # Will ask
git rebase main                 # Will ask

# Destructive
rm -rf node_modules             # Will ask
rm -rf /                        # Always blocked

# Secrets/config
# Edit .env                     # Will ask
# Edit credentials.json         # Will ask

# Deploy
npm publish                     # Will ask
docker push                     # Will ask
kubectl apply                   # Will ask
```

---

## Toggle This Off

To completely revert to shared settings:

```bash
rm .claude/settings.local.json
```

That's it. Claude Code will immediately use `.claude/settings.json` instead.

---

## How the Check Works

1. **At each permission decision**, Claude Code evaluates:
   ```bash
   git branch --show-current
   ```

2. **Branch is checked against protected list**:
   ```json
   "protected_branches": ["main", "master", "production"]
   ```

3. **Correct ruleset is applied**:
   - Feature branch → use `feature_branch` rules
   - Protected branch → use `protected_branch` rules

4. **Permission is granted or requested**:
   - If in `auto_allow` list → ✅ proceed
   - If in `ask_approval` list → ❓ ask user
   - If not in either → default (allow on feature, ask on protected)

---

## What This Is NOT

❌ Does not enforce anything via git hooks
❌ Does not change .gitignore or .git config
❌ Does not require authentication or signing
❌ Does not slow down workflow

## What This IS

✅ Configuration-based permission boundaries
✅ Branch-aware, not commit-aware
✅ Reversible in one command
✅ Local-only (won't affect team)
✅ Zero overhead

---

## Examples

### Scenario 1: You're on `feat/add-ui-states`

```
You: npm run lint
✅ Auto-allowed (feature branch)

You: git push origin feat/add-ui-states
❓ Asks for approval (always ask git push)

You: Edit src/components/JobCard.tsx
✅ Auto-allowed (feature branch, edit file)

You: npm run test
✅ Auto-allowed (feature branch, run test)
```

### Scenario 2: You accidentally checkout main

```
You: git checkout main
❓ Asks for approval (main is protected)

You: Edit README.md
❓ Asks for approval (main is protected)

You: Read a file
✅ Auto-allowed (read-only is always ok)
```

### Scenario 3: Dangerous operation on feature branch

```
You: rm -rf node_modules
❓ Asks for approval (rm -rf always asks)

You: cat .env
❓ Asks for approval (.env is protected)
```

---

## Customization

To modify the rules, edit `.claude/settings.local.json`:

1. Add/remove branches to `protected_branches`
2. Add/remove commands to `auto_allow` or `ask_approval`
3. Restart Claude Code for changes to take effect

Changes are **local-only** and will not be committed.

---

**Created**: 2026-03-09
**Status**: Active on all branches
**Reversibility**: Instant (rm 1 file)
