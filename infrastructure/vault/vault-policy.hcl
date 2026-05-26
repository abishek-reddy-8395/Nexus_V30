# NEXUS — HashiCorp Vault Policy
# Applied to the nexus-v30-backend Kubernetes service account via Vault K8s auth.
#
# Setup:
#   vault auth enable kubernetes
#   vault write auth/kubernetes/config \
#     kubernetes_host="https://$KUBERNETES_PORT_443_TCP_ADDR:443" \
#     token_reviewer_jwt="$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
#     kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
#
#   vault write auth/kubernetes/role/nexus-v30-backend \
#     bound_service_account_names=nexus-v30-backend \
#     bound_service_account_namespaces=nexus \
#     policies=nexus-v30-backend \
#     ttl=1h

# Read production secrets
path "secret/data/nexus/production/*" {
  capabilities = ["read", "list"]
}

# Read shared config
path "secret/data/nexus/config/*" {
  capabilities = ["read"]
}

# Deny write access — backend never writes secrets
path "secret/data/nexus/*" {
  capabilities = ["deny"]
  allowed_parameters = {}
}

# Allow token self-renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}
