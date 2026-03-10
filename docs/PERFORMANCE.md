# Quickhire - Performance Guide

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API response (GET) | < 200ms | p95 |
| API response (POST) | < 500ms | p95 |
| Database queries | < 50ms | p95 |
| Job matching (1M jobs) | < 1 second | p95 |
| Frontend First Contentful Paint | < 1 second | Lighthouse |
| Frontend Time to Interactive | < 3 seconds | Lighthouse |
| Lighthouse score | > 90 | All categories |
| Frontend bundle size | < 500KB | Gzipped |

---

## Backend Performance

### Database Optimization

**Indexing Strategy**

All frequently queried columns are indexed:

```sql
-- Jobs table
CREATE INDEX idx_jobs_company ON jobs(company);
CREATE INDEX idx_jobs_title ON jobs(title);
CREATE INDEX idx_jobs_location ON jobs(location);

-- Applications table
CREATE INDEX idx_apps_user_status ON applications(user_id, status);
CREATE INDEX idx_apps_applied_at ON applications(applied_at);
```

**Query Best Practices**

- Use `SELECT` with specific columns, not `SELECT *`
- Use pagination for large result sets (limit/offset or cursor-based)
- Use `EXPLAIN ANALYZE` to profile slow queries
- Avoid N+1 queries; use JOINs or batch loading
- Use database connection pooling

### Caching Strategy

Redis caching reduces database load:

| Cached Data | TTL | Invalidation |
|-------------|-----|-------------|
| User profiles | 1 hour | On update |
| Job search results | 15 min | On new scrape |
| Individual jobs | 30 min | On update |
| Dashboard stats | 5 min | Time-based |

Cache-aside pattern:
1. Check Redis for cached data
2. If miss, query database
3. Store result in Redis with TTL
4. Return data

### Connection Pooling

PostgreSQL connection pool settings:

| Setting | Value | Rationale |
|---------|-------|-----------|
| Min connections | 5 | Baseline availability |
| Max connections | 20 | Prevent DB overload |
| Idle timeout | 10s | Release unused connections |
| Connection timeout | 5s | Fail fast on overload |

### Background Jobs

Heavy operations run asynchronously via Bull queues:
- Job scraping (runs nightly)
- Application submissions (runs on schedule)
- Email notifications (event-driven)
- Data cleanup (runs weekly)

---

## Frontend Performance

### Bundle Optimization

- Code splitting with React.lazy and Suspense
- Tree shaking for unused code elimination
- Dynamic imports for route-based splitting
- Image optimization (WebP, lazy loading)

### Rendering

- Virtualized lists for large datasets (react-window)
- Memoization with React.memo and useMemo
- Debounced search inputs (300ms)
- Optimistic UI updates

### Network

- API response compression (gzip/brotli)
- CDN for static assets (CloudFront)
- Prefetch critical resources
- Service worker for offline capability

---

## Load Testing

### Tools

- **k6**: API load testing
- **Lighthouse CI**: Frontend performance

### Running Load Tests

```bash
# API load test
npm run test:performance

# Frontend performance audit
npm run lighthouse
```

### Test Scenarios

| Scenario | Users | Duration | Success Criteria |
|----------|-------|----------|-----------------|
| Normal load | 100 concurrent | 5 min | p95 < 200ms, 0% errors |
| Peak load | 500 concurrent | 5 min | p95 < 500ms, < 1% errors |
| Stress test | 1000 concurrent | 10 min | p95 < 1s, < 5% errors |
| Endurance | 200 concurrent | 1 hour | No memory leaks, stable response times |

---

## Monitoring

### Key Metrics

Monitor these in Prometheus/Grafana:

- **Request rate**: Requests per second by endpoint
- **Error rate**: 4xx and 5xx responses
- **Latency**: p50, p95, p99 response times
- **Throughput**: Bytes transferred
- **Database**: Query time, connection pool usage
- **Redis**: Hit rate, memory usage
- **Node.js**: Event loop lag, heap usage

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| API p95 latency | > 500ms | > 1s |
| Error rate | > 1% | > 5% |
| CPU usage | > 70% | > 90% |
| Memory usage | > 80% | > 95% |
| DB connections | > 80% pool | > 95% pool |

---

## Optimization Checklist

Before each release:

- [ ] No N+1 queries (check logs)
- [ ] Database indexes cover query patterns
- [ ] Redis cache hit rate > 80%
- [ ] API responses < 200ms (p95)
- [ ] Frontend Lighthouse score > 90
- [ ] Bundle size within budget (< 500KB gzipped)
- [ ] No memory leaks in endurance tests
- [ ] Load test passes at peak capacity

---

**Last Updated**: 2026-03-09
