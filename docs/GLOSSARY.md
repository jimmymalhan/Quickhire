# Quickhire - Glossary

## Terms & Definitions

| Term | Definition |
|------|-----------|
| **Auto-Apply** | The automated process of submitting job applications on behalf of a user based on their preferences. |
| **Bull Queue** | A Node.js library used for managing background job processing with Redis. |
| **Cover Letter Generator** | A module that creates customized cover letters based on user profile and job description. |
| **CRUD** | Create, Read, Update, Delete -- the four basic database operations. |
| **E2E Test** | End-to-end test that simulates real user workflows from the frontend to the database. |
| **Express.js** | The Node.js web framework used for the Quickhire API layer. |
| **HSTS** | HTTP Strict Transport Security -- a header that forces browsers to use HTTPS. |
| **Integration Test** | A test that verifies multiple components working together (e.g., API + database). |
| **Job Matcher** | The algorithm that scores jobs against a user's preferences to find the best matches. |
| **Job Scraper** | A module that fetches job listings from LinkedIn and stores them in the database. |
| **JWT** | JSON Web Token -- the token format used for API authentication. |
| **LinkedIn OAuth** | The authentication protocol used to securely log in users via their LinkedIn accounts. |
| **Match Score** | A value from 0 to 1 indicating how well a job matches a user's preferences. |
| **Migration** | A versioned database schema change that can be applied or rolled back. |
| **N+1 Query** | A performance anti-pattern where a loop triggers one database query per iteration instead of a single batch query. |
| **OAuth 2.0** | An authorization framework that enables secure third-party login (LinkedIn in this case). |
| **p95** | The 95th percentile latency -- 95% of requests are faster than this value. |
| **PII** | Personally Identifiable Information -- data that can identify an individual (name, email, etc.). |
| **PKCE** | Proof Key for Code Exchange -- an OAuth extension that prevents authorization code interception. |
| **Rate Limiting** | Restricting the number of API requests a client can make in a given time window. |
| **Redis** | An in-memory data store used for caching and job queues in Quickhire. |
| **Resume Parser** | A module that extracts structured data from uploaded resumes. |
| **Rollback** | Reverting a deployment or database migration to a previous state. |
| **Seed Data** | Pre-populated test/demo data for development and testing. |
| **Semver** | Semantic Versioning (MAJOR.MINOR.PATCH) used for release numbering. |
| **Soft Delete** | Marking a record as deleted (setting `deleted_at`) instead of removing it from the database. |
| **Unit Test** | A test that verifies a single function or module in isolation. |
| **WAL** | Write-Ahead Logging -- a PostgreSQL feature for data durability and point-in-time recovery. |

---

**Last Updated**: 2026-03-09
