# Quickhire - Operations Runbook

## Overview

This runbook provides step-by-step procedures for common operational scenarios. Follow these procedures during incidents or routine maintenance.

For local-agent execution, the high-level dashboard is:

```bash
bash bin/live-progress.sh
```

For raw runtime state, use:

```bash
tail -f state/local-agent-runtime/company-fleet.log
```

The dashboard should show the overall bar, the current task, ETA, active owner, and capacity band.

Role views on the dashboard should read differently:

- `CTO` sees release readiness, blocker count, merge status, and whether the plan is safe to ship.
- `VP Engineering` sees utilization, throughput, queue health, and CI stability.
- `Director` sees task ownership, replica coverage, escalation points, and blocker aging.
- `Manager` sees the current task, next action, per-task progress, and handoff status.

Workflow policy is documented in repo-local docs; live state is stored under `state/local-agent-runtime/`; the runbook assumes one active source of truth at a time.

---

## Service Health Check

### Verify All Services Running

```bash
# API health
curl https://app.quickhire.ai/health

# Check Kubernetes pods
kubectl get pods --namespace=quickhire-production

# Check database connectivity
kubectl exec -it <api-pod> -- node -e "require('./src/database/connection').raw('SELECT 1')"

# Check Redis connectivity
kubectl exec -it <api-pod> -- redis-cli -h <redis-host> ping
```

---

## Incident Response

### High Error Rate (> 1%)

**Severity**: P1

1. Check error logs:
   ```bash
   kubectl logs -f deployment/quickhire-api --namespace=quickhire-production --tail=100
   ```

2. Identify the failing endpoint(s) from Grafana dashboard

3. Check recent deployments:
   ```bash
   kubectl rollout history deployment/quickhire-api --namespace=quickhire-production
   ```

4. If caused by recent deploy, rollback:
   ```bash
   kubectl rollout undo deployment/quickhire-api --namespace=quickhire-production
   ```

5. If not deployment-related, check:
   - Database connection pool exhaustion
   - Redis connectivity
   - External service (LinkedIn API) status
   - Memory/CPU resource limits

6. Notify team in Discord #incidents channel

---

### API Response Time Degradation (p95 > 1s)

**Severity**: P1

1. Check Grafana for latency spike source (which endpoint)

2. Check database query performance:
   ```bash
   kubectl exec -it <api-pod> -- node -e "
     const db = require('./src/database/connection');
     db.raw('SELECT pid, state, query, query_start FROM pg_stat_activity WHERE state != \'idle\'').then(r => console.log(r.rows));
   "
   ```

3. Check for long-running queries and kill if needed:
   ```sql
   SELECT pg_cancel_backend(<pid>);
   ```

4. Check Redis memory and eviction:
   ```bash
   redis-cli -h <redis-host> INFO memory
   ```

5. Check pod resource usage:
   ```bash
   kubectl top pods --namespace=quickhire-production
   ```

6. Scale up if under-resourced:
   ```bash
   kubectl scale deployment/quickhire-api --replicas=5 --namespace=quickhire-production
   ```

---

### Database Connection Failure

**Severity**: P0

1. Check RDS instance status in AWS Console

2. Verify security group allows connections from EKS nodes

3. Check connection pool status in application logs

4. Restart API pods to reset connection pool:
   ```bash
   kubectl rollout restart deployment/quickhire-api --namespace=quickhire-production
   ```

5. If RDS is down, check for:
   - Storage full
   - Multi-AZ failover in progress
   - Maintenance window

6. Escalate to AWS support if RDS is unresponsive

---

### Redis Connection Failure

**Severity**: P1

1. Check ElastiCache status in AWS Console

2. The application should degrade gracefully (bypass cache, hit DB directly)

3. Verify Redis endpoint and port in configuration

4. Check Redis memory usage (eviction may cause issues)

5. If Redis is down, restart API pods to reconnect:
   ```bash
   kubectl rollout restart deployment/quickhire-api --namespace=quickhire-production
   ```

---

### Service Completely Down

**Severity**: P0

1. Check pod status:
   ```bash
   kubectl get pods --namespace=quickhire-production
   ```

2. Check for CrashLoopBackOff:
   ```bash
   kubectl describe pod <pod-name> --namespace=quickhire-production
   ```

3. Check events:
   ```bash
   kubectl get events --namespace=quickhire-production --sort-by=.lastTimestamp
   ```

4. Check if nodes are healthy:
   ```bash
   kubectl get nodes
   ```

5. If OOM killed, increase memory limits:
   ```bash
   kubectl edit deployment/quickhire-api --namespace=quickhire-production
   ```

6. If persistent, rollback to last known good version

---

## Routine Operations

### Local-Agent Handoff

1. Check the runtime state:
   ```bash
   tail -n 80 state/local-agent-runtime/company-fleet.log
   ```
2. Confirm which role owns the current work item.
3. If the owner is stalled, let the replica set take over from the persisted checkpoint.
4. Update runtime state by overwrite, not by creating a competing tracker.
5. Resume the merge loop only after the CI gate is green.
6. If a stale file conflicts with the checkpoint, refresh from the checkpoint and overwrite the stale state before continuing.

### Deploy New Version

1. Verify CI/CD pipeline passed
2. Check staging environment
3. Notify team of deployment
4. Apply production deployment:
   ```bash
   kubectl apply -f k8s/production/ --namespace=quickhire-production
   ```
5. Monitor rollout:
   ```bash
   kubectl rollout status deployment/quickhire-api --namespace=quickhire-production
   ```
6. Run smoke tests
7. Monitor for 30 minutes

### Database Migration

1. Take database backup
2. Run migration as Kubernetes Job:
   ```bash
   kubectl apply -f k8s/jobs/migrate.yaml --namespace=quickhire-production
   ```
3. Verify migration completed:
   ```bash
   kubectl logs job/db-migrate --namespace=quickhire-production
   ```
4. Test affected endpoints

### Scale Up/Down

```bash
# Scale API
kubectl scale deployment/quickhire-api --replicas=<N> --namespace=quickhire-production

# Verify
kubectl get pods --namespace=quickhire-production
```

### Certificate Renewal

Certificates are auto-renewed via ACM. If manual renewal needed:

1. Request new certificate in AWS ACM
2. Update ALB listener with new certificate ARN
3. Verify HTTPS is working

### Log Rotation

Application logs are managed by Kubernetes. For persistent logs:

```bash
# View recent logs
kubectl logs deployment/quickhire-api --namespace=quickhire-production --tail=200

# Export logs to file
kubectl logs deployment/quickhire-api --namespace=quickhire-production --since=24h > logs_$(date +%Y%m%d).txt
```

---

## Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-Call Engineer | Rotating (see schedule) | Slack #on-call |
| Engineering Lead | [Name] | Direct message |
| DevOps Lead | [Name] | Direct message |
| AWS Support | AWS Console | Severity 1 case |

---

**Last Updated**: 2026-03-09
