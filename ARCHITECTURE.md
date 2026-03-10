# Quickhire Architecture

## System Overview

```
┌─────────────────┐
│  LinkedIn       │
│  Platform       │
└────────┬────────┘
         │
         ↓
┌─────────────────────────────────────────────────────┐
│                 Quickhire Platform                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────┐         ┌──────────────────┐  │
│  │   API Layer     │         │  Frontend        │  │
│  │  (Express.js)   │◄───────►│  (React)         │  │
│  └────────┬────────┘         └──────────────────┘  │
│           │                                        │
│           ↓                                        │
│  ┌──────────────────────────────────────────────┐  │
│  │      Core Services Layer                     │  │
│  ├──────────────────────────────────────────────┤  │
│  │ • Auth Service (OAuth, JWT)                  │  │
│  │ • Job Service (Search, Scrape, Filter)      │  │
│  │ • Matching Service (ML-based matching)      │  │
│  │ • Application Service (Submit, Track)       │  │
│  │ • Scheduler Service (Cron jobs)             │  │
│  │ • Notification Service (Email, WebSocket)   │  │
│  └──────────────────────────────────────────────┘  │
│           │                                        │
│           ↓                                        │
│  ┌──────────────────────────────────────────────┐  │
│  │      Data Layer                              │  │
│  ├──────────────────────────────────────────────┤  │
│  │ • PostgreSQL (Primary DB)                    │  │
│  │ • Redis (Cache, Job Queue)                   │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
         │                    │
         ↓                    ↓
    ┌─────────┐          ┌──────────┐
    │ Logging │          │Monitoring│
    │ Winston │          │Prometheus│
    └─────────┘          └──────────┘
```

---

## Module Architecture

### 1. API Layer (src/api/)
**Responsibility**: HTTP request/response handling

```
api/
├── controllers/
│   ├── authController.js      # OAuth, login, logout
│   ├── jobController.js       # Job search, details
│   ├── applicationController.js # Apply, tracking
│   ├── settingsController.js  # User preferences
│   └── healthController.js    # Health check
├── routes/
│   ├── auth.js
│   ├── jobs.js
│   ├── applications.js
│   ├── settings.js
│   └── index.js               # Router aggregator
├── middleware/
│   ├── auth.js                # JWT validation
│   ├── rateLimit.js           # Rate limiting
│   ├── errorHandler.js        # Error handling
│   └── requestLogger.js       # Request logging
└── validators/
    ├── authValidator.js
    ├── jobValidator.js
    └── applicationValidator.js
```

### 2. Automation Layer (src/automation/)
**Responsibility**: Job matching and auto-apply logic

```
automation/
├── jobScraper.js            # LinkedIn job scraping
├── jobMatcher.js            # Matching algorithm
├── applicationSubmitter.js   # Submit applications
├── resumeParser.js          # Parse resume
├── coverLetterGenerator.js  # Generate cover letter
└── retryHandler.js          # Retry logic
```

### 3. Database Layer (src/database/)
**Responsibility**: Database schemas and access

```
database/
├── migrations/              # Schema versions (001, 002, ...)
├── seeds/                   # Demo data
├── models/
│   ├── User.js
│   ├── Job.js
│   ├── Application.js
│   ├── UserPreference.js
│   └── ApplicationLog.js
└── connection.js            # Connection pooling
```

### 4. Scheduler Layer (src/scheduler/)
**Responsibility**: Background jobs and cron tasks

```
scheduler/
├── jobs/
│   ├── scrapeJobsJob.js     # Daily job scraping
│   ├── processApplications.js # Hourly app processing
│   ├── sendNotifications.js  # Send emails
│   └── cleanupJob.js        # Old record cleanup
└── queue.js                 # Bull queue setup
```

### 5. Utils Layer (src/utils/)
**Responsibility**: Shared utilities

```
utils/
├── logger.js                # Winston logger
├── cache.js                 # Redis cache
├── errorCodes.js            # Error definitions
├── validators.js            # Input validation
├── formatters.js            # Data formatting
└── config.js                # Configuration
```

---

## Data Flow

### User Registration & Auth
```
1. Frontend sends LinkedIn OAuth code
   ↓
2. Backend validates with LinkedIn API
   ↓
3. Create User in PostgreSQL
   ↓
4. Generate JWT token
   ↓
5. Return token to frontend
   ↓
6. Frontend stores token (HTTP-only cookie)
```

### Job Search & Application
```
1. User sets preferences (role, location, salary)
   ↓
2. Nightly job scraper fetches LinkedIn jobs
   ↓
3. Jobs stored in PostgreSQL + Redis cache
   ↓
4. Job Matcher compares user profile with jobs
   ↓
5. Matching jobs displayed on dashboard
   ↓
6. User clicks "Auto-Apply" or bulk apply
   ↓
7. Application submitted to LinkedIn
   ↓
8. Application tracked in database
   ↓
9. User notified via email/push
```

