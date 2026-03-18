# Backend Production-Grade Standards

## Error Handling
Every error response must include:
- `code`: Error type (VALIDATION_ERROR, NOT_FOUND, RATE_LIMITED, etc.)
- `message`: User-friendly message (non-technical)
- `traceId`: X-Request-ID for debugging
- `status`: HTTP status code
- `recovery`: Suggested next action for user/operator

Example:
```json
{
  "status": "error",
  "code": "RATE_LIMITED",
  "message": "Too many requests. Please wait before trying again.",
  "traceId": "req-abc-123",
  "meta": { "retryAfterSeconds": 30 }
}
```

## Validation
- Validate all inputs at API boundary (req.body, req.query, req.params)
- Clear error messages for each validation failure
- Type checking for critical fields
- File: `src/utils/validators.js`

## Observability
- Every request logs: method, path, status, duration, userId
- Errors log: type, message, stack trace, context
- Pattern: Structured logs (JSON), not printf-style
- File: `src/utils/logger.js`

## Reliability Patterns
- **Idempotency**: Critical operations use idempotency keys
- **Retries**: Exponential backoff for transient failures
- **Timeouts**: All external calls have timeouts
- **Circuit breaker**: Fail fast if dependency is down
- File: `src/automation/retryHandler.js`

## Requests & Responses
- Add X-Request-ID to all responses
- Include timestamp in all responses
- Consistent response envelope: `{ status, code, data, meta, error }`
- File: `src/api/middleware/`

## Database Operations
- All mutations logged
- Transactions for multi-step operations
- Migration scripts for schema changes
- Backup before significant changes

## Security
- Never log credentials or tokens
- Hash passwords, never plaintext
- SQL injection prevention via parameterized queries
- Rate limiting on sensitive endpoints

---

**Rule**: If error doesn't include traceId and recovery hint, it's incomplete
**Test**: All errors testable via localhost:8000, clear messages
