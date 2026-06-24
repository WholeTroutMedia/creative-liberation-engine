# TDD-ENFORCERS Zero-Day Integration

## Immediate Use

### Pre-Commit Hook
```yaml
# .git/hooks/pre-commit
tdd-enforcers validate
```

### CI/CD Gate
```yaml
# GitHub Actions
- name: TDD Enforcement
  run: tdd-enforcers block-if-low-coverage
```

No config needed.
