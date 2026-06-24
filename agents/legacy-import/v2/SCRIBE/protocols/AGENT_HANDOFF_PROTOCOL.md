# Agent Handoff Protocol

**Status:** Active  
**Created:** 2026-02-13  
**Owner:** VERA (SCRIBE Coordination Layer)  
**Purpose:** Explicit, structured handoffs between agents to prevent task loss and coordination failures

---

## Problem Statement

Implicit handoffs create:
- Lost context between agent transitions
- Unclear task ownership
- Work duplication or gaps
- No audit trail of who did what

**This protocol makes all handoffs explicit and logged.**

---

## Handoff Data Structure

```typescript
interface AgentHandoff {
  // Identity
  handoffId: string;              // Unique identifier
  timestamp: string;              // ISO 8601
  
  // Agents
  fromAgent: string;              // Agent completing work
  fromHive: 'aurora' | 'tdd-enforcers' | 'builders' | 'ci-cd' | 'scribe';
  toAgent: string;                // Agent receiving work
  toHive: 'aurora' | 'tdd-enforcers' | 'builders' | 'ci-cd' | 'scribe';
  
  // Task Context
  taskId: string;                 // Links to overall task
  taskName: string;
  status: HandoffStatus;
  
  // Work Completed
  artifacts: Artifact[];          // What was produced
  decisions: Decision[];          // Architectural choices made
  
  // Next Steps
  nextActions: Action[];          // What needs to happen next
  blockers?: Blocker[];           // Why handoff occurred (if blocked)
  
  // Quality
  validationStatus: 'passed' | 'failed' | 'pending';
  testsRun?: number;
  testsPassed?: number;
  
  // Metadata
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  dependencies: string[];         // Other tasks this depends on
}

enum HandoffStatus {
  COMPLETE = 'complete',           // Work done, ready for next agent
  BLOCKED = 'blocked',             // Cannot proceed, needs intervention
  NEEDS_REVIEW = 'needs-review',   // Done but requires approval
  PARTIAL = 'partial'              // Some work done, more needed
}

interface Artifact {
  type: 'spec' | 'test' | 'code' | 'config' | 'documentation';
  path: string;                   // File path or URL
  description: string;
  sha?: string;                   // Git SHA if committed
}

interface Decision {
  question: string;               // What was decided
  decision: string;               // Choice made
  rationale: string;              // Why this choice
  alternatives: string[];         // What else was considered
}

interface Action {
  description: string;            // What needs to happen
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedComplexity: 'simple' | 'moderate' | 'complex';
  dependencies: string[];         // What must happen first
}

interface Blocker {
  type: 'missing-info' | 'dependency' | 'technical' | 'architectural';
  description: string;
  resolution: string;             // How to unblock
  escalateTo?: string;            // Agent who can resolve
}
```

---

## Handoff Workflow

### Step 1: Initiating Handoff (FROM Agent)

```typescript
// Agent completes work and initiates handoff
const handoff: AgentHandoff = {
  handoffId: generateId(),
  timestamp: new Date().toISOString(),
  fromAgent: 'Aurora',
  fromHive: 'aurora',
  toAgent: 'TEST_ARCHITECT',
  toHive: 'tdd-enforcers',
  taskId: 'task-123',
  taskName: 'Build user authentication system',
  status: HandoffStatus.COMPLETE,
  
  artifacts: [
    {
      type: 'spec',
      path: 'specs/auth-openapi.yaml',
      description: 'OpenAPI specification for authentication endpoints',
      sha: 'abc123...'
    },
    {
      type: 'spec',
      path: 'specs/auth-database-schema.sql',
      description: 'Database schema for users, sessions, tokens'
    }
  ],
  
  decisions: [
    {
      question: 'Authentication method',
      decision: 'JWT tokens with refresh mechanism',
      rationale: 'Stateless, scalable, standard',
      alternatives: ['Session cookies', 'OAuth only']
    }
  ],
  
  nextActions: [
    {
      description: 'Write integration tests for all auth endpoints',
      priority: 'critical',
      estimatedComplexity: 'moderate',
      dependencies: []
    },
    {
      description: 'Write security tests for token validation',
      priority: 'critical',
      estimatedComplexity: 'simple',
      dependencies: []
    }
  ],
  
  validationStatus: 'passed',
  estimatedComplexity: 'moderate',
  dependencies: []
};

// Send to VERA for logging
await vera.logHandoff(handoff);

// Notify receiving agent
await relay.notifyAgent(handoff.toAgent, handoff);
```

---

### Step 2: Receiving Handoff (TO Agent)

```typescript
// TEST_ARCHITECT receives notification
class TestArchitect {
  async receiveHandoff(handoff: AgentHandoff): Promise<void> {
    // 1. Acknowledge receipt
    await vera.acknowledgeHandoff(handoff.handoffId, this.agentId);
    
    // 2. Validate completeness
    const validation = this.validateHandoff(handoff);
    
    if (!validation.complete) {
      // Request clarification from sending agent
      await this.requestClarification(handoff, validation.missing);
      return;
    }
    
    // 3. Load artifacts
    const specs = await this.loadArtifacts(handoff.artifacts);
    
    // 4. Review decisions
    const architectureUnderstanding = this.reviewDecisions(handoff.decisions);
    
    // 5. Begin work
    await this.executeNextActions(handoff.nextActions);
  }
  
  private validateHandoff(handoff: AgentHandoff): ValidationResult {
    const required = {
      specs: handoff.artifacts.filter(a => a.type === 'spec'),
      decisions: handoff.decisions,
      nextActions: handoff.nextActions
    };
    
    const missing = [];
    
    if (required.specs.length === 0) {
      missing.push('No specifications provided');
    }
    
    if (required.nextActions.length === 0) {
      missing.push('No next actions defined');
    }
    
    return {
      complete: missing.length === 0,
      missing
    };
  }
}
```

