# LEONARDO Zero-Day Integration

## Immediate Use (No Setup)

### 1. Pattern Match
```bash
# Find ATELIER pattern for use case
leonardo match-pattern "user login form"
# Returns: ATELIER pattern with code
```

### 2. Visual Validation
```bash
# Check design against system
leonardo validate
# Returns: Consistency report
```

### 3. Component Suggestion
```bash
# Get component recommendation
leonardo suggest "data table with filters"
# Returns: ATELIER components to use
```

## Integration Hooks

### Pre-Commit Design Check
```yaml
# .git/hooks/pre-commit
leonardo validate-changes
```

### CI/CD Visual Testing
```yaml
# GitHub Actions
- name: Visual Consistency
  run: leonardo check-system-compliance
```

### Figma Integration
```javascript
// Figma plugin
leonardo.syncFromFigma(fileId);
```

## No Config Needed
LEONARDO validates against ATELIER automatically.
