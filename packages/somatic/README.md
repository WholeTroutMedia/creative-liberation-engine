# @cle/somatic

**The Consciousness Architecture** — three-tier pipeline for sovereign real-time MetaHuman performance.

```text
PerformanceBrief | BiometricBrief
  → OmnimediaDirector (Tier 1)  ← TTS + Audio2Face REST
  → SomaticBridge (Tier 2)      ← OSC/UDP → UE5 MetaHuman
  ← PerformanceMonitor (Tier 3) ← rolling telemetry + KEEPER memory
```

## Architecture

| Tier | Class | Role |
|------|-------|------|
| 1 | `OmnimediaDirector` | Genesis Compiler — text/biometric → TTS → Audio2Face → blendshapes |
| 2 | `SomaticBridge` | Protocol bridge — ARKit HTTP ingestion → OSC UDP → UE5 |
| 3 | `PerformanceMonitor` | Telemetry — frame-level latency, p50/p95/p99, KEEPER flush |

**Entry point:** `ConsciousnessLoop` wires all three tiers together.

## Quick Start

```typescript
import { ConsciousnessLoop } from '@cle/somatic';

const loop = new ConsciousnessLoop({
  director: { elevenLabsKey: process.env.ELEVEN_KEY },
});

await loop.start();

// Manual performance
await loop.perform({ text: 'Hello world', voiceId: 'default' });

// Get status
console.log(loop.getStatus());

// Shutdown (flushes stats to KEEPER memory)
await loop.stop();
```

## Biometric Integration

Wire `@cle/sensor-mesh` BiometricBridge → ConsciousnessLoop:

```typescript
import { ConsciousnessLoop } from '@cle/somatic';
import { BiometricBridge } from '@cle/sensor-mesh';

const loop = new ConsciousnessLoop();
const biometrics = new BiometricBridge({ emitIntervalMs: 2000 });

await loop.start();
await biometrics.start();

// Body state drives MetaHuman performance
biometrics.on('brief', (brief) => loop.receiveBiometricBrief(brief));
```

## Python OSC Bridge

The Python sidecar bridges Audio2Face NIM blendshape output to UE5 via OSC UDP.
Required when running UE5 as a headless packaged binary (`-NoUI -RenderOffScreen`).

```bash
pip install python-osc requests
python scripts/a2f_osc_bridge.py --fps 60 --ue5-port 5005
```

**UE5 Setup:**

1. Enable OSC Plugin (Plugins → OSC)
2. Add OSC Server on port 5005
3. Blueprint: `OscServer.Bind("/somatic/arkit")` → `SetMorphTarget(...)`

## Endpoints

### SomaticBridge HTTP (:6060)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ingest` | Receive Audio2Face ARKit payload |
| GET | `/stats` | Frame statistics + FPS |
| GET | `/health` | Uptime check |

## Latency Budget

Target: **sub-200ms end-to-end**

| Stage | Target |
|-------|--------|
| Kokoro TTS | < 100ms |
| Audio2Face NIM | 10–30ms |
| OSC UDP | < 2ms |
| **Total** | **< 132ms** ✅ |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GENKIT_URL` | `http://localhost:4100` | KEEPER memory endpoint |
| `ELEVEN_KEY` | — | ElevenLabs API key (falls back to Kokoro if absent) |
| `NIM_NGC_API_KEY` | — | NVIDIA NGC API key for Audio2Face NIM pull |
| `A2F_MODEL_NAME` | `james` | MetaHuman preset (james, claire, miguel…) |
| `A2F_EMOTION_STRENGTH` | `1.0` | Emotion scale 0.0–2.0 |
| `UE5_OSC_HOST` | `host.docker.internal` | UE5 host for OSC delivery |
| `UE5_OSC_PORT` | `5005` | UE5 OSC listener port |

## Docker Compose — Omnimedia Profile

The full Omnimedia pipeline runs as a Docker Compose profile (`omnimedia`) alongside the genesis stack.

### Prerequisites

1. **NVIDIA GPU** with CUDA 12.x and [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installed
2. **NGC account + API key** → [catalog.ngc.nvidia.com](https://catalog.ngc.nvidia.com/orgs/nim/teams/nvidia/containers/audio2face-3d)
3. Set `NIM_NGC_API_KEY` in your `.env` file

### Docker Quick Start

```bash
# One-time model pull (~14GB):
docker login nvcr.io -u '$oauthtoken' -p "$NIM_NGC_API_KEY"
docker pull nvcr.io/nvidia/nim/audio2face-3d:latest

# Start the omnimedia stack:
docker compose -f docker-compose.genesis.yml --profile omnimedia up -d

# Tail logs:
docker compose logs -f audio2face-nim somatic-bridge a2f-osc-bridge
```

### Service Map

| Container | Role | Port |
|-----------|------|------|
| `audio2face-nim` | NVIDIA NIM — ARKit 52 blendshape inference | REST :8011 |
| `somatic-bridge` | TypeScript HTTP→OSC proxy | HTTP :6060 |
| `a2f-osc-bridge` | Python OSC broadcaster → UE5 | UDP target :5005 |

### UE5 Setup

1. Enable **OSC Plugin** in Plugins → OSC
2. Create OSC Server listening on UDP port 5005
3. In Blueprint: bind `/somatic/arkit/*` → `SetMorphTarget` on your MetaHuman
