# 🔄 AGENT HANDOFF PROTOCOL

**Purpose:** Define clear deliverables, acceptance criteria, and validation gates between specialized agents.

## Core Principle

**Each agent must receive COMPLETE context to execute without back-and-forth.**

Incomplete handoffs = wasted cycles = slower shipping.

---

## Standard Handoff Structure

### Every handoff includes:

1. **Input Requirements** - What the receiving agent needs
2. **Deliverables** - What the sending agent must provide
3. **Acceptance Criteria** - How to validate the handoff is complete
4. **Escalation Trigger** - When to escalate vs. continue

---

## AVERI → COMET (Idea to Product Brief)

### Input Requirements
- Raw idea or problem statement from Artist
- Strategic context from ATHENA
- Any constraints (time, budget, technical)

### COMET Deliverables
- [ ] **Problem Statement** - What problem does this solve?
- [ ] **Target Users** - Who is this for?
- [ ] **User Stories** - As a [user], I want [feature], so that [benefit]
- [ ] **Success Metrics** - How do we measure success?
- [ ] **MVP Scope** - What ships in v1.0?
- [ ] **Out of Scope** - What we're explicitly NOT building
- [ ] **Constraints** - Technical, timeline, budget limits
- [ ] **Dependencies** - What must exist before we start?

### Acceptance Criteria
- Artist approves the product brief
- MVP is clearly defined (features listed)
- Success metrics are measurable
- Technical feasibility confirmed by BOLT (if needed)

### Escalation Trigger
- Unclear product vision after 2 clarification attempts → LEONARDO
- Technical feasibility concerns → BOLT for assessment
- Strategic misalignment → ATHENA for strategic review

---

## COMET → AURORA (Product Brief to Design)

### Input Requirements
- Approved product brief from COMET
- User stories and flows
- Brand guidelines (if applicable)

### AURORA Deliverables
- [ ] **User Flow Diagrams** - How users move through the product
- [ ] **Component Specifications** - What UI components are needed
- [ ] **Design System Tokens** - Colors, typography, spacing
- [ ] **Interactive States** - Hover, active, disabled, loading states
- [ ] **Responsive Breakpoints** - Mobile, tablet, desktop specs
- [ ] **Accessibility Standards** - WCAG compliance notes
- [ ] **Asset Requirements** - Icons, images, media needed
- [ ] **Design Handoff Document** - Everything BOLT needs to build

### Acceptance Criteria
- All user stories have corresponding designs
- COMET confirms designs match product vision
- Component specs are buildable (BOLT review)
- Designs are responsive and accessible

### Escalation Trigger
- Product vision unclear → COMET for clarification
- Technical constraints conflict with design → BOLT + AURORA sync
- Brand/UX philosophy questions → LEONARDO for guidance

---

## AURORA → BOLT (Design to Code)

### Input Requirements
- Complete design handoff from AURORA
- Approved product brief from COMET
- Technical constraints identified

### BOLT Deliverables
- [ ] **Tech Stack Selection** - Framework, libraries, tools chosen
- [ ] **Architecture Document** - How components connect
- [ ] **Database Schema** - If data storage needed
- [ ] **API Specifications** - Endpoints, request/response formats
- [ ] **Component Implementation** - Functional UI matching designs
- [ ] **Business Logic** - Features working as specified
- [ ] **Error Handling** - Graceful failures, user feedback
- [ ] **Basic Testing** - Core functionality validated
- [ ] **Deployment Config** - Ready for production deployment
- [ ] **Documentation** - Setup, configuration, deployment steps

### Acceptance Criteria
- All MVP features functional
- Designs implemented accurately (AURORA validation)
- Core user flows work end-to-end
- No critical bugs blocking basic usage
- Deployment configuration tested

### Escalation Trigger
- Design not technically feasible → AURORA + BOLT collaborative redesign
- Technical architecture questions → LEONARDO for strategic tech direction
- Performance/scaling concerns → SWITCHBOARD for infrastructure guidance
- Third escalation on same issue → COSMOS for alternative approach

---

## BOLT → COMPASS (Code to Quality Validation)

### Input Requirements
- Built product from BOLT
- Product brief from COMET (success criteria)
- Design specs from AURORA (visual/UX standards)

### COMPASS Deliverables
- [ ] **Functional Testing Results** - Do features work?
- [ ] **Visual QA Results** - Does it match designs?
- [ ] **User Flow Validation** - Can users complete key tasks?
- [ ] **Performance Check** - Load times acceptable?
- [ ] **Accessibility Audit** - Basic WCAG compliance?
- [ ] **Security Review** - Common vulnerabilities checked?
- [ ] **Browser/Device Testing** - Works across platforms?
- [ ] **Deployment Readiness** - Can it ship safely?
- [ ] **Issues Log** - Critical, high, medium, low priority items
- [ ] **Ship/No-Ship Recommendation** - Final decision

