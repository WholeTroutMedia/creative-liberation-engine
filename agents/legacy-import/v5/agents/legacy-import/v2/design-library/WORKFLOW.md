# 🔄 Design Library Workflow

> Standard operating procedures for the Design Language Building Team

**Purpose:** Define how we work together to build and maintain the library  
**Audience:** All team members (Aurora, CODEX, Leonardo, COMET, BOLT)  
**Updated:** January 26, 2026

---

## Core Principles

1. **Quality over Quantity** - Better to have 100 excellent patterns than 1000 mediocre ones
2. **Documentation = Love** - Future agents will thank us for clear docs
3. **Sacred Mission First** - Ethics before aesthetics, always
4. **Compound Learning** - Each pattern teaches the whole system
5. **Clear Ownership** - Everyone knows their role

---

## Roles & Responsibilities

### Aurora (Design Lead)
**Authority:** Final approval on all additions  
**Focus:** Vision, quality, aesthetic standards

**Activities:**
- Define what "library-worthy" means
- Final review before pattern accepted
- Resolve design disputes
- Set curation priorities
- Maintain design philosophy

**Decision rights:**
- ✅ Accept or reject patterns
- ✅ Define quality standards
- ✅ Set library direction

---

### CODEX (Library Curator)
**Authority:** Organization structure and taxonomy  
**Focus:** Findability, indexing, metadata

**Activities:**
- Maintain pattern-index.md
- Organize files in correct folders
- Tag patterns with metadata
- Create cross-references
- Optimize search/discovery
- Ensure naming consistency

**Decision rights:**
- ✅ File organization structure
- ✅ Naming conventions
- ✅ Category taxonomy
- ✅ Index format

---

### Leonardo (Visual Oracle)
**Authority:** Quality control veto  
**Focus:** Visual excellence, aesthetics

**Activities:**
- Review visual quality before acceptance
- Identify aesthetic issues
- Suggest improvements
- Maintain visual consistency
- Flag low-quality submissions

**Decision rights:**
- ✅ Veto patterns that don't meet quality bar
- ⚠️ Recommendations (Aurora has final say)

---

### COMET (Integration Architect)
**Authority:** Technical implementation guidance  
**Focus:** Backend patterns, API design, systems

**Activities:**
- Extract backend-relevant patterns
- Document technical requirements
- Provide implementation notes
- Identify system architecture patterns
- Guide technical feasibility

**Decision rights:**
- ✅ Technical implementation notes
- ⚠️ Technical viability input (Aurora decides inclusion)

---

### BOLT (Frontend Extraction Specialist)
**Authority:** Component extraction and frontend patterns  
**Focus:** UI components, interactions, animations

**Activities:**
- Extract frontend components
- Document interaction patterns
- Capture animation details
- Provide implementation examples
- Test component behavior

**Decision rights:**
- ✅ Frontend implementation notes
- ⚠️ Technical viability input (Aurora decides inclusion)

---

## Standard Workflows

### Workflow 1: Adding a New Pattern

#### Step 1: Discovery
**Who:** Any team member  
**Where:** Mobbin, Pttrns, Framify, Figma Community, or wild

**Actions:**
1. Find interesting pattern in source
2. Take initial screenshot or save
3. Note: app name, pattern type, why interesting

**Output:** Raw pattern candidate

---

#### Step 2: Initial Screening
**Who:** Discoverer + Leonardo (if visual quality concern)

**Questions to ask:**
- Does this solve a real problem?
- Is it production-ready (from real app)?
- Is it library-worthy quality?
- Does it pass sacred mission filter?

**Sacred Mission Filter:**
1. ✓ Responsible? (Respects users, data, attention)
2. ✓ Ethical? (Would we want this used on us?)
3. ✓ Giving? (Creates abundance, not scarcity)
4. ✓ Everyone's but none's? (Open, learnable, forkable)

**Output:** GO / NO-GO decision

---

#### Step 3: Extraction
**Who:** BOLT (frontend) or COMET (backend)

**Actions:**

**For Screenshots:**
- Capture at minimum 1440px width (desktop) or native resolution (mobile)
- Get all important states (default, hover, active, error, etc.)
- Show complete context (not mid-element)
- Save as PNG with clear name: `[app]-[pattern]-[variant].png`

