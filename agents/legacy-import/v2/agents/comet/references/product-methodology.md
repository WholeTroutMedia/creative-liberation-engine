# 📊 Product Methodology

**COMET's Approach to Product Development**

---

## Philosophy

**Products are built for people, not for the sake of building.**

Every feature should:
- Solve a real user problem
- Support business goals
- Be technically feasible
- Create measurable value

---

## Product Development Lifecycle

### Phase 1: Discovery

**Goal:** Understand the problem space

**Activities:**
- User research and interviews
- Competitive analysis
- Market sizing
- Problem validation
- Stakeholder alignment

**Output:**
- Problem statement
- User personas
- Opportunity assessment
- Go/no-go decision

**Questions to answer:**
- Who has this problem?
- How painful is it?
- Are they willing to pay (time/money) for a solution?
- Can we build something better than alternatives?
- Does it align with our strategy?

---

### Phase 2: Definition

**Goal:** Define what we'll build

**Activities:**
- User story creation
- Requirements documentation
- Success metrics definition
- MVP scoping
- Technical exploration (with @bolt)

**Output:**
- Product requirements document
- User stories with acceptance criteria
- Success metrics and targets
- MVP scope
- Technical feasibility assessment

**Questions to answer:**
- What's the smallest thing we can build to test the hypothesis?
- How will we know if it's successful?
- What are must-haves vs. nice-to-haves?
- What are the technical constraints?
- What dependencies exist?

---

### Phase 3: Design

**Goal:** Design the solution

**Activities:**
- User flow mapping
- Wireframing
- Prototyping
- Usability testing
- Visual design (with @aurora)

**Output:**
- User flows
- Wireframes/mockups
- Interactive prototype
- Usability test results
- Final designs

**Questions to answer:**
- Is the flow intuitive?
- Does it solve the user problem?
- Is it accessible?
- Does it fit the design system?
- Have we tested with real users?

---

### Phase 4: Development

**Goal:** Build and validate

**Activities:**
- Sprint planning (with @bolt, @leonardo)
- Implementation oversight
- Quality review (with @compass)
- Iterative refinement
- Beta testing

**Output:**
- Working software
- Test results
- Beta feedback
- Launch readiness

**Questions to answer:**
- Does it work as designed?
- Is performance acceptable?
- Are edge cases handled?
- Is it ready for users?
- What did we learn?

---

### Phase 5: Launch

**Goal:** Ship to users

**Activities:**
- Launch planning
- Documentation (with @sage)
- Communication
- Monitoring setup
- Support preparation

**Output:**
- Launched feature
- User documentation
- Launch announcement
- Support materials
- Monitoring dashboard

**Questions to answer:**
- How will users discover this?
- What support might they need?
- How will we know if there are problems?
- What's the rollback plan?
- How are we measuring success?

---

### Phase 6: Learn

**Goal:** Measure and improve

**Activities:**
- Metrics monitoring
- User feedback collection
- A/B testing
- Iteration planning
- Success assessment

**Output:**
- Performance report
- User feedback summary
- Improvement backlog
- Success evaluation
- Next iteration plan

**Questions to answer:**
- Did we hit our success metrics?
- What do users love/hate?
- What should we improve?
- What did we learn?
- What's next?

---

## Key Principles

### 1. Start with Why

**Always articulate:**
- **Problem:** What user problem are we solving?
- **Impact:** Why does this matter?
- **Success:** How will we know we solved it?

**Example:**
```
Problem: Users abandon cart because checkout is too complex
Impact: 30% cart abandonment = $X lost revenue
Success: Reduce checkout steps from 5 to 3, decrease abandonment by 50%
```

### 2. Build Iteratively

**Prefer:**
- Small releases over big launches
- Learning over perfection
- User feedback over assumptions
- Experiments over commitments

**Approach:**
1. MVP: Minimum Viable Product
2. MLP: Minimum Lovable Product
3. MMP: Minimum Marketable Product
4. Full Feature: Complete vision

### 3. Measure Everything

**Define metrics at three levels:**

**Input metrics** (what we do):
- Feature usage
- User actions
- Engagement

**Output metrics** (immediate results):
- Conversion rates
- Task completion
- Time to complete

**Outcome metrics** (business impact):
- Revenue
- Retention
- Customer satisfaction

### 4. Collaborate Cross-Functionally

**Product is a team sport.**

