#!/usr/bin/env bash
# NEXUS — JWT Secret Rotation Script
# Run monthly (or after any suspected compromise).
# Safe: new secret written to Vault, ExternalSecret picks it up in <15min,
# pods get new secret via projected volume without restart.
# Old tokens expire naturally (7d TTL) — no forced logout.

set -euo pipefail

VAULT_ADDR="${VAULT_ADDR:-https://vault.nexus-internal.svc:8200}"
SECRET_PATH="nexus/production"

echo "Rotating JWT_SECRET..."
NEW_SECRET=$(openssl rand -base64 48)
vault kv patch "$SECRET_PATH" jwt_secret="$NEW_SECRET"
echo "✓ JWT_SECRET rotated. ExternalSecret will sync within 15 minutes."

echo ""
echo "Rotating ENCRYPTION_KEY..."
NEW_ENC=$(openssl rand -base64 32)
vault kv patch "$SECRET_PATH" encryption_key="$NEW_ENC"
echo "✓ ENCRYPTION_KEY rotated."

echo ""
echo "Next steps:"
echo "  1. Monitor ESO sync: kubectl get externalsecret -n nexus"
echo "  2. Verify pods pick up new secret: kubectl rollout restart deployment/nexus-v30-backend -n nexus"
echo "  3. Monitor error rate in Grafana for 30 minutes post-rotation"
echo "  4. Record rotation in audit log"
