#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CLE ENGINE — Cloud Run Egress Hardening Bootstrap
# T-STEALTH-002: Static egress IP + VPC Connector + Cloud NAT
#
# What this does:
#   1. Reserves a static external IP for all Cloud Run outbound traffic
#   2. Creates a VPC Connector to route Cloud Run through your VPC
#   3. Creates a Cloud NAT gateway pinned to the static IP
#   4. Updates all Cloud Run services to use VPC-only egress routing
#
# After this runs:
#   - ALL outbound requests from Cloud Run (incl. COMET C2) exit via ONE static IP
#   - Your GCP project ID never leaks in DNS reverse lookups
#   - You can whitelist this IP at any external service
#
# Usage: bash vpc-egress-bootstrap.sh [PROJECT_ID] [REGION]
# Example: bash vpc-egress-bootstrap.sh cle-engine-prod us-central1
#
# Idempotent — safe to run multiple times.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_ID="${1:-${GOOGLE_CLOUD_PROJECT:-cle-engine}}"
REGION="${2:-us-central1}"

# Resource names (change to match your naming convention if needed)
STATIC_IP_NAME="cle-egress-static-ip"
VPC_CONNECTOR_NAME="cle-vpc-connector"
VPC_NETWORK="default"
CONNECTOR_RANGE="10.8.0.0/28"   # /28 = 14 usable IPs, enough for connector
NAT_ROUTER_NAME="cle-nat-router"
NAT_CONFIG_NAME="cle-nat-config"

echo "═══════════════════════════════════════════"
echo "  CLE ENGINE — Egress Hardening"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "═══════════════════════════════════════════"

# ── Step 1: Enable required APIs ─────────────────────────────────────────────
echo ""
echo "▶ Step 1/5 — Enabling GCP APIs..."
gcloud services enable \
  vpcaccess.googleapis.com \
  compute.googleapis.com \
  run.googleapis.com \
  --project="$PROJECT_ID" \
  --quiet

# ── Step 2: Reserve static external IP ───────────────────────────────────────
echo ""
echo "▶ Step 2/5 — Reserving static egress IP..."
if gcloud compute addresses describe "$STATIC_IP_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" &>/dev/null; then
  echo "  ✓ Static IP already exists — skipping"
else
  gcloud compute addresses create "$STATIC_IP_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --network-tier=PREMIUM \
    --description="Creative Liberation Engine Cloud Run static egress IP"
  echo "  ✓ Created static IP: $STATIC_IP_NAME"
fi

STATIC_IP=$(gcloud compute addresses describe "$STATIC_IP_NAME" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format="get(address)")
echo "  → Static IP: $STATIC_IP"

# ── Step 3: Create VPC Serverless Connector ───────────────────────────────────
echo ""
echo "▶ Step 3/5 — Creating VPC Connector..."
if gcloud compute networks vpc-access connectors describe "$VPC_CONNECTOR_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" &>/dev/null; then
  echo "  ✓ VPC Connector already exists — skipping"
else
  gcloud compute networks vpc-access connectors create "$VPC_CONNECTOR_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --network="$VPC_NETWORK" \
    --range="$CONNECTOR_RANGE" \
    --min-instances=2 \
    --max-instances=3 \
    --machine-type=e2-micro
  echo "  ✓ Created VPC Connector: $VPC_CONNECTOR_NAME"
fi

# ── Step 4: Create Cloud NAT router + config ──────────────────────────────────
echo ""
echo "▶ Step 4/5 — Creating Cloud NAT (pinned to static IP)..."

# Create router if it doesn't exist
if ! gcloud compute routers describe "$NAT_ROUTER_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" &>/dev/null; then
  gcloud compute routers create "$NAT_ROUTER_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --network="$VPC_NETWORK" \
    --description="Creative Liberation Engine NAT router for static egress"
  echo "  ✓ Created NAT router: $NAT_ROUTER_NAME"
else
  echo "  ✓ NAT router already exists — skipping"
fi

# Create NAT config pinned to static IP
if gcloud compute routers nats describe "$NAT_CONFIG_NAME" \
    --router="$NAT_ROUTER_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" &>/dev/null; then
  echo "  ✓ NAT config already exists — skipping"
else
  gcloud compute routers nats create "$NAT_CONFIG_NAME" \
    --router="$NAT_ROUTER_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --nat-external-ip-pool="$STATIC_IP_NAME" \
    --nat-all-subnet-ip-ranges \
    --enable-logging
  echo "  ✓ Created Cloud NAT config (pinned to $STATIC_IP)"
fi

# ── Step 5: Update Cloud Run services to use VPC-all-traffic egress ───────────
echo ""
echo "▶ Step 5/5 — Routing Cloud Run services through VPC..."
SERVICES=$(gcloud run services list \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format="get(metadata.name)" 2>/dev/null || echo "")

if [ -z "$SERVICES" ]; then
  echo "  ℹ No Cloud Run services found — they will use VPC egress automatically on next deploy"
else
  for SERVICE in $SERVICES; do
    echo "  → Updating $SERVICE..."
    gcloud run services update "$SERVICE" \
      --region="$REGION" \
      --project="$PROJECT_ID" \
      --vpc-connector="$VPC_CONNECTOR_NAME" \
      --vpc-egress=all-traffic \
      --quiet
    echo "    ✓ $SERVICE → VPC egress active"
  done
fi

# ── Complete ──────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ T-STEALTH-002 COMPLETE"
echo ""
echo "  Static Egress IP : $STATIC_IP"
echo "  VPC Connector    : $VPC_CONNECTOR_NAME"
echo "  NAT Router       : $NAT_ROUTER_NAME"
echo ""
echo "  All outbound Cloud Run requests now exit via:"
echo "  $STATIC_IP"
echo ""
echo "  Next steps:"
echo "  1. Add $STATIC_IP to any external service allowlists"
echo "  2. Add COMET_C2_EGRESS_IP=$STATIC_IP to .env"
echo "  3. Run /deploy to apply VPC connector to new services"
echo "═══════════════════════════════════════════"
