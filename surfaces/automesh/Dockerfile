# ═══════════════════════════════════════════════════════════════
# Sovereign AutoMesh — Dockerfile (Multi-stage Build)
# Stage 1: Build the Vite frontend
# Stage 2: Run Python/FastAPI backend serving built frontend
# ═══════════════════════════════════════════════════════════════

# --- Stage 1: Frontend Build ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY index.html vite.config.js ./
COPY public/ ./public/

COPY src/ ./src/
RUN npm run build

# --- Stage 2: Python Backend ---
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install python requirements
COPY api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy built frontend assets
COPY --from=frontend-builder /app/dist ./dist

# Copy python server files
COPY api/ ./api/

# Environment configurations (mapped to NAS locations)
ENV DB_PATH=/app/runtime/db/ledger.db
ENV STATE_FILE=/app/runtime/session/venza-state.json
ENV PORT=5070

EXPOSE 5070

# Launch server with Uvicorn
CMD ["uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "5070"]