**Include from the start:**
- Design (@aurora) - For user experience
- Engineering (@bolt) - For feasibility
- Strategy (@leonardo) - For alignment
- Quality (@compass) - For excellence
- Documentation (@sage) - For clarity

**Benefits:**
- Catch issues early
- Build shared understanding
- Leverage diverse expertise
- Create ownership

### 5. Stay User-Centered

**Continuously validate:**
- Talk to users regularly
- Watch them use the product
- Read feedback and support tickets
- Monitor behavior data
- Test assumptions

**Red flags:**
- "I think users will..."
- "We've always done it this way..."
- "Everyone wants this feature..."
- "It's obvious how to use..."

**Better:**
- "User research shows..."
- "Testing revealed that..."
- "Users told us..."
- "Data indicates..."

---

## Decision Frameworks

### When to Build vs. Buy

**Build when:**
- It's core to your value proposition
- Existing solutions don't fit
- You need full control
- It's a competitive advantage

**Buy when:**
- It's commodity functionality
- Time to market is critical
- Expertise is required
- Maintenance is complex

### When to Say No

**Say no when:**
- It doesn't serve core users
- It distracts from strategy
- Resources are better used elsewhere
- Success can't be measured
- It's a workaround for bad design

**How to say no gracefully:**
1. Acknowledge the request
2. Explain the reasoning
3. Suggest alternatives
4. Keep the door open for future

### When to Pivot

**Consider pivoting when:**
- Metrics show consistent underperformance
- User feedback reveals wrong assumptions
- Market changes make solution obsolete
- Better opportunity emerges
- Technical constraints prevent success

**Process:**
1. Analyze what's not working
2. Generate alternative approaches
3. Test new hypotheses
4. Commit or move on

---

## Documentation Standards

### Product Requirements Document (PRD)

**Structure:**
```markdown
# [Feature Name]

## Problem Statement
- User problem
- Why it matters
- Current pain points

## Goals
- Business objectives
- User outcomes
- Success metrics

## Target Users
- Persona
- Use cases
- Frequency

## Solution Overview
- High-level approach
- Key features
- Out of scope

## User Stories
- As a [user]...
- I want to [action]...
- So that [benefit]...

## Success Metrics
- How we'll measure success
- Target values
- Monitoring plan

## Technical Considerations
- Dependencies
- Constraints
- Risks

## Launch Plan
- Rollout strategy
- Communication plan
- Support preparation
```

### User Story Format

```markdown
**As a** [type of user]
**I want to** [action]
**So that** [benefit]

**Acceptance Criteria:**
- [ ] Criteria 1
- [ ] Criteria 2
- [ ] Criteria 3

**Notes:**
- Additional context
- Edge cases
- Dependencies
```

---

## Common Pitfalls

### ❌ Building for the Vocal Minority

**Problem:** Feature requests from loudest users
**Solution:** Validate with data and broader user base

### ❌ Feature Bloat

**Problem:** Adding features without removing anything
**Solution:** Regular feature audits, removal of unused features

### ❌ Ignoring Technical Debt

**Problem:** Only building new, never improving old
**Solution:** Balance new features with maintenance and improvement

### ❌ Shipping and Forgetting

**Problem:** Launch without measuring or iterating
**Solution:** Post-launch reviews, continuous improvement

### ❌ Analysis Paralysis

**Problem:** Over-researching, never shipping
**Solution:** Set research time limits, embrace imperfect data

---

## Tools and Templates

### Opportunity Canvas

```
[🎯 Problem] -> [👥 Users] -> [💡 Solution] -> [📊 Success]
     |
     v
[🚫 Out of Scope]
```

### Feature Prioritization Matrix

```
        High Impact
            |
Low ------+------ High
Effort    |    Effort
          |
       Low Impact

Quadrants:
- High Impact, Low Effort: DO FIRST
- High Impact, High Effort: PLAN CAREFULLY
- Low Impact, Low Effort: DO LATER
- Low Impact, High Effort: AVOID
```

### Hypothesis Format

```
We believe that [building feature X]
For [target users]
Will achieve [measurable outcome]
We'll know we're right when [success metric]
```

---

**This methodology is living.**

It evolves as we:
- Learn from successes
- Analyze failures
- Discover better patterns
- Adapt to new contexts

**Product development is both art and science.**

We use frameworks for structure, but judgment for decisions.

---

**Created by:** COMET  
**Last Updated:** 2026-01-28  
**Next Review:** 2026-04-28

**⟐ TOWARD INFINITY ⟐**