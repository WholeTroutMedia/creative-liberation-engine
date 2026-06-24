---
description: Deploy any WholeTroutMedia service to NAS Docker (the default for all personal services)
---

# NAS Deploy Workflow

// turbo-all

> **RULE**: ALL WholeTroutMedia personal services deploy to NAS Docker FIRST.
> Local dev only. NAS = production for all Creative Liberation Engine services.
> No exceptions without explicit user override.

## NAS Endpoints
- **NAS IP**: `127.0.0.1`
- **SSH**: `ssh jaharoni@127.0.0.1`
- **Portainer**: `http://127.0.0.1:9000`
- **Docker Compose path**: `/volume1/docker/genesis/`
- **Console**: `http://127.0.0.1:5173` (or `http://127.0.0.1:3100`)

## Trigger
Activated by:
- `/deploy <service-name>` â€” deploy specific service
- `/deploy-all` â€” redeploy full GENESIS stack
- Creating any new service (auto-remind user to deploy to NAS)

## Pre-Deploy Checklist

Before deploying any service, verify:
1. Service has a `healthcheck` in docker-compose.genesis.yml
2. Service environment variables are set in `.env` on NAS
3. Service is accessible via gateway (nginx route added if needed)

## Step-by-Step: Deploy a Service to NAS

### Step 1: Build & Push Image (from local machine)

```powershell
# From creative-liberation-engine-v5 root
$SERVICE = "<service-name>"  # e.g., "finance-agent", "shadow-qa"
$NAS_HOST = "127.0.0.1"

# Build
docker build -t "cle/$SERVICE`:latest" "./packages/$SERVICE" 2>&1

# Or via docker-compose
docker-compose -f docker-compose.genesis.yml build $SERVICE 2>&1
```

### Step 2: Push Image to NAS Registry

// turbo
```powershell
# Tag for NAS local registry (if using private registry on NAS)
docker tag "cle/$SERVICE`:latest" "127.0.0.1:5000/$SERVICE`:latest"
docker push "127.0.0.1:5000/$SERVICE`:latest" 2>&1

# OR: if deploying via docker-compose directly on NAS (recommended)
# SCP the built image tar to NAS
docker save "cle/$SERVICE`:latest" | ssh jaharoni@$NAS_HOST "docker load" 2>&1
```

### Step 3: Deploy on NAS via SSH

// turbo
```powershell
ssh jaharoni@$NAS_HOST @"
  cd /volume1/docker/genesis
  docker-compose -f docker-compose.genesis.yml up -d --no-deps --build $SERVICE
  docker-compose -f docker-compose.genesis.yml ps $SERVICE
"@
```

### Step 4: Verify Health

// turbo
```powershell
# Check service health from local machine
$PORT = 4500  # Set to the service's port
Invoke-WebRequest -Uri "http://127.0.0.1:$PORT/health" -Method GET | Select-Object -ExpandProperty Content
```

### Step 5: Confirm in Console

Open the Console workstation at http://127.0.0.1:5173 and verify:
- Service appears in the Service Monitor panel
- Health indicator is green
- The agent/service is reachable from the agent roster

## Quick Deploy (Gitea CI â€” preferred method)

Push to `main` branch â†’ Forgejo CI/CD pipeline automatically:
1. Builds new image on NAS runner
2. Stops old container
3. Starts new container
4. Reports health status

```powershell
# Trigger CI deploy
git push origin main
# Then watch: http://127.0.0.1:3000/WholeTroutMedia/creative-liberation-engine-v5/actions
```

## Finance Agent Specific Deploy

```powershell
# âš  Always confirm liveTrading=false BEFORE NAS deploy
ssh jaharoni@127.0.0.1 @"
  cd /volume1/docker/genesis
  docker-compose -f docker-compose.genesis.yml up -d --no-deps finance-agent shadow-qa
  docker logs cle-finance-agent --tail 20
"@
```

## New Service Checklist

When creating a new personal service, ALWAYS:
- [ ] Add to `docker-compose.genesis.yml` with a `healthcheck`
- [ ] Add gateway route in nginx config
- [ ] Add to Console service monitor list
- [ ] Deploy to NAS via this workflow
- [ ] Verify accessible at `http://127.0.0.1:<port>/health`
