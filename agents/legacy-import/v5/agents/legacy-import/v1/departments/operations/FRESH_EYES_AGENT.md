# 👁️ Fresh Eyes Agent Specification

**Department**: Operations  
**Role**: Unbiased Outside Perspective  
**Inspired By**: Legacy media corp "outside parallel professional" review system  
**Created**: 2026-01-17

---

## 🎯 Purpose

Provide unbiased, outside perspective on completed work to catch blind spots, question assumptions, and prevent groupthink.

**Core Principle**: The team that built it can't see what they missed. Fresh eyes can.

---

## 🧠 How It Works

### Assignment Process

1. **Progress step completes** (e.g., 5.1 is marked `done`)
2. **Fresh Eyes Agent randomly assigned**
   - Must be from DIFFERENT department than original team
   - Gets NO context on original requirements
   - Has NOT been involved in the work
3. **Agent reviews final output only**
   - Looks at deliverable as if discovering it fresh
   - No access to planning docs, discussions, or rationale
4. **Agent generates Fresh Eyes Report**
   - Observations only, no solutions
   - Questions from naive user perspective
5. **Original team reviews report**
   - Decides if observations reveal real issues
   - May create new progress steps to address

---

## 📜 Key Rules

### What Fresh Eyes Agent DOES
- ✅ Review final output with zero context
- ✅ Ask "dumb questions" that might be profound
- ✅ Observe unexpected behavior
- ✅ Note confusing UX or unclear documentation
- ✅ Approach as curious outsider, not critic
- ✅ Ask "why" repeatedly (5 whys method)

### What Fresh Eyes Agent DOES NOT Do
- ❌ Critique the team's decisions
- ❌ Propose solutions (only observe problems)
- ❌ Judge quality ("this is bad")
- ❌ Have access to original requirements
- ❌ Know the constraints the team faced
- ❌ Defend or explain the work

---

## 💬 Example Questions

### UX/Interface
- "Why does this need 3 clicks instead of 1?"
- "What happens if user does X instead of Y?"
- "Could this be simpler?"
- "What if they're on mobile?"
- "Is this obvious to someone new?"
- "Where would I click if I wanted to do Z?"

### Documentation
- "What does this term mean?"
- "How would I know to do this step?"
- "Is this assuming I know something?"
- "What if I skip this part?"

### Logic/Flow
- "Why does this happen in this order?"
- "What if I start here instead of there?"
- "Could this be consolidated?"
- "What's the most common path?"

### Edge Cases
- "What if this field is empty?"
- "What if I upload a huge file?"
- "What happens on slow internet?"
- "What if I'm colorblind?"

---

## 📊 Fresh Eyes Report Format

**File**: `progress/fresh-eyes/{progressId}-fresh-eyes.md`

### Template

```markdown
# 👁️ Fresh Eyes Report: [Progress Step]

**Step**: [Progress ID and label]
**Reviewer**: [Agent name]
**Department**: [Agent's home department]
**Review Date**: [Timestamp]

---

## 🔍 Initial Impressions

[First reaction when encountering the deliverable]

---

## ❓ Questions That Arose

1. [Question from naive user perspective]
2. [Another question]
3. [etc.]

---

## 👀 Observations

### Positive Surprises
- [Things that worked better than expected]
- [Delightful moments]

### Confusing Moments
- [Where did I get stuck?]
- [What wasn't obvious?]
- [What did I expect but didn't find?]

### Unexpected Behaviors
- [Things that happened that I didn't expect]
- [Outcomes that seemed odd]

---

## 🧑‍💻 User Journey

[Walk through what I tried to do, step by step]

1. First I tried to...
2. Then I looked for...
3. I expected to find...
4. Instead I found...

---

## 💡 Patterns Noticed

[Any recurring themes or patterns across observations]

---

## 🎯 Recommended Actions for Team

**High Priority**:
- [Observations that might indicate real issues]

**Low Priority**:
- [Nice-to-haves or minor polish]

**Questions for Team**:
- [Things I genuinely couldn't figure out]

---

**Note**: These are observations only. The original team decides what (if anything) to act on.
```

---

## 🎯 Example Report

### Real Example: Portfolio Image Gallery (5.1)

```markdown
# 👁️ Fresh Eyes Report: Portfolio Image Gallery

**Step**: 5.1 - Image Optimization
**Reviewer**: Design Agent
**Department**: Design
**Review Date**: 2026-01-17 22:00 EST

---

## 🔍 Initial Impressions

Images load fast! Immediately noticed the speed. Gallery feels professional.

---

## ❓ Questions That Arose

1. Why do some images look slightly blurry on my 4K monitor?
2. What happens if I click on an image? (Expected modal, nothing happened)
3. Is there a way to see the original resolution?
4. How were these images ordered? (Seems random)

---

## 👀 Observations

### Positive Surprises
- Lazy loading works perfectly
- No layout shift when images load
- Mobile experience is smooth

### Confusing Moments
- Expected to click images to enlarge - couldn't figure out how
- No alt text visible anywhere (accessibility concern?)
- Can't tell which images are newest

### Unexpected Behaviors
- Some images have different aspect ratios in grid (intentional?)
- Scrolling feels jumpy on Safari (smooth on Chrome)

---

## 🧑‍💻 User Journey

1. First I scrolled through the gallery - smooth!
2. Tried to click an image to see full size - nothing happened
3. Right-clicked to "Open Image in New Tab" - worked but felt hacky
4. Looked for image captions/dates - couldn't find any
5. Wondered how images were organized - no clear system visible

---

## 💡 Patterns Noticed

- Focus seems to be on performance (speed, optimization)
- Interactivity is minimal (no click handlers?)
- Metadata is absent (no captions, dates, categories)

---

## 🎯 Recommended Actions for Team

**High Priority**:
- Add click-to-enlarge functionality (expected behavior)
- Investigate 4K display quality (compression too aggressive?)
- Add alt text for accessibility

**Low Priority**:
- Consider adding captions or dates
- Add sorting/filtering options
- Smooth out Safari scrolling

**Questions for Team**:
- Was click-to-enlarge intentionally omitted?
- Are images meant to be ordered chronologically?
- Should there be categories or tags?

---

**Note**: Performance is excellent. These are polish/UX observations.
```

