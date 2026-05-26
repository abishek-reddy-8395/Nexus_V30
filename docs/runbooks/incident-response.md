# NEXUS — Incident Response Runbook

## Severity Levels

| Level | Definition | Response time | Examples |
|---|---|---|---|
| P0 | Total outage | 15 min | API down, DB unresponsive, all users affected |
| P1 | Major degradation | 30 min | Engine errors >5%, WS disconnected, auth failing |
| P2 | Partial degradation | 2 hours | AI unavailable, scanner slow, one market data source down |
| P3 | Minor issue | Next business day | UI glitch, non-critical feature down |

## P0 Response Checklist

```bash
# 1. Check pod status
kubectl get pods -n nexus
kubectl describe pod <failing-pod> -n nexus

# 2. Check recent logs
kubectl logs deployment/nexus-v30-backend -n nexus --since=5m
kubectl logs deployment/nexus-web -n nexus --since=5m

# 3. Check health endpoints
curl https://api.nexus.app/health
curl https://api.nexus.app/readiness

# 4. Check database
kubectl exec -it <postgres-pod> -n nexus-data -- psql -U nexus -c "SELECT count(*) FROM pg_stat_activity;"

# 5. Check Redis
kubectl exec -it redis-0 -n nexus-data -- redis-cli info replication

# 6. Emergency rollback (if recent deploy)
# Go to GitHub → Actions → Emergency Rollback workflow → Run workflow
```

## Common Failure Modes

### Backend CrashLoopBackOff
```bash
kubectl logs deployment/nexus-v30-backend -n nexus --previous
# Usually: missing env var, DB connection refused, or OOM
```

### DB connection exhausted
```bash
kubectl exec -it <postgres-pod> -- psql -U nexus -c \
  "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
# Fix: restart backend to reset connection pool
kubectl rollout restart deployment/nexus-v30-backend -n nexus
```

### Redis OOM
```bash
# Check memory usage
kubectl exec -it redis-0 -n nexus-data -- redis-cli info memory
# Flush cache only (not blacklist keys)
kubectl exec -it redis-0 -n nexus-data -- redis-cli --scan --pattern 'price:*' | xargs redis-cli del
```

### Kafka consumer lag
```bash
# Check consumer group lag
kubectl exec -it kafka-0 -n nexus-data -- kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe --group nexus-signal-ws-bridge
```

## Post-Incident Template

```markdown
## Incident: [DATE] — [TITLE]

**Severity:** P[0/1/2/3]
**Duration:** [START] → [END] ([X] minutes)
**Impact:** [Users affected / features down]

### Timeline
- HH:MM — Alert fired / issue noticed
- HH:MM — On-call engineer paged
- HH:MM — Root cause identified
- HH:MM — Fix deployed
- HH:MM — Incident resolved

### Root Cause
[Technical explanation]

### Contributing Factors
- [Factor 1]

### Resolution
[What was done to fix it]

### Action Items
- [ ] [Preventive measure] — Owner: [name] — Due: [date]
```