---

## Handoff Types

### Type 1: Sequential Handoff (Hive A → Hive B)
**Status:** `COMPLETE`  
**Flow:** Work done, next hive can proceed immediately

**Example:**
```typescript
// Aurora finishes specs → TEST_ARCHITECT starts tests
status: HandoffStatus.COMPLETE
artifacts: [OpenAPI spec, DB schema, IaC]
nextActions: ['Write integration tests', 'Write security tests']
```

---

### Type 2: Blocked Handoff
**Status:** `BLOCKED`  
**Flow:** Work cannot proceed, needs intervention

**Example:**
```typescript
// BOLT discovers spec is ambiguous → escalate to Aurora
status: HandoffStatus.BLOCKED
blockers: [{
  type: 'missing-info',
  description: 'Auth spec doesn\'t define token expiration time',
  resolution: 'Aurora needs to specify JWT expiration policy',
  escalateTo: 'Aurora'
}]
```

**Resolution:**
1. VERA notifies Aurora
2. Aurora clarifies spec
3. Aurora creates new handoff to BOLT
4. BOLT resumes work

---

### Type 3: Review Handoff
**Status:** `NEEDS_REVIEW`  
**Flow:** Work done but requires approval before proceeding

**Example:**
```typescript
// COMET completes backend API → needs ATHENA review
status: HandoffStatus.NEEDS_REVIEW
artifacts: [API implementation]
nextActions: [{
  description: 'ATHENA: Review architecture for scalability',
  priority: 'high',
  estimatedComplexity: 'moderate'
}]
```

**Resolution:**
1. ATHENA reviews
2. ATHENA either:
   - Approves → handoff to Hive D
   - Requests changes → handoff back to COMET

---

### Type 4: Parallel Handoff
**Status:** `PARTIAL`  
**Flow:** Work split across multiple agents simultaneously

**Example:**
```typescript
// TEST_ARCHITECT splits test work across validators
status: HandoffStatus.PARTIAL
toAgent: 'FRONTEND_VALIDATOR,BACKEND_VALIDATOR,SECURITY_VALIDATOR'
nextActions: [
  { description: 'Frontend: Write component tests', ... },
  { description: 'Backend: Write API tests', ... },
  { description: 'Security: Write auth tests', ... }
]
```

---

## VERA's Role in Handoffs

VERA logs all handoffs to SCRIBE and ensures:

### 1. Completeness Validation
```typescript
class VeraHandoffValidator {
  validate(handoff: AgentHandoff): ValidationResult {
    const errors = [];
    
    // Required fields
    if (!handoff.artifacts.length) {
      errors.push('No artifacts provided');
    }
    
    if (!handoff.nextActions.length && handoff.status === 'complete') {
      errors.push('Complete status but no next actions defined');
    }
    
    // Status-specific validation
    if (handoff.status === 'blocked' && !handoff.blockers?.length) {
      errors.push('Blocked status but no blockers defined');
    }
    
    return { valid: errors.length === 0, errors };
  }
}
```

### 2. Handoff Chain Tracking
```typescript
interface HandoffChain {
  taskId: string;
  handoffs: AgentHandoff[];
  currentOwner: string;
  startTime: string;
  completionTime?: string;
}

// VERA maintains the full chain
const chain = await vera.getHandoffChain('task-123');
// Returns: Aurora → TEST_ARCHITECT → BOLT → LEX → COMPLETE
```

### 3. Handoff Metrics
```typescript
interface HandoffMetrics {
  avgHandoffTime: number;        // Time between handoffs
  blockedHandoffs: number;       // How many blocked
  clarificationsRequested: number;
  handoffsByAgent: Record<string, number>;
  bottleneckAgent?: string;      // Agent with most blocked handoffs
}
```

---

## Integration with GitHub Actions

```yaml
# In zero-day-orchestration.yml
- name: Create Handoff
  if: success()
  run: |
    # Hive A complete, hand off to Hive B
    npx create-handoff \
      --from Aurora \
      --to TEST_ARCHITECT \
      --task ${{ github.event.issue.number }} \
      --status complete \
      --artifacts specs/openapi.yaml,specs/schema.sql

- name: Validate Handoff
  run: |
    # Receiving agent validates before starting work
    npx validate-handoff --handoff-id ${{ steps.create-handoff.outputs.id }}
```

---

## Handoff Failure Recovery

### Scenario 1: Agent Never Acknowledges
- **Timeout:** 5 minutes
- **Action:** VERA escalates to RELAY
- **Resolution:** RELAY pings agent, reassigns if unresponsive

### Scenario 2: Handoff Validation Fails
- **Action:** Auto-return to sending agent
- **Message:** Specific validation errors
- **Retry:** Sending agent fixes and resubmits

### Scenario 3: Work Abandoned Mid-Task
- **Detection:** No handoff created within expected timeframe
- **Action:** VERA flags task as stalled
- **Resolution:** ATHENA reviews, reassigns or escalates

---

## Success Metrics

- **Handoff Success Rate:** % of handoffs accepted on first try
- **Average Handoff Time:** Time from creation to acknowledgment
- **Blocked Rate:** % of handoffs marked as blocked
- **Clarification Rate:** % requiring clarification
- **Chain Completion Rate:** % of handoff chains reaching deployment

---

## References

- **Zero Day Playbook:** `/docs/architecture/ZERO_DAY_OPTIMIZATION_PLAYBOOK.md`
- **VERA Protocol:** `/SCRIBE/protocols/VERA_PROTOCOL.md`
- **Agent Registry:** `/agents/.agent-status.json`

---

**Maintained By:** VERA  
**Status:** Active  
**Last Updated:** 2026-02-13 10:58 EST
