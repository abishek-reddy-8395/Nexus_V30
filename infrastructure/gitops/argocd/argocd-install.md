# ArgoCD Setup for Nexus V30

## Prerequisites
- `kubectl` configured against your cluster
- Cluster admin privileges

## 1. Install ArgoCD
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for all pods to be ready
kubectl wait --for=condition=available deployment/argocd-server -n argocd --timeout=120s
```

## 2. Get initial admin password
```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d && echo
```

## 3. Expose the ArgoCD UI (local port-forward for setup)
```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Access: https://localhost:8080  (username: admin)
```

## 4. Connect the NEXUS repository
```bash
# Via SSH key (recommended for production)
argocd repo add git@github.com:your-org/nexus.git \
  --ssh-private-key-path ~/.ssh/argocd_deploy_key

# Or via HTTPS with token
argocd repo add https://github.com/your-org/nexus \
  --username git \
  --password <GITHUB_PAT>
```

## 5. Apply NEXUS ArgoCD manifests
```bash
# Create the ArgoCD project
kubectl apply -f infrastructure/gitops/argocd/project.yaml

# Deploy staging
kubectl apply -f infrastructure/gitops/argocd/app-staging.yaml

# Deploy production (after staging is validated)
kubectl apply -f infrastructure/gitops/argocd/app-production.yaml
```

## 6. Sync applications
```bash
argocd app sync nexus-staging
argocd app sync nexus-production
```

## 7. Change admin password
```bash
argocd account update-password
```

## Namespaces
| App               | Namespace        |
|-------------------|------------------|
| nexus-staging     | nexus-staging    |
| nexus-production  | nexus-production |
| argocd itself     | argocd           |

## Troubleshooting
```bash
# Check app sync status
argocd app get nexus-staging

# View resource diff
argocd app diff nexus-staging

# Manual rollback
argocd app rollback nexus-production <revision>
```
