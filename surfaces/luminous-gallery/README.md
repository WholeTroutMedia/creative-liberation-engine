# Luminous Gallery — Sovereign Infrastructure Config

The Luminous Gallery is a sovereign visual commerce surface integrated with physical museum-grade prints, automated high-throughput Stripe payment settlement, and physical cryptographic NFC tag validation.

This directory contains the core deployment layers and database schemas for the surface.

---

## System Architecture

```mermaid
graph TD
    Client[Client Browser / Mobile NFC Tap] -->|HTTPS| Caddy[Caddy Reverse Proxy]
    
    Caddy -->|Static Assets| Web[luminous-gallery-surface]
    Caddy -->|/api/*| API[luminous-gallery-api]
    
    API -->|Payments| Stripe[Stripe API Engine]
    API -->|Order Logs & NFC Proofs| DB[(PostgreSQL Database)]
    
    DB -->|Trigger logs| Audit[Order Audit Trail]
```

---

## 1. Directory Structure

- `route-manifest.json`: Sovereign V6 API Routing contract specifying path parameters, upstream mapping, auth models, and rate limits.
- `schema.sql`: PostgreSQL orders and NFC verification state registry.
- `index.html`: Main visual surface storefront.
- `index.css`: High-fidelity structural styles.
- `README.md`: System integration guide.

---

## 2. Docker Compose Infrastructure Configuration

To deploy the sovereign Luminous Gallery stack within the Creative Liberation Engine mesh network, include this fragment in your docker compose configuration:

```yaml
version: "3.9"

networks:
  cle-mesh:
    external: true

volumes:
  luminous-gallery-db-data:
    driver: local
  caddy-data:
  caddy-config:

services:
  # ─── FRONTEND SURFACE ───────────────────────────────────────────────────────
  luminous-gallery-surface:
    image: nginx:alpine
    container_name: luminous-gallery-surface
    restart: unless-stopped
    volumes:
      - ./index.html:/usr/share/nginx/html/index.html:ro
      - ./index.css:/usr/share/nginx/html/index.css:ro
    networks:
      - cle-mesh
    labels:
      - cle.service=luminous-gallery-surface
      - cle.tier=frontend

  # ─── BACKEND API GATEWAY ────────────────────────────────────────────────────
  luminous-gallery-api:
    image: node:18-alpine
    container_name: luminous-gallery-api
    restart: unless-stopped
    working_dir: /app
    volumes:
      - ./src:/app/src
      - ./package.json:/app/package.json
    environment:
      - NODE_ENV=production
      - PORT=5000
      - DATABASE_URL=postgresql://gallery_admin:${DB_PASSWORD}@luminous-gallery-db:5432/luminous_gallery
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
      - NFC_VERIFICATION_KEY=${NFC_VERIFICATION_KEY}
    networks:
      - cle-mesh
    depends_on:
      luminous-gallery-db:
        condition: service_healthy
    labels:
      - cle.service=luminous-gallery-api
      - cle.tier=backend

  # ─── POSTGRESQL STATE STORE ────────────────────────────────────────────────
  luminous-gallery-db:
    image: postgres:15-alpine
    container_name: luminous-gallery-db
    restart: unless-stopped
    environment:
      - POSTGRES_DB=luminous_gallery
      - POSTGRES_USER=gallery_admin
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - luminous-gallery-db-data:/var/lib/postgresql/data
      - ./schema.sql:/docker-entrypoint-initdb.d/schema.sql:ro
    networks:
      - cle-mesh
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gallery_admin -d luminous_gallery"]
      interval: 10s
      timeout: 5s
      retries: 5
    labels:
      - cle.service=luminous-gallery-db
      - cle.tier=database

  # ─── CADDY SSL EDGE PROXY ───────────────────────────────────────────────────
  luminous-gallery-proxy:
    image: caddy:2-alpine
    container_name: luminous-gallery-proxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    networks:
      - cle-mesh
    depends_on:
      - luminous-gallery-surface
      - luminous-gallery-api
    labels:
      - cle.service=luminous-gallery-proxy
      - cle.tier=edge-router
```

---

## 3. Caddy Proxy Configuration

Configure SSL termination, proxy routing, and security headers in `./Caddyfile`:

```caddy
luminous.gallery, luminous-gallery.local {
    # ─── FRONTEND STATIC ROUTES ───
    route /index.css {
        reverse_proxy luminous-gallery-surface:80
    }
    
    route / {
        reverse_proxy luminous-gallery-surface:80
    }

    # ─── BACKEND API INGRESS ───
    route /api/* {
        reverse_proxy luminous-gallery-api:5000
    }

    # ─── HARDENED EXCLUSIVITY HEADERS ───
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-XSS-Protection "1; mode=block"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Content-Security-Policy "default-src 'self'; script-src 'self' https://js.stripe.com; style-src 'self' 'unsafe-inline'; frame-src https://js.stripe.com; connect-src 'self' https://api.stripe.com;"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

---

## 4. Launch & Operation Commands

### Start All Services Natively
```powershell
docker compose up -d
```

### Stream Ingress Logs
```powershell
docker compose logs -f luminous-gallery-proxy
```

### Inspect PostgreSQL Shell
```powershell
docker compose exec -it luminous-gallery-db psql -U gallery_admin -d luminous_gallery
```

### Verify Cryptographic Public Key and DB Triggers
You can simulate a local order insertion to trigger the automatic status change audit trail logging:
```sql
INSERT INTO luminous_gallery.orders (
    customer_email,
    customer_name,
    print_title,
    print_dimensions,
    print_finish,
    shipping_details,
    amount_cents
) VALUES (
    'inquiries@creativeliberationengine.org',
    'Jane Doe',
    'Ethereal Threshold v6',
    '24x36',
    'acrylic_glass',
    '{"carrier": "DHL", "tracking_number": "DHL-V6-992", "address": {"line1": "12 Sovereign Rd", "city": "Genesis", "country": "US"}}',
    75000
);
```
Checking the audit trail records:
```sql
SELECT * FROM luminous_gallery.order_audit_trail;
```
