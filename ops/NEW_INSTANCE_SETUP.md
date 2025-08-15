# New instance setup (EC2 + k3s + Helm + Caddy for API)

This document shows the exact, minimal steps to bring up a new VM and deploy the API behind HTTPS. All steps are run on the VM (Ubuntu).

## Prerequisites you must have ready

- Docker Hub credentials: username + personal access token
- Supabase Postgres `DATABASE_URL` (use Direct connection, add `sslmode=require`)
- DNS A record: point your domain (e.g., `luz.mud.co.il`) to the instance public IP
- Security Group inbound: TCP 80 and 443 from 0.0.0.0/0

## 1) Install k3s (single node, minimal addons)

```bash
curl -sfL https://get.k3s.io \
  | INSTALL_K3S_EXEC="--write-kubeconfig-mode 644 --disable traefik --disable servicelb --disable metrics-server" sh -
```

Verify:

```bash
sudo k3s kubectl get nodes -o wide
sudo k3s kubectl get pods -A
```

### 2) Install Helm

```bash
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version
```

### 3) Get the repo onto the VM

```bash
git clone https://github.com/bitamar/luzz.git
cd luzz
```

### 4) Create namespace and secrets (prod)

```bash
kubectl create namespace prod || true

# Supabase DB URL (paste your full URI)
kubectl -n prod create secret generic supabase-db \
  --from-literal=DATABASE_URL="postgresql://…?sslmode=require"

# Docker Hub pull secret (replace placeholders)
kubectl -n prod create secret docker-registry dockerhub-cred \
  --docker-server=https://index.docker.io/v1/ \
  --docker-username="<your_dockerhub_username>" \
  --docker-password="<your_dockerhub_token>"
```

### 5) Deploy the API (ClusterIP service)

```bash
helm --kubeconfig /etc/rancher/k3s/k3s.yaml upgrade --install luz-api ./helm/luz-api \
  -n prod -f helm/luz-api/values-prod.yaml \
  --set fullnameOverride=luz-api \
  --set image.repository=malshinim/luzapi \
  --set image.tag=latest \
  --set service.type=ClusterIP

kubectl -n prod get deploy,po,svc
```

### 6) Deploy Caddy (HTTPS reverse proxy on host ports 80/443; API only)

```bash
helm --kubeconfig /etc/rancher/k3s/k3s.yaml upgrade --install caddy ./helm/caddy \
  -n prod --set apiNamespace=prod --set apiService=luz-api

kubectl -n prod get pods -l app=caddy
```

Notes:

- Caddy terminates TLS and proxies only the API Service. Frontend apps are deployed as static assets via CDN.
- The chart uses hostPorts 80/443 and a PVC for certs. Strategy is Recreate to avoid port conflicts.

### 7) Verify DNS and HTTPS

```bash
curl -I http://luz.mud.co.il/health
curl -I https://luz.mud.co.il/health
```

You should see HTTP redirect to HTTPS and a 200 from the HTTPS endpoint.

---

## Common operations

### Roll out a new API image (using latest)

```bash
helm --kubeconfig /etc/rancher/k3s/k3s.yaml upgrade --install luz-api ./helm/luz-api \
  -n prod -f helm/luz-api/values-prod.yaml \
  --set image.repository=malshinim/luzapi \
  --set image.tag=latest

# or simply restart to pull if pullPolicy=Always (not default)
kubectl -n prod rollout restart deployment/luz-api
```

### Backup current Helm values (for disaster recovery)

```bash
mkdir -p ~/backups
helm --kubeconfig /etc/rancher/k3s/k3s.yaml get values luz-api -n prod > ~/backups/luz-api.values.yaml
helm --kubeconfig /etc/rancher/k3s/k3s.yaml get values caddy  -n prod > ~/backups/caddy.values.yaml
```

### Troubleshooting

- Caddy Pending pod: hostPorts prevent two Caddy pods; ensure strategy is Recreate. If stuck, scale down then up:

  ```bash
  kubectl -n prod scale deploy caddy --replicas=0
  kubectl -n prod scale deploy caddy --replicas=1
  ```

- API pod ImagePullBackOff (private image): ensure `dockerhub-cred` secret exists in `prod` and `imagePullSecrets` in values.
- Health check: `curl -I https://luz.mud.co.il/health`

### Security Group summary

- Open inbound TCP 80 and 443 from 0.0.0.0/0
- NodePort 30080 not required once Caddy is up (remove for tighter exposure)