### Auto-Apply Workflow
```
User triggers apply
        ↓
Resume/CV validation
        ↓
Application form prefill
        ↓
LinkedIn API submission
        ↓
Success?
├─ Yes: Store in DB, send confirmation
└─ No: Retry with backoff (3 attempts)
        ↓
Update application status
        ↓
Send notification
```

---

## Database Schema (PostgreSQL)

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  linkedin_id VARCHAR UNIQUE NOT NULL,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_pic_url VARCHAR,
  access_token VARCHAR (encrypted),
  refresh_token VARCHAR (encrypted),
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

### Jobs Table
```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  linkedin_job_id VARCHAR UNIQUE,
  title VARCHAR NOT NULL,
  company VARCHAR NOT NULL,
  location VARCHAR,
  salary_min INT,
  salary_max INT,
  description TEXT,
  job_level VARCHAR,
  experience_years INT,
  posted_at TIMESTAMP,
  scrape_date TIMESTAMP,
  url VARCHAR,
  hash VARCHAR UNIQUE, -- To detect duplicates
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_company (company),
  INDEX idx_title (title),
  INDEX idx_location (location)
);
```

### Applications Table
```sql
CREATE TABLE applications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  job_id UUID REFERENCES jobs(id),
  status VARCHAR DEFAULT 'pending', -- pending, submitted, viewed, rejected, archived
  applied_at TIMESTAMP,
  response_received_at TIMESTAMP,
  submission_attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMP,
  error_message TEXT,
  resume_version INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_status (user_id, status),
  INDEX idx_applied_at (applied_at)
);
```

### User Preferences Table
```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES users(id),
  auto_apply_enabled BOOLEAN DEFAULT true,
  target_roles TEXT[], -- Array of roles
  target_locations TEXT[],
  min_salary INT,
  max_salary INT,
  experience_level VARCHAR[],
  excluded_companies TEXT[],
  apply_interval_minutes INT DEFAULT 60,
  notification_enabled BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT false,
  daily_limit INT DEFAULT 20,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Response Format

### Success Response
```json
{
  "status": "success",
  "code": 200,
  "data": {
    "id": "abc123",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "meta": {
    "timestamp": "2026-03-09T10:30:00Z"
  }
}
```

### Error Response
```json
{
  "status": "error",
  "code": 400,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Email is required",
    "details": ["email field is missing"]
  },
  "meta": {
    "timestamp": "2026-03-09T10:30:00Z",
    "request_id": "req_12345"
  }
}
```

---

## Deployment Architecture

```
GitHub Repository
       ↓
GitHub Actions (CI/CD)
├─ Lint & Test
├─ Build Docker image
├─ Push to Registry
└─ Deploy
       ↓
├─ Staging Environment
│  └─ Manual testing
│
└─ Production Environment
   ├─ Kubernetes cluster
   ├─ PostgreSQL (RDS)
   ├─ Redis (ElastiCache)
   ├─ Load Balancer (ALB)
   ├─ CloudFront (CDN)
   └─ S3 (Resume storage)
```

---

## Security Layers

```
Request
   ↓
1. Rate Limiting (IP/User)
   ↓
2. HTTPS/TLS
   ↓
3. CORS Validation
   ↓
4. Authentication (OAuth/JWT)
   ↓
5. Authorization (Role-based)
   ↓
6. Input Validation
   ↓
7. SQL Injection Prevention (Parameterized)
   ↓
8. XSS Prevention (Escaping)
   ↓
9. Encryption (Sensitive data)
   ↓
Database
```

---

## Scalability Strategy

### Horizontal Scaling
- Stateless API servers (auto-scaling)
- Load balancer distributes traffic
- Database read replicas

### Vertical Scaling
- Database optimization (indexes, queries)
- Caching layer (Redis)
- Job queue for async tasks (Bull)

### Performance Optimization
- GraphQL for frontend (reduce over-fetching)
- Pagination for large datasets
- Database query optimization
- CDN for static assets
- Image optimization

---

## Monitoring & Observability

### Metrics
- API response time (histogram)
- Error rates (counter)
- Job application success rate (gauge)
- Database query performance
- Server resource usage

### Logging
- Request/response logging
- Error logging with stack traces
- Application event logging
- Audit logs for security events

### Alerting
- Error rate > 1% → Alert
- Response time p95 > 1s → Alert
- Application failure rate > 5% → Alert
- Server down → Alert
- Database connection failed → Alert

---

## Technology Choices

| Layer | Technology | Reason |
|-------|------------|--------|
| Backend | Node.js + Express | High performance, async I/O |
| Frontend | React + TypeScript | Type-safe, component-based |
| Database | PostgreSQL | ACID, relational data |
| Cache | Redis | Fast, in-memory |
| Job Queue | Bull | Reliable job processing |
| Auth | OAuth 2.0 | Industry standard |
| Logging | Winston | Structured logging |
| Testing | Jest + Cypress | Comprehensive testing |
| CI/CD | GitHub Actions | Native GitHub integration |
| Deployment | Docker + K8s | Containerized, scalable |

---

**Last Updated**: 2026-03-09
**Version**: 1.0
