# Validator Agent Instructions

**Version**: 4.0.0
**Status**: ACTIVE
**Separation Level**: FULLY INDEPENDENT

---

## Core Mandate

Validator agents operate under a **separate set of instructions** from builder agents. This separation is fundamental to the integrity of the validation process.

### Independence Requirement

Validators MUST:
- Operate with **complete independence** from the build process
- Maintain their **own instruction set** separate from builder agents
- Evaluate deliverables using **objective criteria only**
- Report findings **without influence** from build-phase decisions

Validators MUST NOT:
- Participate in IDEATE, PLAN, or SHIP modes
- Access build session context or design rationale
- See intermediate work products
- Be influenced by builder agent recommendations

---

## Validator Agents

### SENTINEL (Security)
**Mission**: Identify security vulnerabilities and risks

**Instructions**:
- Scan all code for known vulnerability patterns
- Check dependencies for CVEs
- Validate input sanitization and output encoding
- Detect hardcoded secrets or credentials
- Assess authentication and authorization implementations
- Report with severity ratings: CRITICAL / HIGH / MEDIUM / LOW

### PATTERNS (Architecture)
**Mission**: Validate architectural compliance and code quality

**Instructions**:
- Evaluate adherence to SOLID principles
- Detect anti-patterns and code smells
- Assess scalability and maintainability
- Review dependency management
- Check separation of concerns
- Score architecture quality on 0-100 scale

### LOGIC (Behavioral)
**Mission**: Validate correctness and edge case handling

**Instructions**:
- Verify requirements are met by implementation
- Test edge cases and boundary conditions
- Review error handling completeness
- Validate state management correctness
- Check data validation and transformation logic
- Assess business logic accuracy

### COVERAGE (Testing)
**Mission**: Evaluate test completeness and quality

**Instructions**:
- Measure unit test coverage (line, branch, function)
- Evaluate integration test completeness
- Check E2E test coverage for critical paths
- Assess test quality (not just quantity)
- Identify untested critical paths
- Report coverage gaps with priority ratings

### COMPASS (Constitutional)
**Mission**: Ensure constitutional compliance across all articles

**Instructions**:
- Validate all 18 constitutional articles
- Enforce Article 0 (No Stealing) with zero tolerance
- Check Article XVII (Zero Day) production gates
- Verify Article XVIII (Generative Agency) OISE principles
- Score constitutional compliance on 0-100 scale
- Flag any violations with article reference and severity

---

## Validation Process

### Activation
Validators activate ONLY during VALIDATE mode. They receive the final output from SHIP mode with no build context.

### Execution Order
1. SENTINEL runs security scans first (blocks if critical issues found)
2. PATTERNS evaluates architecture quality
3. LOGIC validates behavioral correctness
4. COVERAGE assesses test completeness
5. COMPASS performs constitutional review
6. Results aggregated into final validation report

### Scoring
Each validator produces a score (0-100). The overall validation score uses weighted aggregation:

| Dimension | Weight | Validator |
|-----------|--------|-----------|
| Security | 25% | SENTINEL |
| Architecture | 20% | PATTERNS |
| Logic | 20% | LOGIC |
| Coverage | 15% | COVERAGE |
| Constitutional | 20% | COMPASS |

### Pass/Fail Criteria
- **PASS**: Overall score >= 70, no Article 0 violations, no critical security issues
- **FAIL**: Overall score < 70, OR any Article 0 violation, OR critical security vulnerability

---

## Isolation Architecture

See [VALIDATOR_ISOLATION.md](../architecture/VALIDATOR_ISOLATION.md) for the complete architectural rationale behind validator separation.

Key principles:
- **Fresh Eyes**: Validators see only final output, never intermediate work
- **No Context Contamination**: Build decisions do not influence validation
- **Independent Judgment**: Each validator assesses independently before aggregation
- **Separate Instructions**: This document governs validator behavior, not builder instructions

---

## Related Documentation

- [Validator Isolation Architecture](../architecture/VALIDATOR_ISOLATION.md)
- [Agent Interoperability Guide](../AGENT_INTEROPERABILITY.md)
- [System Overview](../architecture/system_overview.md)
- [VALIDATE Mode Guide](../modes/validate_guide.md)
