---
description: Execute VALIDATE mode — independent quality assurance, accessibility audit, and launch readiness check
---

# VALIDATE Mode Workflow

// turbo-all

**Source of Truth:** `creative-liberation-engine-v4/MODES/04_VALIDATE/`
**Agent Focus:** VERA (truth/verification) + COMPASS (constitutional check)
**Input Required:** Completed SHIP implementation
**Output:** Quality report + launch readiness assessment

## Steps

### 1. Run Full Test Suite

```bash
npx vitest run --coverage
npx playwright test
npx tsc --noEmit
```

Report: pass/fail count, coverage percentage, any flaky tests.

### 2. Coverage Gate

Check against `.creative-liberation-engine/config.yml` minimum:

- Service layer: ≥80%
- tRPC routers: ≥80%
- React components: ≥60%

If below threshold, flag specific files needing additional tests.

### 3. Build Validation

```bash
npm run build
```

Must complete with zero errors and zero warnings.

### 4. CSS Lint Gate

```bash
grep -rn "style={{" frontend/src/ --include="*.tsx" | grep -v "width:" | grep -v "height:" | wc -l
```

Result must be 0 (except dynamic progress bar widths).
All styling must use `nx-*` CSS classes from the design system.

### 5. Accessibility Audit (WCAG 2.1 AA)

#### Color Contrast (5 checks)

- [ ] All text meets 4.5:1 contrast ratio against background
- [ ] Large text (18px+ or 14px+ bold) meets 3:1 ratio
- [ ] Interactive elements have visible focus indicators
- [ ] Status indicators don't rely solely on color (use icons/text too)
- [ ] Themes all independently pass contrast requirements

#### Touch Targets & Navigation (5 checks)

- [ ] All interactive elements ≥48×48px on mobile
- [ ] Tab order follows logical reading order
- [ ] All functionality accessible via keyboard (no mouse trap)
- [ ] Visible keyboard focus indicator on ALL interactive elements (no `outline: none;` without custom fallback)
- [ ] Skip navigation link present
- [ ] Focus management strictly controlled on route changes

#### Semantic HTML (5 checks)

- [ ] Single `<h1>` per page with proper heading hierarchy
- [ ] `<nav>`, `<main>`, `<section>`, `<article>` used appropriately
- [ ] ARIA labels on all interactive elements without visible text
- [ ] Form inputs have associated `<label>` elements
- [ ] Images have alt text (or are marked decorative)

#### Responsive Design (3 checks)

- [ ] All pages functional at 320px width
- [ ] No horizontal scroll at any breakpoint
- [ ] Content readable at 200% zoom

### 6. Design System Compliance

#### Token Consistency (4 checks)

- [ ] All colors reference CSS custom properties (no hardcoded hex in TSX)
- [ ] All font sizes use `nx-ts-*` classes (no arbitrary px values)
- [ ] All spacing uses `nx-*` utility classes
- [ ] Theme switching works across all pages without visual breakage

#### Component Library Verification (3 checks)

- [ ] All components use `nx-*` BEM classes
- [ ] No Tailwind color classes that bypass the theme system
- [ ] Design system CSS file contains all referenced classes

### 7. CLE Templates Compliance Audit

Run through `apps/cle-templates/FUTURE_PROOF_CHECKLIST.md`:

#### Architecture (5 checks)

- [ ] Modular architecture (services decoupled)
- [ ] API-first design (frontend/backend independent)
- [ ] Event-driven where appropriate
- [ ] Stateless services
- [ ] Idempotent operations

#### Security (5 checks)

- [ ] No secrets in code (grep for API keys, passwords)
- [ ] CORS configured properly
- [ ] Rate limiting on API endpoints
- [ ] Input validation on all mutations
- [ ] XSS/CSRF protection headers

#### Performance (5 checks)

- [ ] Code splitting implemented
- [ ] Images optimized
- [ ] CDN for static assets
- [ ] Database indexes on query columns
- [ ] Core Web Vitals targets met

#### Developer Experience (3 checks)

- [ ] TypeScript strict mode
- [ ] Pre-commit hooks (lint + format)
- [ ] One-command setup works

### 8. DAST & Fuzzing Security Audit (Zero-Day Resilience)

Before marking validation complete, verify runtime security against the Masterclass threat models:

- [ ] **DAST Sweep**: Run an automated Dynamic Application Security Testing pass (if configured).
- [ ] **Fuzzing Resistance**: Inputs validation handles massive arbitrary payloads or malformed JSON without crashing the serverless instance.
- [ ] **Auth Escalation**: Attempt to bypass RBAC/ABAC role checks via URL manipulation or token spoofing.
- [ ] **Zero-Trust**: Verify that internal functions do not implicitly trust other internal functions without asserting claims.

### 9. Launch Checklist (from TEMPLATE_GUIDE.md)

- [ ] HTTPS + SSL certificate
- [ ] Health check endpoint responds
- [ ] Error monitoring configured
- [ ] Automated backups enabled
- [ ] Privacy policy page exists

### 9. Constitutional Compliance (COMPASS)

- Article 0: Original synthesis (not a copy)
- Article V: User sovereignty maintained
- Article XVI: No secrets in code
- Article XVII: Complete solution (not MVP)
- Article XVIII: Data export available (Anti-Lock-In)

### 10. Produce Quality Report

Create `walkthrough.md` with:

- What was built (features, components, pages)
- Test results (pass count, coverage, screenshots)
- Accessibility audit results
- Design system compliance matrix
- Compliance matrix (standards met/not met)
- Known issues or limitations
- Recommendation: DEPLOY or FIX

### 11. Notify User

Present quality report with launch readiness verdict.
If DEPLOY: provide deployment instructions.
If FIX: list specific items needing attention before re-validation.
