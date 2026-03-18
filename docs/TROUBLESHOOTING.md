# Quickhire - Troubleshooting Guide

## Common Issues

### Application Won't Start

**Symptom**: `npm run dev` fails or server crashes on startup.

**Causes & Fixes**:

1. **Missing environment variables**
   ```bash
   # Check that .env exists and has all required values
   cat .env
   # Compare with .env.example
   diff .env .env.example
   ```

2. **Port already in use**
   ```bash
   lsof -i :8000
   kill -9 <PID>
   ```

3. **Database not running**
   ```bash
   pg_isready
   # If not running:
   # macOS: brew services start postgresql
   # Linux: sudo systemctl start postgresql
   ```

4. **Redis not running**
   ```bash
   redis-cli ping
   # If not running:
   # macOS: brew services start redis
   # Linux: sudo systemctl start redis
   ```

5. **Node version mismatch**
   ```bash
   node --version  # Must be 18+
   nvm use 18
   ```

---

### Database Connection Failed

**Symptom**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Fixes**:

1. Verify PostgreSQL is running: `pg_isready`
2. Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD in `.env`
3. Verify the database exists:
   ```bash
   psql -U postgres -l | grep quickhire
   ```
4. Check PostgreSQL logs:
   ```bash
   # macOS
   tail -f /opt/homebrew/var/log/postgresql@14.log
   # Linux
   tail -f /var/log/postgresql/postgresql-14-main.log
   ```

---

### Migration Errors

**Symptom**: `npm run db:migrate` fails.

**Fixes**:

1. **Pending migration conflict**: Check migration status
   ```bash
   npm run db:status
   ```

2. **Table already exists**: Rollback and re-run
   ```bash
   npm run db:rollback
   npm run db:migrate
   ```

3. **Permission denied**: Grant privileges
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE quickhire_dev TO quickhire_user;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO quickhire_user;
   ```

---

### LinkedIn OAuth Not Working

**Symptom**: Login redirects fail or return errors.

**Fixes**:

1. Verify `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` in `.env`
2. Check redirect URI matches exactly (no trailing slash differences)
3. Ensure OAuth scopes are approved in LinkedIn Developer Portal
4. Check that the LinkedIn app is not in "Development" mode (limited to approved test users)
5. Clear browser cookies and try again

---

### Tests Failing

**Symptom**: `npm test` reports failures.

**Fixes**:

1. **Test database not set up**:
   ```bash
   npm run db:test:setup
   ```

2. **Stale test data**: Reset test database
   ```bash
   npm run db:test:teardown
   npm run db:test:setup
   ```

3. **Environment mismatch**: Ensure `.env.test` exists with test database config

4. **Port conflicts**: Close other running instances before integration tests

---

### Redis Cache Issues

**Symptom**: Stale data, cache misses, or Redis errors.

**Fixes**:

1. **Flush cache** (development only):
   ```bash
   redis-cli FLUSHDB
   ```

2. **Check Redis memory**:
   ```bash
   redis-cli INFO memory
   ```

3. **Monitor Redis commands**:
   ```bash
   redis-cli MONITOR
   ```

---

### Slow API Responses

**Symptom**: API response times exceed 200ms.

**Diagnosis**:

1. Check database query performance:
   ```bash
   # Enable query logging in .env
   DB_LOG_QUERIES=true
   ```

2. Check Redis connection:
   ```bash
   redis-cli ping  # Should respond in < 1ms
   ```

3. Check for N+1 queries in logs

4. Verify database indexes exist:
   ```sql
   \d+ jobs  -- Check indexes on jobs table
   ```

---

### Docker Issues

**Symptom**: `docker-compose up` fails.

**Fixes**:

1. **Image build failed**: Rebuild without cache
   ```bash
   docker-compose build --no-cache
   ```

2. **Volume permissions**: Reset volumes
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

3. **Port conflicts**: Check for conflicting containers
   ```bash
   docker ps
   ```

---

### CORS Errors

**Symptom**: Browser shows CORS policy errors.

**Fixes**:

1. Verify `FRONTEND_URL` in `.env` matches the frontend origin exactly
2. Check that the request includes proper headers
3. For development, ensure both frontend and backend are running

---

## Getting More Help

If your issue is not listed here:

1. Search [GitHub Issues](https://github.com/quickhire/quickhire-auto-apply/issues)
2. Check the application logs: `npm run logs`
3. Ask in GitHub Discussions or Discord
4. Open a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version)
   - Relevant error logs

---

**Last Updated**: 2026-03-09
