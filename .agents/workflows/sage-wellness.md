---
description: SAGE all-device mesh health and fatigue monitoring workflow
---

# /sage-wellness

Monitors the wellness of the Creative Liberation Engine multi-agent system and all connected mesh devices (workstation, NAS, and mobile).

**Activates on:**

- `/sage-wellness`
- "system health"
- "wellness check"
- "device status"

---

## Protocol

### Continuous Diagnostics

The SAGE daemon runs the following wellness sequence:

1. **Query Golden Signals**:
   - Check CPU and GPU loads across local workstation and NAS node.
   - Verify filesystem disk usage (ensure NAS `/volume2` has adequate free space).
   - Check memory consumption of active agent runtimes.

2. **Evaluate SLO Contracts**:
   - Verify network latency to the NAS dispatch server (`http://127.0.0.1:5050`).
   - If latency > 500ms or connection times out, trigger network failover.

3. **Resource Guardrail Enforcement**:
   - If any node exceeds 90% CPU/GPU or hits memory exhaustion, apply backpressure throttles.
   - Automatically kill runaway terminal processes or background tasks exceeding maximum execution time.

4. **Alerting**:
   - Surface active system degradation alerts directly to the HUD console.