**For Figma:**
- Duplicate community file to team workspace
- Export key assets if needed
- Document file location

**For Framer:**
- Copy component to master project
- Save component link
- Screenshot for quick reference

**Output:** Organized files ready for documentation

---

#### Step 4: Documentation
**Who:** Extractor (BOLT/COMET) or CODEX

**Required fields:**
```markdown
# [Pattern Name]

**Category:** [navigation/forms/feedback/etc.]
**Source:** [App name]
**Date Added:** [YYYY-MM-DD]
**Added By:** [Agent name]
**Quality Review:** [Leonardo: ✅ Approved]
**Final Approval:** [Aurora: ✅ Approved]

## Purpose
[What problem does this solve?]

## When to Use
[Appropriate contexts]

## When NOT to Use
[Anti-patterns, inappropriate contexts]

## Implementation Notes

### Frontend (BOLT)
[Component structure, key interactions]

### Backend (COMET)
[API requirements, data structures, if applicable]

## Accessibility
[A11y considerations, keyboard nav, screen readers]

## States
- Default: [description/screenshot]
- Hover: [description/screenshot]
- Active: [description/screenshot]
- Disabled: [description/screenshot]
- Error: [description/screenshot]

## Variants
[Different versions: sizes, themes, contexts]

## Examples
**Good:**
- [Screenshot with caption]

**Avoid:**
- [Anti-pattern with caption]

## References
- Source app: [Link]
- Similar patterns: [Links to related library patterns]
```

**Output:** Fully documented pattern

---

#### Step 5: Organization
**Who:** CODEX

**Actions:**
1. Place files in correct folders:
   - Screenshots → `patterns/[category]/` or `apps/[app]/`
   - Documentation → Same folder as screenshots
   - Figma sources → Note in `figma/README.md`
   - Framer components → Note in `framer/README.md`

2. Add to `pattern-index.md`:
   ```markdown
   ### [Pattern Name]
   - **Category:** [category]
   - **Source:** [app]
   - **Path:** `design-library/patterns/[category]/[pattern-name]/`
   - **Tags:** [tag1, tag2, tag3]
   - **Use case:** [brief description]
   ```

3. Update category README if needed

4. Create cross-references to related patterns

**Output:** Pattern findable and organized

---

#### Step 6: Quality Review
**Who:** Leonardo → Aurora

**Leonardo checks:**
- ✓ Visual quality meets bar
- ✓ Screenshots are clear
- ✓ Aesthetic consistency
- ✓ No visual bugs captured

**Aurora checks:**
- ✓ Solves real problem
- ✓ Documentation complete
- ✓ Aligns with library vision
- ✓ Passes sacred mission filter
- ✓ Implementation notes sufficient

**Output:** ✅ Approved or ⚠️ Revisions needed

---

#### Step 7: Integration
**Who:** CODEX (final commit)

**Actions:**
1. Commit to repository with clear message:
   ```
   Add [pattern name] - [category]
   
   Source: [app]
   Reviewed by: Leonardo ✅, Aurora ✅
   ```

2. Update library stats in README

3. Announce to team (if significant addition)

**Output:** Pattern live and available

---

### Workflow 2: Using a Pattern (Agent Reference)

**Scenario:** An agent needs to generate UI and wants to use library patterns

**Steps:**

1. **Identify need:**
   - "I need a navigation solution"
   - "User wants a command palette"
   - "Dashboard needs to display metrics"

2. **Search library:**
   - Check `pattern-index.md` for relevant patterns
   - Look in category folders
   - Search by tag or source app

3. **Reference in prompt:**
   ```
   Use design-library/patterns/navigation/command-palette
   for the search interface
   ```

4. **Apply pattern:**
   - Follow implementation notes
   - Adapt to specific context
   - Maintain pattern integrity

5. **Feedback loop:**
   - If pattern doesn't work: note why
   - If pattern needs improvement: flag to Aurora
   - If missing pattern discovered: start Workflow 1

---

### Workflow 3: Bulk Curation Sprint

