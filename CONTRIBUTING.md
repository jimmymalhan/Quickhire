# Contributing to Quickhire

Thank you for your interest in contributing to Quickhire! This guide will help you get started.

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Be kind, constructive, and professional in all interactions.

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/quickhire-auto-apply.git
   cd quickhire-auto-apply
   ```
3. **Set up** the development environment (see [docs/SETUP.md](./docs/SETUP.md))
4. **Create a branch** for your work:
   ```bash
   git checkout -b feat/your-feature-name
   ```

---

## Branch Naming Convention

Use the following prefixes:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feat/` | New feature | `feat/job-matching-algorithm` |
| `fix/` | Bug fix | `fix/auth-token-expiry` |
| `docs/` | Documentation | `docs/api-reference-update` |
| `test/` | Tests | `test/application-service-unit` |
| `refactor/` | Code refactor | `refactor/database-queries` |
| `chore/` | Maintenance | `chore/update-dependencies` |

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `test`: Adding or updating tests
- `refactor`: Code refactoring (no feature or fix)
- `chore`: Build process, dependencies, tooling
- `perf`: Performance improvement
- `ci`: CI/CD changes

### Examples

```
feat(auth): add LinkedIn OAuth 2.0 integration

Implement OAuth flow with PKCE for secure authentication.
Includes token refresh and session management.

Closes #42
```

```
fix(jobs): correct salary filter range validation

The salary filter was accepting negative values. Added
minimum value validation of 0.

Fixes #87
```

---

## Development Workflow

### 1. Write Code

- Follow the standards in [GUARDRAILS.md](./GUARDRAILS.md)
- Keep changes focused and minimal
- Add JSDoc comments to new functions
- No `console.log` in production code (use the logger)

### 2. Write Tests

- **100% test coverage** is required on new code
- Write unit tests for all new functions
- Write integration tests for API endpoints
- Update existing tests if behavior changes

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=auth
```

### 3. Lint and Format

```bash
# Check for lint errors
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format code
npm run format
```

### 4. Update Documentation

- Update `CHANGELOG.md` with your changes under `[Unreleased]`
- Update `README.md` if adding user-facing features
- Update API docs if modifying endpoints
- Add inline code comments for complex logic

---

## Pull Request Process

### Before Submitting

- [ ] All tests pass (`npm test`)
- [ ] No lint errors (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] CHANGELOG.md is updated
- [ ] Documentation is updated
- [ ] Branch is up-to-date with `develop`

### PR Template

When creating a PR, include:

```markdown
## Summary
Brief description of changes.

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation
- [ ] Refactor
- [ ] Test

## Testing Done
Describe what you tested and how.

## Screenshots (if UI changes)
Attach screenshots here.

## Checklist
- [ ] Tests pass
- [ ] Lint passes
- [ ] Docs updated
- [ ] CHANGELOG updated
```

### Review Process

1. Submit PR to `develop` branch
2. CI/CD checks run automatically
3. Minimum **3 engineer approvals** required
4. **1 QA approval** required
5. Address all review feedback
6. Squash and merge after approval

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
└── scripts/              # Build & utility scripts
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

---

## Reporting Issues

### Bug Reports

Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, Node version, browser)
- Screenshots or error logs

### Feature Requests

Include:
- Problem description
- Proposed solution
- Alternative approaches considered
- Impact on existing features

---

## Style Guide

### JavaScript/TypeScript

- Use `const` over `let`; avoid `var`
- Use arrow functions for callbacks
- Use async/await over raw promises
- Destructure objects and arrays when possible
- Use meaningful variable names (no single letters except loop counters)

### API Design

- RESTful conventions
- Use plural nouns for resources (`/jobs`, `/applications`)
- Use HTTP status codes correctly
- Return consistent response format (see [API.md](./docs/API.md))

### Database

- Use snake_case for column names
- Add indexes for frequently queried columns
- Write reversible migrations
- Never delete data; use soft deletes

---

## Getting Help

- Check [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) for common issues
- Ask in GitHub Discussions
- Join our Discord community
- Open an issue for bugs

---

## Recognition

All contributors are recognized in the project README and release notes. Significant contributions may be highlighted in blog posts and announcements.

---

**Last Updated**: 2026-03-09
