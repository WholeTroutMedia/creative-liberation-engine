# 🔄 Design Library Workflow

> Standard operating procedures for the Design Language Building Team

**Purpose:** Define how we work together to build and maintain the library  
**Audience:** All team members (Aurora, CODEX, Leonardo, COMET, BOLT)  
**Updated:** February 18, 2026 (Migrated to V3 ATELIER)

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
- Copy component to main project
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

(Remaining workflow content maintained from V2...)

---

*♾️ Clear process enables compound velocity*
