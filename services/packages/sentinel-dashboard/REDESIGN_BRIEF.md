# Sentinel Dashboard Redesign Brief

## Source Location
NAS: `/app/creative-liberation-engine/services/packages/sentinel-dashboard/`
UNC: `\\127.0.0.1\docker\creative-liberation-engine\services\packages\sentinel-dashboard\`

## Architecture
- Static HTML+CSS+JS served by Express (server.js) on port 4200
- Files: public/index.html, public/style.css, public/app.js, server.js, Dockerfile, docker-compose.yml
- Server reads JSON manifests from /data/ideation-queue, serves API at /api/*
- Chat proxies to Genkit at 127.0.0.1:4110

## Current Structure (DO NOT re-read these files - use this summary)
### HTML: 6 views (Feed, Insights, Sources, Starred, Actions, Settings), command bar, metrics strip, detail panel, chat panel
### CSS: 206 lines, dark theme, CSS vars (--bg-0 through --bg-4, --accent:#00ff88, --blue, --warn, --danger, --purple), JetBrains Mono + Inter fonts
### JS: 416 lines, fetch API for /api/stats and /api/manifests, filter/sort/search, detail panel open/close, chat with ATHENA, keyboard shortcuts (Cmd+K search, Cmd+J chat, Esc close)
### Server: Node http, reads JSON files from queue dir, /api/stats, /api/manifests, /api/manifest/:id, /api/action (POST), /api/chat (POST proxy to Genkit), /api/health, static file serving

## Redesign Requirements
1. Animated mesh gradient background (multi-layered, slow-moving CSS animation)
2. Glassmorphism panels (backdrop-filter: blur, semi-transparent backgrounds, luminous borders)
3. Ambient glow effects on interactive elements (box-shadow with accent color spread)
4. Kinetic micro-animations (hover transforms, staggered list entry, smooth panel transitions)
5. Premium 2027 aesthetic - NOT flat, NOT basic
6. Keep ALL existing functionality intact (views, filters, detail panel, chat, keyboard shortcuts)
7. Server.js stays unchanged - only touch public/ files

## Deploy Process
1. Write files locally to the sentinel-dashboard dir
2. SCP to NAS: `scp -P 2000 file jaharoni@127.0.0.1:/app/creative-liberation-engine/services/packages/sentinel-dashboard/public/`
3. Rebuild container: `ssh -p 2000 jaharoni@127.0.0.1 "cd /app/creative-liberation-engine/services/packages/sentinel-dashboard && sudo docker compose up -d --build"`
