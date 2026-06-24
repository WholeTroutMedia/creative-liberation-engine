# TDD Enforcer Hive (Hive B)

**Hive Leader:** TEST_ARCHITECT  
**Status:** Active Development  
**Created:** 2026-02-13  
**Purpose:** Write integration tests BEFORE application code, define win conditions for builders

---

## Overview

Hive B is the **critical gating mechanism** in our Zero Day architecture. This hive writes comprehensive test suites based on Hive A specifications BEFORE any application code exists. Builders (Hive C) cannot proceed until tests are defined, and code cannot ship until all tests pass.

**Zero Day Principle:** If you don't know how to test it, you don't know how to build it.

---

## Hive Structure

### Agent Roster (5 Agents)

1. **TEST_ARCHITECT** (Hive Leader)
2. **FRONTEND_VALIDATOR**
3. **BACKEND_VALIDATOR**
4. **SECURITY_VALIDATOR**
5. **PERFORMANCE_VALIDATOR**

---

## Agent Specifications

### 1. TEST_ARCHITECT (Hive Leader)

**Role:** Integration test design lead, orchestrates TDD workflow

**Responsibilities:**
- Parse Hive A specifications (OpenAPI, schemas, IaC)
- Design integration test architecture
- Coordinate specialized validators
- Define test coverage requirements
- Establish success criteria for Hive C

**Inputs:**
- OpenAPI specifications from Hive A
- Database schemas from Hive A
- Infrastructure-as-Code definitions from Hive A

**Outputs:**
- Test architecture document
- Coverage requirements (% thresholds)
- Integration test framework setup
- Test execution order (dependencies)

**Authority:**
- Block Hive C from starting until test suite defined
- Reject code that doesn't meet coverage thresholds
- Escalate to ATHENA if specs are untestable

**Communication:**
- **Upstream:** Hive A (Aurora, ATHENA, COSMOS)
- **Downstream:** All Hive B validators
- **Coordination:** VERA (logs test decisions to SCRIBE)

---

### 2. FRONTEND_VALIDATOR

**Role:** UI/Component test specialist

**Responsibilities:**
- Write component unit tests (Jest/Vitest)
- Write integration tests (Cypress/Playwright)
- Validate accessibility compliance (WCAG)
- Test responsive behavior across devices
- Verify design system adherence

**Test Frameworks:**
- **Unit:** Jest, Vitest, Testing Library
- **Integration:** Cypress, Playwright
- **Visual:** Percy, Chromatic
- **Accessibility:** axe-core, Lighthouse

**Outputs:**
- Component test suites
- E2E user flow tests
- Visual regression tests
- Accessibility audit tests

**Success Criteria:**
- 100% component coverage
- All critical user flows tested
- Zero accessibility violations
- Visual regression baseline established

---

### 3. BACKEND_VALIDATOR

**Role:** API/Service test specialist

**Responsibilities:**
- Write API contract tests (OpenAPI validation)
- Write service integration tests
- Test database migrations and rollbacks
- Validate authentication/authorization flows
- Test error handling and edge cases

**Test Frameworks:**
- **API:** Supertest, Pactum, Postman/Newman
- **Integration:** Jest, Mocha, Pytest
- **Contract:** Pact, Spring Cloud Contract
- **Database:** Testcontainers, dbmate

**Outputs:**
- API contract test suite
- Service integration tests
- Database migration tests
- Auth flow validation tests

**Success Criteria:**
- 100% OpenAPI spec coverage
- All endpoints tested (happy + error paths)
- All database migrations validated
- Auth flows tested end-to-end

---

### 4. SECURITY_VALIDATOR

**Role:** Auth/Security test specialist

**Responsibilities:**
- Test authentication mechanisms
- Test authorization/permissions
- Validate input sanitization (XSS, SQL injection)
- Test rate limiting and throttling
- Validate secrets management
- Test CORS and CSP policies

**Test Frameworks:**
- **Security:** OWASP ZAP, Burp Suite
- **Auth:** Jest, Cypress (auth flows)
- **Static:** Semgrep, Snyk, Bandit
- **Secrets:** TruffleHog, GitLeaks

**Outputs:**
- Authentication test suite
- Authorization matrix tests
- Security vulnerability tests
- Penetration test scenarios

**Success Criteria:**
- Zero high/critical vulnerabilities
- All auth flows tested
- Input validation on all endpoints
- Secrets never in code/logs

---

### 5. PERFORMANCE_VALIDATOR

**Role:** Load/Speed test specialist

**Responsibilities:**
- Define performance budgets (response times, throughput)
- Write load tests (concurrent users, requests/sec)
- Test database query performance
- Validate caching behavior
- Test resource consumption (memory, CPU)

**Test Frameworks:**
- **Load:** k6, Artillery, JMeter
- **Profiling:** Chrome DevTools, Lighthouse
- **Database:** EXPLAIN ANALYZE, pg_stat_statements
- **Monitoring:** Prometheus, Grafana

