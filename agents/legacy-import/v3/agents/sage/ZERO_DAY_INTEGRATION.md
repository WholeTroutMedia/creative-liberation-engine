# SAGE Zero-Day Integration

## Immediate Use (No Setup)

### 1. Wellness Check
```bash
# Check current energy levels
sage wellness-check

# Monitor session duration
sage session-monitor
```

### 2. Temperature Reading
```bash
# Get current system temperature
sage temp-check
# Returns: 清 (clear) | 熱 (hot) | 冷 (cold) | 乱 (chaos)
```

### 3. Burnout Prevention
```bash
# Flag if approaching burnout
sage burnout-scan
```

## Integration Hooks

### Session Monitoring
```typescript
// Auto-warns after 3 hours
setInterval(() => {
  if (sessionDuration > 180) {
    sage.warnBreakNeeded();
  }
}, 60000); // Check every minute
```

### Decision Fatigue Detection
```typescript
// Tracks decision velocity
if (decisionsInLast30Min > 5) {
  sage.flagDecisionFatigue();
}
```

### Energy Monitoring
```yaml
# GitHub Actions - wellness check before deploy
- name: SAGE Wellness Gate
  run: sage validate-team-energy
```

## No Config Needed
SAGE monitors passively, intervenes when needed.
