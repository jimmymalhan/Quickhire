# Quickhire - Database Documentation

## Overview

Quickhire uses **PostgreSQL 14+** as the primary relational database and **Redis 7+** for caching and job queues.

---

## Schema Diagram

```
┌─────────────────┐       ┌─────────────────────┐
│     users        │       │  user_preferences    │
├─────────────────┤       ├─────────────────────┤
│ id (PK)         │──1:1──│ id (PK)             │
│ email           │       │ user_id (FK, UNIQUE) │
│ linkedin_id     │       │ auto_apply_enabled   │
│ first_name      │       │ target_roles[]       │
│ last_name       │       │ target_locations[]   │
│ profile_pic_url │       │ min_salary           │
│ access_token    │       │ max_salary           │
│ refresh_token   │       │ experience_level[]   │
│ token_expires_at│       │ excluded_companies[] │
│ created_at      │       │ apply_interval_min   │
│ updated_at      │       │ daily_limit          │
│ deleted_at      │       │ notification_enabled │
└────────┬────────┘       └─────────────────────┘
         │
         │ 1:N
         ↓
┌─────────────────────┐       ┌─────────────────┐
│   applications       │       │      jobs        │
├─────────────────────┤       ├─────────────────┤
│ id (PK)             │──N:1──│ id (PK)         │
│ user_id (FK)        │       │ linkedin_job_id  │
│ job_id (FK)         │       │ title            │
│ status              │       │ company          │
│ applied_at          │       │ location         │
│ response_received_at│       │ salary_min       │
│ submission_attempts │       │ salary_max       │
│ last_attempt_at     │       │ description      │
│ error_message       │       │ job_level        │
│ resume_version      │       │ experience_years │
│ created_at          │       │ posted_at        │
│ updated_at          │       │ scrape_date      │
└─────────────────────┘       │ url              │
                              │ hash             │
                              │ created_at       │
                              │ updated_at       │
                              └─────────────────┘
```

---

## Tables

### users

Primary user accounts table. Stores LinkedIn profile data and encrypted OAuth tokens.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| email | VARCHAR | UNIQUE, NOT NULL | User email |
| linkedin_id | VARCHAR | UNIQUE, NOT NULL | LinkedIn profile ID |
| first_name | VARCHAR | | First name |
| last_name | VARCHAR | | Last name |
| profile_pic_url | VARCHAR | | Profile image URL |
| access_token | VARCHAR | | Encrypted LinkedIn access token |
| refresh_token | VARCHAR | | Encrypted LinkedIn refresh token |
| token_expires_at | TIMESTAMP | | Token expiration time |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update time |
| deleted_at | TIMESTAMP | | Soft delete timestamp |

**Indexes**: `email` (unique), `linkedin_id` (unique)

---

### jobs

Scraped job listings from LinkedIn.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| linkedin_job_id | VARCHAR | UNIQUE | LinkedIn's job ID |
| title | VARCHAR | NOT NULL | Job title |
| company | VARCHAR | NOT NULL | Company name |
| location | VARCHAR | | Job location |
| salary_min | INT | | Minimum salary |
| salary_max | INT | | Maximum salary |
| description | TEXT | | Full job description |
| job_level | VARCHAR | | Entry/Mid/Senior/Lead |
| experience_years | INT | | Required years of experience |
| posted_at | TIMESTAMP | | When the job was posted |
| scrape_date | TIMESTAMP | | When the job was scraped |
| url | VARCHAR | | LinkedIn job URL |
| hash | VARCHAR | UNIQUE | Content hash for deduplication |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update time |

**Indexes**: `linkedin_job_id` (unique), `hash` (unique), `company`, `title`, `location`

---

### applications

Tracks job applications submitted by users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK -> users.id | Applicant |
| job_id | UUID | FK -> jobs.id | Target job |
| status | VARCHAR | DEFAULT 'pending' | Application status |
| applied_at | TIMESTAMP | | When application was submitted |
| response_received_at | TIMESTAMP | | When employer responded |
| submission_attempts | INT | DEFAULT 0 | Number of submission attempts |
| last_attempt_at | TIMESTAMP | | Last submission attempt |
| error_message | TEXT | | Error details if failed |
| resume_version | INT | | Resume version used |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update time |

**Status values**: `pending`, `submitted`, `viewed`, `rejected`, `archived`

**Indexes**: `(user_id, status)` composite, `applied_at`

---

### user_preferences

User job search and auto-apply preferences.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| user_id | UUID | FK -> users.id, UNIQUE | Owner |
| auto_apply_enabled | BOOLEAN | DEFAULT true | Auto-apply toggle |
| target_roles | TEXT[] | | Desired job titles |
| target_locations | TEXT[] | | Preferred locations |
| min_salary | INT | | Minimum acceptable salary |
| max_salary | INT | | Maximum salary filter |
| experience_level | VARCHAR[] | | Target experience levels |
| excluded_companies | TEXT[] | | Companies to skip |
| apply_interval_minutes | INT | DEFAULT 60 | Minutes between applications |
| notification_enabled | BOOLEAN | DEFAULT true | Notifications toggle |
| email_notifications | BOOLEAN | DEFAULT true | Email alerts |
| push_notifications | BOOLEAN | DEFAULT false | Push alerts |
| daily_limit | INT | DEFAULT 20 | Max applications per day |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update time |

**Indexes**: `user_id` (unique)

---

## Migrations

Migrations are stored in `src/database/migrations/` and run sequentially.

### Running Migrations

```bash
# Run all pending migrations
npm run db:migrate

# Rollback last migration
npm run db:rollback

# Rollback all migrations
npm run db:rollback:all

# Check migration status
npm run db:status
```

### Creating a New Migration

```bash
npm run db:create-migration -- --name=add_column_to_users
```

This creates a file like `src/database/migrations/003_add_column_to_users.js` with `up()` and `down()` functions.

### Migration Best Practices

- Always write both `up()` and `down()` functions
- Test migrations on a copy of production data
- Never modify a migration that has been deployed
- Keep migrations small and focused
- Add indexes in separate migrations from schema changes

---

## Seed Data

Demo data for development and testing:

```bash
# Seed all tables
npm run db:seed

# Seed specific table
npm run db:seed -- --table=users
```

Seed files are in `src/database/seeds/`.

---

## Redis Usage

### Cache Keys

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `user:{id}` | 1 hour | User profile cache |
| `jobs:search:{hash}` | 15 min | Job search results cache |
| `job:{id}` | 30 min | Individual job cache |
| `rate:{ip}:{endpoint}` | 1 min | Rate limiting counter |
| `session:{token}` | 7 days | User session data |

### Job Queue

Bull queues stored in Redis:

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| `job-scraper` | LinkedIn job scraping | 2 |
| `application-processor` | Submit applications | 5 |
| `notification-sender` | Email/push notifications | 10 |
| `cleanup` | Old record removal | 1 |

---

## Backup Strategy

- **Full backup**: Daily at 02:00 UTC
- **Incremental backup**: Every 6 hours
- **WAL archiving**: Continuous
- **Retention**: 30 days
- **Tested restore**: Monthly

See [DEPLOYMENT.md](./DEPLOYMENT.md) for backup configuration details.

---

**Last Updated**: 2026-03-09
