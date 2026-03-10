# Quickhire Testing Guide

## Overview

This document describes the testing strategy, structure, and conventions for the Quickhire platform.

## Test Structure

```
tests/
├── setup.js                    # Jest setup (env vars, global config)
├── factories/
│   └── index.js                # Test data factories
├── unit/
│   ├── utils/
│   │   ├── validators.test.js  # Input validation (60 tests)
│   │   ├── errorCodes.test.js  # Error codes & AppError (26 tests)
│   │   ├── formatters.test.js  # Response formatting (42 tests)
│   │   ├── config.test.js      # Configuration loading (28 tests)
│   │   ├── cache.test.js       # Redis cache wrapper (11 tests)
│   │   └── logger.test.js      # Logger interface (9 tests)
│   ├── database/
│   │   └── connection.test.js  # DB connection pool (10 tests)
│   └── factories/
│       └── factories.test.js   # Factory functions (20 tests)
├── integration/                # Integration tests (TBD)
└── e2e/                        # E2E tests (TBD)
```

## Running Tests

```bash
# All tests with coverage
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e

# Coverage report
npm run test:coverage

# Watch mode during development
npm run test:watch
```

## Test Conventions

### Naming
- Test files: `<module>.test.js`
- Describe blocks: `<module> - <function/section>`
- Test names: Start with a verb (accepts, rejects, returns, creates, handles)

### Structure
- Group tests by function using `describe` blocks
- Use `beforeEach` for setup, `afterAll` for cleanup
- Use factory functions for test data
- Mock external dependencies (pg, ioredis, winston)

### Coverage Requirements
- Branches: 80%+
- Functions: 80%+
- Lines: 80%+
- Statements: 80%+
- New code: 100%

## Test Factories

Located in `tests/factories/index.js`. Available factories:

| Factory | Description |
|---------|-------------|
| `createUser(overrides)` | User with UUID, email, LinkedIn fields |
| `createJob(overrides)` | Job listing with salary, level, location |
| `createApplication(overrides)` | Application with status tracking |
| `createUserPreference(overrides)` | User preferences for auto-apply |
| `createBatch(factory, count)` | Create multiple objects |
| `createJWTPayload(overrides)` | JWT token payload |
| `createLinkedInProfile(overrides)` | LinkedIn profile data |

## Mocking Strategy

- **Database**: Mock `pg.Pool` via `jest.mock('pg')`
- **Redis**: Mock `ioredis` via `jest.mock('ioredis')`
- **Logger**: Mock `winston` via `jest.mock('../utils/logger')`
- **Config**: Mock via `jest.mock('../utils/config')` when needed
- **External APIs**: Never call real APIs in tests

## Adding New Tests

1. Create test file in appropriate directory under `tests/unit/`
2. Import the module under test
3. Mock dependencies
4. Write `describe` blocks for each function
5. Cover happy path, edge cases, error cases, and boundary values

---

**Last Updated**: 2026-03-09
