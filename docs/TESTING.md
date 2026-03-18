# Quickhire - Testing Guide

## Overview

Quickhire uses a comprehensive testing strategy with Jest for unit/integration tests and Cypress for E2E tests. All new code requires 100% test coverage.

---

## Test Structure

```
tests/
├── unit/                    # Unit tests (isolated functions)
│   ├── api/
│   │   ├── authController.test.js
│   │   ├── jobController.test.js
│   │   └── applicationController.test.js
│   ├── automation/
│   │   ├── jobMatcher.test.js
│   │   └── applicationSubmitter.test.js
│   ├── database/
│   │   └── models.test.js
│   └── utils/
│       ├── validators.test.js
│       └── formatters.test.js
├── integration/             # Integration tests (API + DB)
│   ├── auth.test.js
│   ├── jobs.test.js
│   ├── applications.test.js
│   └── settings.test.js
└── e2e/                     # End-to-end tests (Cypress)
    ├── auth.cy.js
    ├── jobSearch.cy.js
    ├── autoApply.cy.js
    └── dashboard.cy.js
```

---

## Running Tests

### All Tests

```bash
npm test
```

### Unit Tests

```bash
npm run test:unit
```

### Integration Tests

```bash
npm run test:integration
```

### E2E Tests

```bash
# Headless
npm run test:e2e

# Interactive (Cypress UI)
npm run test:e2e:open
```

### Coverage Report

```bash
npm run test:coverage
```

Generates an HTML report in `coverage/lcov-report/index.html`.

### Watch Mode

```bash
npm run test:watch
```

### Run Specific Test File

```bash
npm test -- --testPathPattern=jobMatcher
```

---

## Writing Tests

### Unit Test Example

```javascript
const { matchJobs } = require('../../src/automation/jobMatcher');

describe('Job Matcher', () => {
  describe('matchJobs', () => {
    it('should return jobs matching user preferences', () => {
      const preferences = {
        target_roles: ['Software Engineer'],
        target_locations: ['Remote'],
        min_salary: 100000,
      };

      const jobs = [
        { title: 'Software Engineer', location: 'Remote', salary_min: 120000 },
        { title: 'Designer', location: 'NYC', salary_min: 80000 },
      ];

      const result = matchJobs(jobs, preferences);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Software Engineer');
    });

    it('should return empty array when no jobs match', () => {
      const preferences = { target_roles: ['Astronaut'] };
      const jobs = [{ title: 'Engineer' }];

      const result = matchJobs(jobs, preferences);

      expect(result).toHaveLength(0);
    });
  });
});
```

### Integration Test Example

```javascript
const request = require('supertest');
const app = require('../../src/api/app');
const db = require('../../src/database/connection');

describe('GET /jobs/search', () => {
  beforeAll(async () => {
    await db.migrate.latest();
    await db.seed.run();
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('should return paginated job results', async () => {
    const response = await request(app)
      .get('/jobs/search?role=engineer&page=1')
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);

    expect(response.body.status).toBe('success');
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.meta).toHaveProperty('total');
  });

  it('should return 401 without authentication', async () => {
    await request(app)
      .get('/jobs/search')
      .expect(401);
  });
});
```

### E2E Test Example (Cypress)

```javascript
describe('Job Search', () => {
  beforeEach(() => {
    cy.login(); // Custom command
    cy.visit('/dashboard');
  });

  it('should search for jobs and display results', () => {
    cy.get('[data-testid="search-input"]').type('Software Engineer');
    cy.get('[data-testid="location-input"]').type('Remote');
    cy.get('[data-testid="search-button"]').click();

    cy.get('[data-testid="job-card"]').should('have.length.at.least', 1);
    cy.get('[data-testid="job-card"]').first().should('contain', 'Engineer');
  });
});
```

---

## Test Conventions

### Naming

- Test files: `<module>.test.js` (unit/integration) or `<feature>.cy.js` (E2E)
- Describe blocks: Use the function/module name
- It blocks: Start with "should" and describe expected behavior

### Structure (AAA Pattern)

```javascript
it('should do something', () => {
  // Arrange - set up test data
  const input = { ... };

  // Act - call the function
  const result = doSomething(input);

  // Assert - verify the result
  expect(result).toBe(expected);
});
```

### Mocking

Use Jest mocks for external dependencies:

```javascript
jest.mock('../../src/database/connection');
jest.mock('../../src/utils/cache');
```

For HTTP calls, use `nock` or `msw`:

```javascript
const nock = require('nock');

nock('https://api.linkedin.com')
  .get('/v2/me')
  .reply(200, { id: '123', firstName: 'John' });
```

---

## Coverage Requirements

| Metric | Minimum | Target |
|--------|---------|--------|
| Statements | 100% | 100% |
| Branches | 90% | 100% |
| Functions | 100% | 100% |
| Lines | 100% | 100% |

Coverage is enforced in CI. PRs that decrease coverage are blocked.

---

## Test Database

Integration tests use a separate test database:

```env
# .env.test
DB_NAME=quickhire_test
```

The test database is created and destroyed automatically:

```bash
# Setup test DB
npm run db:test:setup

# Teardown test DB
npm run db:test:teardown
```

---

## Performance Testing

Performance benchmarks use custom scripts:

```bash
npm run test:performance
```

Key benchmarks:
- API response time < 200ms (p95)
- Job matching < 1 second for 1M jobs
- Database queries < 50ms

See [PERFORMANCE.md](./PERFORMANCE.md) for detailed benchmarks.

---

## CI/CD Integration

Tests run automatically on every push and PR:

1. Lint check
2. Unit tests
3. Integration tests
4. E2E tests
5. Coverage report
6. Performance benchmarks (on release branches)

A failing test blocks the merge.

---

**Last Updated**: 2026-03-09
