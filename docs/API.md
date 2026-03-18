# Quickhire - API Reference

## Base URL

| Environment | Base URL |
|-------------|----------|
| Development | `http://localhost:8000` |
| Staging | `https://staging.quickhire.ai` |
| Production | `https://app.quickhire.ai` |

## Authentication

All protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Tokens are obtained via the LinkedIn OAuth flow and expire after 7 days.

---

## Response Format

### Success Response

```json
{
  "status": "success",
  "code": 200,
  "data": { ... },
  "meta": {
    "timestamp": "2026-03-09T10:30:00Z",
    "request_id": "req_abc123"
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
    "message": "Human-readable error message",
    "details": ["field-level error details"]
  },
  "meta": {
    "timestamp": "2026-03-09T10:30:00Z",
    "request_id": "req_abc123"
  }
}
```

### Pagination

Paginated endpoints return:

```json
{
  "status": "success",
  "data": [ ... ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

---

## Endpoints

### Health Check

#### `GET /health`

Returns service health status. No authentication required.

**Response** `200 OK`
```json
{
  "status": "success",
  "data": {
    "server": "running",
    "database": "connected",
    "redis": "connected",
    "uptime": 86400
  }
}
```

---

### Authentication

#### `POST /auth/login`

Initiate LinkedIn OAuth login. Exchanges OAuth authorization code for a JWT.

**Request Body**
```json
{
  "code": "linkedin_oauth_authorization_code",
  "redirect_uri": "http://localhost:3000/auth/callback"
}
```

**Response** `200 OK`
```json
{
  "status": "success",
  "data": {
    "token": "eyJhbGciOi...",
    "expires_in": 604800,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "profile_pic_url": "https://..."
    }
  }
}
```

**Errors**
| Code | Description |
|------|-------------|
| 400 | Invalid or expired OAuth code |
| 401 | LinkedIn authentication failed |
| 500 | Internal server error |

---

#### `POST /auth/logout`

Invalidate the current session. Requires authentication.

**Response** `200 OK`
```json
{
  "status": "success",
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

#### `GET /auth/profile`

Get the authenticated user's profile. Requires authentication.

**Response** `200 OK`
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "profile_pic_url": "https://...",
    "created_at": "2026-01-15T08:00:00Z"
  }
}
```

---

### Jobs

#### `GET /jobs/search`

Search for jobs with filters. Requires authentication.

**Query Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| role | string | No | Job title or keyword |
| location | string | No | City or "remote" |
| salary_min | number | No | Minimum salary |
| salary_max | number | No | Maximum salary |
| experience | string | No | Entry, Mid, Senior, Lead |
| page | number | No | Page number (default: 1) |
| per_page | number | No | Results per page (default: 20, max: 100) |

**Example**
```
GET /jobs/search?role=engineer&location=remote&salary_min=100000&page=1
```

**Response** `200 OK`
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "title": "Senior Software Engineer",
      "company": "TechCorp",
      "location": "Remote",
      "salary_min": 120000,
      "salary_max": 160000,
      "description": "We are looking for...",
      "job_level": "Senior",
      "experience_years": 5,
      "posted_at": "2026-03-08T12:00:00Z",
      "url": "https://linkedin.com/jobs/..."
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 342,
    "total_pages": 18
  }
}
```

---

#### `GET /jobs/:id`

Get detailed information about a specific job. Requires authentication.

