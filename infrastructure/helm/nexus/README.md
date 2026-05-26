# Nexus V30 — Helm Chart

## Overview
Deploys the full NEXUS platform (backend + frontend) to Kubernetes.

## Prerequisites
- Helm 3.x
- `nexus` namespace created
- Secrets pre-populated via HashiCorp Vault or `kubectl create secret`

## Quick start

```bash
# Add the chart repo (if published) or install from local path
helm install nexus ./infrastructure/helm/nexus \
  --namespace nexus-production \
  --create-namespace \
  -f infrastructure/helm/nexus/values.production.yaml \
  --set backend.image.tag=sha-abc1234 \
  --set frontend.image.tag=sha-abc1234
```

## Values reference

| Key | Default | Description |
|-----|---------|-------------|
| `backend.image.repository` | `ghcr.io/your-org/nexus/backend` | Backend image |
| `backend.image.tag`        | `latest` | Image tag |
| `backend.replicaCount`     | `2` | Backend replicas |
| `frontend.image.repository`| `ghcr.io/your-org/nexus/frontend` | Frontend image |
| `frontend.replicaCount`    | `2` | Frontend replicas |
| `ingress.host`             | `app.nexus.io` | Ingress hostname |
| `ingress.tlsSecret`        | `nexus-tls` | TLS secret name |

## Upgrading

```bash
helm upgrade nexus ./infrastructure/helm/nexus \
  --namespace nexus-production \
  -f infrastructure/helm/nexus/values.production.yaml \
  --set backend.image.tag=sha-newversion
```

## Rollback

```bash
helm rollback nexus 1 --namespace nexus-production
```

## Required secrets
Create before installing:
```bash
kubectl create secret generic nexus-secrets \
  --namespace nexus-production \
  --from-literal=JWT_SECRET=$(openssl rand -base64 32) \
  --from-literal=ENCRYPTION_KEY=$(openssl rand -base64 32) \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=REDIS_URL="redis://..."
```

## Notes
- The Helm chart references `values.production.yaml` for production-tuned resource limits.
- HPA is enabled by default (min 2, max 10 replicas for backend).
- PodDisruptionBudget ensures at least 1 replica available during rolling updates.
