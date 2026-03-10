# Quickhire - Security Best Practices

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email **security@quickhire.ai** with details
3. Include steps to reproduce
4. We will acknowledge within 24 hours
5. We aim to fix critical issues within 72 hours

---

## Authentication & Authorization

### OAuth 2.0

- LinkedIn OAuth 2.0 with PKCE for secure authentication
- Authorization codes are single-use and expire in 10 minutes
- Access tokens stored encrypted in the database
- Refresh tokens rotated on every use

### JWT

- Tokens signed with RS256 (asymmetric)
- Expiration: 7 days
- Tokens stored in HTTP-only, Secure, SameSite=Strict cookies
- Token blacklist maintained in Redis for revocation

### Session Management

- Sessions invalidated on password change
- Concurrent session limit enforced
- Idle timeout: 30 minutes
- Absolute timeout: 24 hours

---

## Data Protection

### Encryption at Rest

- Sensitive fields (tokens, PII) encrypted with AES-256-GCM
- Encryption keys stored in AWS Secrets Manager
- Key rotation every 90 days

### Encryption in Transit

- TLS 1.3 enforced for all connections
- HSTS enabled with 1-year max-age
- Certificate pinning for mobile clients

### Data Classification

| Level | Examples | Protection |
|-------|----------|------------|
| Critical | Access tokens, passwords | Encrypted + access logging |
| Sensitive | Email, name, resume | Encrypted at rest |
| Internal | Job data, analytics | Standard access controls |
| Public | Company names, job titles | None required |

---

## Input Validation

### Server-Side Validation

- All user input validated on the server
- Parameterized queries prevent SQL injection
- Input length limits enforced
- File uploads scanned and type-checked
- Request body size limited to 10MB

### XSS Prevention

- Output encoding on all rendered content
- Content-Security-Policy headers enforced
- No inline scripts allowed
- DOM manipulation sanitized

### CSRF Protection

- CSRF tokens on all state-changing requests
- SameSite cookie attribute set to Strict
- Origin header validation

---

## API Security

### Rate Limiting

- Per-IP and per-user rate limiting
- Exponential backoff on authentication failures
- Account lockout after 5 failed login attempts (15 min)

### CORS

- Whitelist of allowed origins
- Credentials restricted to same origin
- No wildcard origins in production

### Headers

All responses include:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## Infrastructure Security

### Network

- VPC with private subnets for databases
- Security groups with least-privilege rules
- No public access to database or Redis
- WAF (Web Application Firewall) on load balancer

### Secrets Management

- No secrets in code or environment files
- AWS Secrets Manager for all credentials
- Kubernetes Secrets with encryption at rest
- Secret rotation automated

### Container Security

- Minimal base images (Alpine)
- Non-root container user
- Read-only filesystem where possible
- Image scanning in CI pipeline

---

## Logging & Monitoring

### Security Logging

- Authentication events (login, logout, failure)
- Authorization failures
- Input validation failures
- Rate limit triggers
- Admin actions

### What We Never Log

- Passwords or tokens
- Full credit card numbers
- Social Security numbers
- Raw request bodies with PII

### Monitoring

- Real-time alerting on suspicious patterns
- Failed login spike detection
- Unusual API usage patterns
- Geographic anomaly detection

---

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P0 - Critical | Data breach, service compromise | 15 minutes |
| P1 - High | Authentication bypass, privilege escalation | 1 hour |
| P2 - Medium | XSS, information disclosure | 4 hours |
| P3 - Low | Minor issues, best practice gaps | 1 week |

### Response Process

1. **Identify** - Detect and confirm the incident
2. **Contain** - Limit the blast radius
3. **Eradicate** - Remove the vulnerability
4. **Recover** - Restore normal operations
5. **Post-mortem** - Document and learn

---

## Compliance

### GDPR

- Right to access personal data
- Right to delete (data erasure)
- Data portability
- Consent management
- Data processing records

### Data Retention

| Data Type | Retention | After Expiry |
|-----------|-----------|-------------|
| User accounts | Until deletion requested | Hard delete within 30 days |
| Job data | 90 days after posting expires | Anonymized |
| Application data | 1 year | Anonymized |
| Logs | 90 days | Deleted |
| Analytics | 2 years | Aggregated |

---

## Development Security Checklist

Before every PR:

- [ ] No secrets in code
- [ ] Input validation on all endpoints
- [ ] Parameterized database queries
- [ ] Authentication required on protected routes
- [ ] Authorization checks (users can only access their data)
- [ ] Error messages do not leak internal details
- [ ] Dependencies scanned for vulnerabilities (`npm audit`)
- [ ] No `eval()` or dynamic code execution
- [ ] File uploads validated and sandboxed
- [ ] CORS configuration reviewed

---

**Last Updated**: 2026-03-09
