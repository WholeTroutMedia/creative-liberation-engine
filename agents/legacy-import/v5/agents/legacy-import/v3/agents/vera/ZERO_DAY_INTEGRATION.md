# VERA Zero-Day Integration

## Immediate Use (No Setup)

### 1. Session Documentation
```bash
# Auto-capture session for SCRIBE
vera capture-session
```

### 2. Quick Validation
```bash
# Validate current work against constitution
vera validate
```

### 3. Source Check
```bash
# Verify all sources are cited
vera check-sources
```

## Integration Hooks

### Git Pre-Commit
```yaml
# .git/hooks/pre-commit
vera validate --strict
```

### Session End Trigger
```typescript
// Automatically documents session when closing
window.addEventListener('beforeunload', () => {
  vera.endSession();
});
```

### Quality Gate
```yaml
# CI/CD pipeline
- name: Constitutional Validation
  run: vera validate --report
```

## No Config Needed
VERA works immediately with sensible defaults.