**Outputs:**
- Performance budget definitions
- Load test scenarios
- Query performance tests
- Resource consumption baselines

**Success Criteria:**
- All endpoints < performance budget
- System handles expected load + 2x
- No N+1 queries
- Cache hit rates meet targets

---

## Workflow Integration

### Input: Hive A Specifications

```
1. Hive A completes: OpenAPI spec, DB schema, IaC
2. TEST_ARCHITECT receives specs
3. TEST_ARCHITECT designs test architecture
4. Specialized validators write test suites
5. All tests run and FAIL (no code exists yet)
6. TEST_ARCHITECT signals Hive C: "Green lights defined"
```

### Output: Test Suite for Hive C

```
1. Comprehensive test suite (all validators)
2. Coverage requirements documented
3. Success criteria clear (what = done?)
4. Tests run in CI pipeline
5. Hive C implements code to pass tests
6. Hive D deploys when all green
```

---

## Quality Gates

### Gate 1: Test Architecture Approval
- TEST_ARCHITECT must approve coverage plan
- ATHENA reviews for architectural soundness
- VERA logs to SCRIBE

### Gate 2: Test Suite Completeness
- All specialized validators confirm ready
- RAM_CREW validates test quality
- LEX approves moving to Hive C

### Gate 3: Green Light Validation
- All tests pass after Hive C implementation
- Performance budgets met
- Security scans clean
- Hive D proceeds to deployment

---

## Communication Protocols

### With Hive A (Upstream)
- **Channel:** GitHub Issues, MCP context
- **Frequency:** On spec completion
- **Format:** Structured specifications (OpenAPI, JSON Schema)

### With Hive C (Downstream)
- **Channel:** Test suite repository, CI logs
- **Frequency:** Continuous (test results in real-time)
- **Format:** Pass/fail status, coverage reports, error traces

### With SCRIBE (Coordination)
- **Channel:** VERA logging
- **Frequency:** All major decisions
- **Format:** Structured logs (test architecture, coverage requirements, gate approvals)

---

## Agent Creation Status

| Agent | Status | Workspace | Next Action |
|-------|--------|-----------|-------------|
| TEST_ARCHITECT | 🔴 Not created | `agents/tdd-enforcers/test-architect/` | Define agent personality & protocols |
| FRONTEND_VALIDATOR | 🔴 Not created | `agents/tdd-enforcers/frontend-validator/` | Define agent personality & protocols |
| BACKEND_VALIDATOR | 🔴 Not created | `agents/tdd-enforcers/backend-validator/` | Define agent personality & protocols |
| SECURITY_VALIDATOR | 🔴 Not created | `agents/tdd-enforcers/security-validator/` | Define agent personality & protocols |
| PERFORMANCE_VALIDATOR | 🔴 Not created | `agents/tdd-enforcers/performance-validator/` | Define agent personality & protocols |

---

## Implementation Checklist

### Phase 1: Agent Definitions
- [ ] Create TEST_ARCHITECT agent (SKILL.md, README.md)
- [ ] Create FRONTEND_VALIDATOR agent
- [ ] Create BACKEND_VALIDATOR agent
- [ ] Create SECURITY_VALIDATOR agent
- [ ] Create PERFORMANCE_VALIDATOR agent
- [ ] Update `.agent-status.json` registry

### Phase 2: Infrastructure
- [ ] Set up test framework repositories
- [ ] Configure CI pipeline for test execution
- [ ] Integrate with Hive A output channels
- [ ] Set up coverage reporting

### Phase 3: Workflow Integration
- [ ] Connect Hive A → Hive B handoff
- [ ] Connect Hive B → Hive C handoff
- [ ] Implement quality gates
- [ ] Add VERA logging

### Phase 4: Validation
- [ ] Run test workflow on sample project
- [ ] Verify all gates function
- [ ] Validate coverage thresholds
- [ ] Confirm Hive C can read test outputs

---

## Success Metrics

- **Test Suite Completeness:** 100% spec coverage before code
- **Zero Surprises:** No "oh we forgot to test that" moments
- **Clear Win Conditions:** Hive C knows exactly when done
- **Automated Validation:** No manual testing required
- **Compound Learning:** Test patterns reused across projects

---

## References

- **Zero Day Playbook:** `/docs/architecture/ZERO_DAY_OPTIMIZATION_PLAYBOOK.md`
- **Agent Registry:** `/agents/.agent-status.json`
- **Hive A (Aurora):** `/agents/aurora/`
- **Hive C (Builders):** Multiple hives
- **SCRIBE Protocols:** `/SCRIBE/protocols/`

---

**Maintained By:** TEST_ARCHITECT (once created) + VERA  
**Last Updated:** 2026-02-13 10:48 EST