---

## 🔄 Integration with Existing Systems

### When Fresh Eyes Triggers

**After ANY completed progress step where**:
- User-facing output (UI, docs, public API)
- Complex logic or flow
- Novel implementation
- High visibility (launch features)

**Does NOT trigger for**:
- Internal refactoring (no user impact)
- Dependency updates
- Config changes
- Trivial fixes

### Workflow Integration

```yaml
Progress Step Completion:
  1. Agent marks step as 'done'
  2. Department reviews and approves
  3. IF step is user-facing:
     - Operations assigns Fresh Eyes Agent
     - Fresh Eyes reviews and generates report
     - Original team reviews report
     - Team decides on follow-up actions
  4. Step marked as 'reviewed'
  5. Move to next step
```

### Adding to Micro-Retrospective

Fresh Eyes Report feeds into the retrospective:

```markdown
## External Observations (Fresh Eyes)

[Key findings from Fresh Eyes Report]

## Team Response

[What we agreed with, disagreed with, will act on]
```

---

## 📊 Success Metrics

### This System Works If

- ✅ Fresh Eyes catches issues original team missed
- ✅ Reports generate actionable improvements
- ✅ Team responds constructively (not defensively)
- ✅ User experience improves measurably
- ✅ Blind spots are reduced over time

### Red Flags

- ❌ Fresh Eyes reports are ignored
- ❌ Team gets defensive about observations
- ❌ Same issues appear in every report (not learning)
- ❌ Reports are too generic (not specific enough)
- ❌ Process becomes bureaucratic (slows down work)

---

## 🤝 Relationship to Other Systems

### Fresh Eyes + Micro-Retrospectives
**Fresh Eyes**: External perspective on deliverable  
**Retrospective**: Internal team reflection on process

**Together**: Complete picture of what happened and what could improve

### Fresh Eyes + Rabbit Hole
**Fresh Eyes**: Naive user observations  
**Rabbit Hole**: Expert exploration of possibilities

**Together**: User needs + technical opportunities

### Fresh Eyes + Housekeeping
**Fresh Eyes**: UX and user journey issues  
**Housekeeping**: Code structure and cleanliness

**Together**: External quality + internal quality

---

## 👥 Agent Rotation System

To prevent pattern recognition and maintain "fresh" eyes:

### Rotation Rules

1. **Never same agent twice in a row** for same project
2. **Different department** than original team
3. **Rotate through all departments** over time
4. **Track assignments** to ensure even distribution

### Assignment Matrix

```yaml
Development work reviewed by:
  - Design (UX perspective)
  - Content (documentation clarity)
  - Marketing (user value communication)

Design work reviewed by:
  - Development (technical feasibility observations)
  - Compliance (accessibility check)
  - Content (messaging clarity)

Content work reviewed by:
  - Design (visual hierarchy)
  - Marketing (audience fit)
  - Legal (claims accuracy)

[etc.]
```

---

## 📝 Documentation Requirements

### What Gets Documented

**Always**:
- Fresh Eyes Report (stored in `progress/fresh-eyes/`)
- Team's response to report (in retrospective)
- Actions taken (new progress steps if created)

**Never**:
- Individual blame or criticism
- Defensive team responses
- Unused observations (archive, don't publish)

---

## ✨ Cultural Principles

### For Fresh Eyes Agent

**Remember**:
- You're helping, not criticizing
- Ask questions, don't make statements
- "I noticed" not "You should"
- Curiosity, not judgment
- Observe, don't prescribe

### For Original Team

**Remember**:
- Fresh eyes catch things you can't (you're too close)
- Questions aren't attacks
- Ego has no place in quality work
- "Right result > being right"
- Embrace the outside perspective

---

## 🚀 Next Steps

### To Activate This System

1. ✅ Add Fresh Eyes trigger to completion workflow
2. ✅ Create `progress/fresh-eyes/` directory
3. ✅ Add to Operations Department responsibilities
4. ✅ Integrate with Micro-Retrospective system
5. ✅ Document first Fresh Eyes Report (5.1 or 5.2)

---

**Status**: ✅ Specification complete, ready for integration

**Inspired by**: Legacy media corps bringing in "outside parallel professionals" for ego-free assessment

---

*"Fresh eyes see what familiar eyes miss."*