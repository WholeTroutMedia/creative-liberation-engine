# SCRIBE Zero-Day Integration

## Immediate Use (No Setup)

### 1. Capture Session
```bash
scribe capture-session
# Auto-generates session log in Markdown
```

### 2. End Session
```bash
scribe end-session
# Saves log with summary
```

### 3. Extract Patterns
```bash
scribe extract-patterns
# Analyzes logs for recurring themes
```

## Integration Hooks

### Auto-Session-End
```typescript
// Automatically saves on window close
window.addEventListener('beforeunload', () => {
  scribe.endSession();
});
```

### Git Commit Hook
```yaml
# .git/hooks/post-commit
scribe log-commit
```

### CI/CD Documentation
```yaml
# GitHub Actions
- name: Generate Docs
  run: scribe generate-docs
```

## No Config Needed
SCRIBE starts logging automatically.
