# NEXUS — OPA Gatekeeper Policies

Runtime admission control. Every Deployment, StatefulSet, and DaemonSet in
`nexus` and `nexus-staging` namespaces is validated against these policies
**before** being accepted by the API server.

## Install Gatekeeper

```bash
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm install gatekeeper gatekeeper/gatekeeper \
  --namespace gatekeeper-system \
  --create-namespace \
  --set auditInterval=30 \
  --set logLevel=WARNING
```

## Apply policies

```bash
# Apply templates first (defines the CRDs)
kubectl apply -f infrastructure/policy/gatekeeper/templates/

# Then apply constraints (activates enforcement)
kubectl apply -f infrastructure/policy/gatekeeper/constraints/
```

## Policies enforced

| Policy | Action | What it blocks |
|---|---|---|
| `require-resource-limits` | deny | Containers without CPU/memory limits |
| `deny-privileged` | deny | Privileged containers, privilege escalation, writable root fs |
| `allowed-registries` | deny | Images from untrusted registries |
| `require-non-root` | deny | Containers running as root |

## Dry-run mode

To audit without blocking: change `enforcementAction: deny` → `dryrun` in any constraint file.
Violations are recorded in the constraint's `.status.violations` field.