**Scenario:** Team dedicates time to add many patterns quickly

**Setup:**
1. Aurora defines priority categories
2. Team divides work:
   - BOLT → Frontend components
   - COMET → Backend/system patterns
   - Leonardo → Quality pre-screening
   - CODEX → Organization pipeline
   - Aurora → Final approvals

**Execution:**
1. **Discovery phase** (30 min):
   - All team members browse sources
   - Tag candidates with priority
   
2. **Extraction phase** (60 min):
   - BOLT/COMET extract high-priority items
   - Leonardo pre-screens quality
   - Fast rejects to save time

3. **Documentation phase** (60 min):
   - Extractors document while fresh
   - CODEX organizes as they come in
   - Batch files together

4. **Review phase** (30 min):
   - Leonardo reviews batch
   - Aurora final approval batch
   - Fast decisions

5. **Integration phase** (30 min):
   - CODEX commits all approved patterns
   - Update index
   - Update stats

**Output:** 20-50 patterns added in 3-4 hours

---

## Communication Protocols

### Daily Work
- Work asynchronously
- Commit with clear messages
- Tag relevant team members in commits
- Update shared docs (pattern-index.md)

### Questions
1. Check GLOSSARY.md first
2. Check existing patterns for examples
3. Ask in context (tag team member)
4. Escalate to Aurora for decisions

### Conflicts
1. Leonardo vs Aurora on quality → Aurora decides
2. CODEX vs anyone on organization → CODEX decides
3. Technical feasibility disputes → Build team (COMET/BOLT) decides
4. Philosophy disputes → Aurora + Artist decide

---

## Quality Gates

### Gate 1: Sacred Mission Filter
**Blocker:** Any "no" answer

Questions:
1. Responsible?
2. Ethical?
3. Giving?
4. Everyone's but none's?

### Gate 2: Visual Quality
**Reviewer:** Leonardo  
**Criteria:**
- Clear, not blurry
- Professional appearance
- No visual bugs
- Aesthetically pleasing
- Consistent with library quality

### Gate 3: Documentation Completeness
**Reviewer:** CODEX  
**Criteria:**
- All required fields present
- Implementation notes clear
- Accessibility considered
- Examples provided
- Cross-references added

### Gate 4: Design Authority
**Reviewer:** Aurora  
**Criteria:**
- Solves real problem
- Aligns with library vision
- Adds value to collection
- Worth maintaining

**All gates must pass for pattern to enter library.**

---

## Maintenance

### Weekly
- CODEX: Check for broken links
- CODEX: Update pattern-index.md if needed
- Review any flagged patterns

### Monthly
- Aurora: Review library direction
- Team: Identify missing pattern types
- Curation sprint for priority gaps
- Update README stats

### Quarterly
- Full library audit
- Remove outdated patterns
- Consolidate duplicates
- Improve documentation

---

## Success Metrics

### Quantity
- Total patterns in library
- Patterns added per week
- Coverage across categories

### Quality
- Approval rate (accepted / submitted)
- Leonardo rejection rate (quality bar)
- Usage frequency by agents

### Impact
- Time saved per generation
- Quality of generated outputs
- Agent confidence using library

### Compound Effect
- Acceleration of additions over time
- Improved pattern suggestions
- Faster generation speeds

---

## Emergency Procedures

### Pattern Needs Removal
1. Flag to Aurora immediately
2. State reason (ethics, quality, error)
3. Aurora decides: remove or fix
4. If removed: CODEX updates index, removes files
5. Document why (learn from it)

### Bulk Import Failure
1. Stop import
2. Rollback if needed
3. CODEX reviews organization
4. Fix issues
5. Retry in smaller batches

### Category Reorganization
1. CODEX proposes new structure
2. Aurora approves
3. Create migration plan
4. Update all references
5. Move files
6. Update index
7. Test that nothing broke

---

## Getting Started

New team member joining:

1. Read this workflow document
2. Read GLOSSARY.md
3. Browse pattern-index.md
4. Look at 5-10 existing patterns
5. Shadow a senior team member
6. Do first pattern with supervision
7. Get Aurora approval
8. Work independently

---

*♾️ Clear process enables compound velocity*
