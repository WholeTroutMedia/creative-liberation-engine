# Creative Liberation Engine V6 NAS Deploy

This deployment keeps V6 isolated on dedicated NAS data paths and tuned for high model throughput.

## Volume Layout (NAS)

- `/volume2/cle-engine/v6/postgres`
- `/volume2/cle-engine/v6/redis`
- `/volume2/cle-engine/v6/chromadb`
- `/volume2/cle-engine/v6/dispatch`

These paths prevent collision with existing V5 runtime state.

## Throughput and Model Utilization

- Worker parallelism: `WORKER_CONCURRENCY=4` (raise if NAS headroom is available)
- Worker poll cadence: `WORKER_POLL_MS=2500`
- Router targets:
  - `OLLAMA_URL=http://ollama:11434`
  - `TRITON_HTTP_URL=http://triton-server:8000`
  - `VLLM_OPENAI_URL=http://vllm:8000`

## Launch Steps (on NAS shell)

1. `cd /app/genesis-deploy/deployments/v6`
2. `cp .env.v6.nas.example .env.v6.nas` and set secrets.
3. `mkdir -p /volume2/cle-engine/v6/{postgres,redis,chromadb,dispatch}`
4. `cd /app/genesis-deploy`
5. `/usr/local/bin/docker compose -f deployments/v6/docker-compose.v6.nas.yml --env-file deployments/v6/.env.v6.nas up -d --build`

## Health Checks

- Genkit: `curl -sf http://127.0.0.1:4110/health`
- Dispatch: `curl -sf http://127.0.0.1:5160/health`

## Notes

- Synology PATH may not include docker for non-interactive SSH sessions.
- Use `/usr/local/bin/docker` explicitly when scripting remote commands.