**Response** `200 OK`
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "title": "Senior Software Engineer",
    "company": "TechCorp",
    "location": "Remote",
    "salary_min": 120000,
    "salary_max": 160000,
    "description": "Full job description...",
    "job_level": "Senior",
    "experience_years": 5,
    "posted_at": "2026-03-08T12:00:00Z",
    "url": "https://linkedin.com/jobs/...",
    "match_score": 0.92
  }
}
```

**Errors**
| Code | Description |
|------|-------------|
| 404 | Job not found |

---

#### `POST /jobs/:id/apply`

Apply to a job. Requires authentication.

**Request Body**
```json
{
  "resume_version": 1,
  "cover_letter": "Optional custom cover letter text",
  "answers": {
    "years_experience": "5",
    "willing_to_relocate": "yes"
  }
}
```

**Response** `201 Created`
```json
{
  "status": "success",
  "data": {
    "application_id": "uuid",
    "job_id": "uuid",
    "status": "submitted",
    "applied_at": "2026-03-09T10:30:00Z"
  }
}
```

**Errors**
| Code | Description |
|------|-------------|
| 400 | Invalid request body |
| 404 | Job not found |
| 409 | Already applied to this job |
| 429 | Daily application limit reached |

---

### Applications

#### `GET /applications`

List all applications for the authenticated user. Requires authentication.

**Query Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status: pending, submitted, viewed, rejected, archived |
| page | number | No | Page number (default: 1) |
| per_page | number | No | Results per page (default: 20) |
| sort | string | No | Sort field (default: applied_at) |
| order | string | No | asc or desc (default: desc) |

**Response** `200 OK`
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "job": {
        "id": "uuid",
        "title": "Senior Software Engineer",
        "company": "TechCorp"
      },
      "status": "submitted",
      "applied_at": "2026-03-09T10:30:00Z",
      "submission_attempts": 1
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 45,
    "total_pages": 3
  }
}
```

---

#### `GET /applications/:id`

Get details of a specific application. Requires authentication.

**Response** `200 OK`
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "job": {
      "id": "uuid",
      "title": "Senior Software Engineer",
      "company": "TechCorp",
      "location": "Remote"
    },
    "status": "submitted",
    "applied_at": "2026-03-09T10:30:00Z",
    "response_received_at": null,
    "submission_attempts": 1,
    "resume_version": 1
  }
}
```

---

#### `PATCH /applications/:id/status`

Update application status. Requires authentication.

**Request Body**
```json
{
  "status": "archived"
}
```

Valid statuses: `pending`, `submitted`, `viewed`, `rejected`, `archived`

**Response** `200 OK`
```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "status": "archived",
    "updated_at": "2026-03-09T11:00:00Z"
  }
}
```

---

### Settings

#### `GET /settings`

Get user preferences. Requires authentication.

**Response** `200 OK`
```json
{
  "status": "success",
  "data": {
    "auto_apply_enabled": true,
    "target_roles": ["Software Engineer", "Full Stack Developer"],
    "target_locations": ["Remote", "San Francisco, CA"],
    "min_salary": 100000,
    "max_salary": 200000,
    "experience_level": ["Mid", "Senior"],
    "excluded_companies": ["CompanyX"],
    "apply_interval_minutes": 60,
    "daily_limit": 20
  }
}
```

---

#### `PATCH /settings`

Update user preferences. Requires authentication. Supports partial updates.

**Request Body**
```json
{
  "target_roles": ["Backend Engineer"],
  "min_salary": 120000,
  "daily_limit": 30
}
```

**Response** `200 OK`
```json
{
  "status": "success",
  "data": {
    "message": "Settings updated",
    "updated_fields": ["target_roles", "min_salary", "daily_limit"]
  }
}
```

---

#### `GET /settings/notifications`

Get notification preferences. Requires authentication.

**Response** `200 OK`
```json
{
  "status": "success",
  "data": {
    "notification_enabled": true,
    "email_notifications": true,
    "push_notifications": false
  }
}
```

---

## Rate Limiting

| Endpoint Group | Rate Limit |
|---------------|------------|
| Authentication | 10 requests/minute |
| Job Search | 60 requests/minute |
| Job Apply | 20 requests/hour |
| General API | 100 requests/minute |

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1709985600
```

---

## Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| VALIDATION_ERROR | 400 | Input validation failed |
| INVALID_INPUT | 400 | Missing or invalid request data |
| UNAUTHORIZED | 401 | Authentication required |
| INVALID_TOKEN | 401 | JWT token is invalid |
| TOKEN_EXPIRED | 401 | JWT token has expired |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| APPLICATION_LIMIT_REACHED | 429 | Daily application limit reached |
| INTERNAL_ERROR | 500 | Internal server error |
| DATABASE_ERROR | 500 | Database operation failed |
| LINKEDIN_API_ERROR | 502 | LinkedIn API error |
| SERVICE_UNAVAILABLE | 503 | Service temporarily unavailable |

---

**Last Updated**: 2026-03-09