### Acceptance Criteria
- Zero critical bugs
- All MVP user stories validated
- Designs implemented acceptably (minor issues acceptable)
- Performance acceptable for v1.0 scale
- Security basics covered
- Deployment config verified

### Escalation Trigger
- Multiple critical bugs → BOLT for fixes
- Fundamental design issues → AURORA for redesign
- Architecture problems → LEONARDO + BOLT review
- Cannot achieve ship-ready state → ATHENA for strategic decision (ship with issues vs. delay)

---

## COMPASS → IRIS (Quality Validation to Deployment)

### Input Requirements
- Ship-approved product from COMPASS
- All critical issues resolved
- Deployment configuration from BOLT

### IRIS Deliverables
- [ ] **Production Environment Setup** - Domain, hosting, services
- [ ] **Deployment Execution** - Code deployed to production
- [ ] **Health Check Validation** - Live product verified working
- [ ] **Monitoring Setup** - Error tracking, analytics configured
- [ ] **Documentation Updated** - Live URLs, access info
- [ ] **Handoff to Operations** - Who maintains this?
- [ ] **Success Notification** - Team + Artist informed
- [ ] **Retrospective Trigger** - Schedule learning session

### Acceptance Criteria
- Product accessible at production URL
- Core functionality verified in production
- Monitoring and alerts configured
- Team has access/credentials
- Documentation complete

### Escalation Trigger
- Deployment failures → BOLT + SWITCHBOARD for infrastructure fix
- Production issues not in staging → COMPASS + BOLT investigation
- Fundamental architecture issues → LEONARDO + ATHENA strategic review

---

## IRIS → SAGE (Deployment to Documentation)

### Input Requirements
- Shipped product
- Full project history (decisions, learnings, issues)
- Retrospective from team

### SAGE Deliverables
- [ ] **Project Documentation** - Complete record
- [ ] **Learnings Captured** - What worked, what didn't
- [ ] **Template Updates** - Improvements to playbooks
- [ ] **Best Practices Extracted** - Compound learning
- [ ] **Case Study** - For future reference
- [ ] **Knowledge Base Update** - System-wide improvements

### Acceptance Criteria
- Future projects can learn from this one
- Templates improved based on experience
- Patterns documented for reuse

---

## Cross-Cutting Handoff Protocols

### ATHENA (Strategic Oversight)
**Activates when:**
- Multi-agent conflicts
- Strategic misalignment detected  
- Fundamental architecture questions
- Mission/vision clarity needed

**Delivers:**
- Strategic direction
- Conflict resolution
- Architectural principles
- Go/no-go decisions

### VERA (Truth Verification)
**Activates when:**
- Facts need verification
- Claims require validation
- Technical feasibility questioned
- Memory/history lookup needed

**Delivers:**
- Verified information
- Historical context
- Technical validation
- Immutable principles

### LEONARDO (Strategic Vision)
**Activates when:**
- Long-term strategy questions
- Product portfolio decisions
- Market positioning
- Innovation opportunities

**Delivers:**
- Strategic guidance
- Vision alignment
- Market insights
- Innovation direction

### COSMOS (Innovation)
**Activates when:**
- Conventional approaches failing
- Need alternative thinking
- Breakthrough required
- Exploration needed

**Delivers:**
- Alternative approaches
- Innovative solutions
- Experimental paths
- Paradigm shifts

---

## Handoff Validation Checklist

Before advancing to next agent:

- [ ] All deliverables complete
- [ ] Acceptance criteria met
- [ ] Receiving agent confirms they have what they need
- [ ] Quality gate passed
- [ ] No critical blockers
- [ ] Artist approves (if strategic decision)

**If any item is unchecked:** Do not proceed. Resolve issue or escalate.

---

## Anti-Patterns to Avoid

❌ **"Figure it out as you go"** - Wastes time, causes rework  
✅ **Complete handoffs** - Clear requirements upfront

❌ **"Close enough"** - Compounds into chaos  
✅ **Acceptance criteria met** - Standards maintained

❌ **"We'll fix it later"** - Technical debt explosion  
✅ **Ship-ready quality** - Address issues before next stage

❌ **"Let's all discuss"** - Coordination overhead  
✅ **Sequential activation** - Clear order, clear handoffs

---

**Status:** ✅ Active Protocol  
**Authority:** AVERI Trinity  
**Updates:** Continuous improvement based on shipped products

**⟐ CLEAR HANDOFFS = FAST SHIPPING ⟐**