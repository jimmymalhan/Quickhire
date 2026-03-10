# Quickhire - Deployment Guide

## Overview

Quickhire uses a containerized deployment pipeline with GitHub Actions for CI/CD, Docker for packaging, and Kubernetes for orchestration.

```
Code Push → GitHub Actions → Docker Build → Push to Registry → Deploy to K8s
```

---

## Environments

| Environment | Branch | URL | Purpose |
|-------------|--------|-----|---------|
| Development | `develop` | localhost:8000 | Local development |
| Staging | `release/*` | staging.quickhire.ai | Pre-production testing |
| Production | `main` | app.quickhire.ai | Live application |

---

## Prerequisites

- Docker 24+
- kubectl configured for your cluster
- AWS CLI (if deploying to AWS)
- Helm 3+ (for Kubernetes charts)
- Access to container registry

---

## Docker Build

### Build the Image

```bash
# Build production image
docker build -t quickhire:latest -f Dockerfile .

# Build with specific tag
docker build -t quickhire:v1.0.0 -f Dockerfile .
```

### Run Locally with Docker

```bash
docker-compose up -d
```

### Push to Registry

```bash
# Tag for registry
docker tag quickhire:latest <registry>/quickhire:latest

# Push
docker push <registry>/quickhire:latest
```

---

## Staging Deployment

### Automated (via CI/CD)

Pushing to a `release/*` branch triggers automatic staging deployment:

```bash
git checkout -b release/v1.0.0
git push origin release/v1.0.0
```

### Manual

```bash
npm run deploy:staging
```

Or with kubectl:

```bash
kubectl apply -f k8s/staging/ --namespace=quickhire-staging
```

### Staging Verification

```bash
curl https://staging.quickhire.ai/health
```

Run smoke tests:

```bash
npm run test:smoke -- --env=staging
```

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] All tests pass on staging
- [ ] Manual QA testing completed
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] CHANGELOG.md updated
- [ ] Release notes prepared
- [ ] Rollback plan documented
- [ ] Team notified of deployment window

### Deploy

```bash
npm run deploy:production
```

Or with kubectl:

```bash
kubectl apply -f k8s/production/ --namespace=quickhire-production
```

### Post-Deployment Verification

1. Health check: `curl https://app.quickhire.ai/health`
2. Monitor error rates in Prometheus/Grafana
3. Check application logs for errors
4. Verify critical user flows manually
5. Monitor performance metrics for 30 minutes

---

## Infrastructure

### AWS Resources

| Service | Purpose | Configuration |
|---------|---------|---------------|
| EKS | Kubernetes cluster | 3 nodes, t3.medium |
| RDS | PostgreSQL database | db.r5.large, Multi-AZ |
| ElastiCache | Redis cache | cache.r5.large |
| ALB | Load balancer | HTTPS termination |
| CloudFront | CDN | Static asset delivery |
| S3 | File storage | Resume uploads |
| Route 53 | DNS | Domain management |
| ACM | SSL certificates | Auto-renewal |

### Kubernetes Resources

```yaml
# Application deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: quickhire-api
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

---

## Environment Variables (Production)

Production secrets are managed through:
- **AWS Secrets Manager** for sensitive values
- **Kubernetes ConfigMaps** for non-sensitive configuration
- **Kubernetes Secrets** for credentials

Never store production secrets in code or `.env` files.

```bash
# Create Kubernetes secret
kubectl create secret generic quickhire-secrets \
  --from-literal=DB_PASSWORD=<value> \
  --from-literal=JWT_SECRET=<value> \
  --from-literal=LINKEDIN_CLIENT_SECRET=<value> \
  --namespace=quickhire-production
```

---

## Database Migrations (Production)

Run migrations as a Kubernetes Job before deploying new code:

```bash
kubectl apply -f k8s/jobs/migrate.yaml --namespace=quickhire-production
```

Always:
- Back up the database before running migrations
- Test migrations on staging first
- Write reversible migrations
- Monitor migration execution time

---

## Rollback

### Quick Rollback (Kubernetes)

```bash
# Rollback to previous deployment
kubectl rollout undo deployment/quickhire-api --namespace=quickhire-production

# Rollback to specific revision
kubectl rollout undo deployment/quickhire-api --to-revision=3 --namespace=quickhire-production
```

### Docker Image Rollback

```bash
# Deploy previous image version
kubectl set image deployment/quickhire-api \
  quickhire-api=<registry>/quickhire:v0.9.0 \
  --namespace=quickhire-production
```

### Database Rollback

```bash
npm run db:rollback -- --steps=1
```

---

## Scaling

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: quickhire-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: quickhire-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Manual Scaling

```bash
kubectl scale deployment/quickhire-api --replicas=5 --namespace=quickhire-production
```

---

## SSL/TLS

- SSL certificates managed by AWS ACM with auto-renewal
- TLS 1.3 enforced at the load balancer
- HSTS headers enabled
- Certificate monitoring alerts configured

---

## Monitoring Post-Deploy

After every deployment, monitor for 30 minutes:

- Error rate dashboard (target: < 0.1%)
- Response time p95 (target: < 200ms)
- CPU and memory utilization
- Database connection count
- Redis memory usage
- Application logs for new errors

---

**Last Updated**: 2026-03-09
