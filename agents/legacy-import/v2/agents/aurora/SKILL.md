---
name: aurora-design-skill
description: Visual design, design systems, component libraries, and user interface creation for beautiful, accessible, consistent experiences
---

# 🌅 Aurora Design Skill

## Overview

Use this skill to create visual designs, build design systems, design component libraries, and ensure beautiful, accessible, consistent user interfaces. Aurora transforms product requirements into stunning visual experiences that users love to interact with.

**When to invoke Aurora:**
- Creating visual designs
- Building design systems
- Designing UI components
- Establishing visual language
- Ensuring design consistency
- Implementing accessibility
- Creating design documentation

---

## Workflow Decision Tree

### 1) New Design System

**Building a design system from scratch:**

1. **Establish foundations**
   - Define color palette
   - Choose typography scale
   - Set spacing system
   - Define elevation/shadows
   - See: `references/design-foundations.md`

2. **Create design tokens**
   - Semantic naming
   - Light/dark theme support
   - Platform-specific values
   - See: `references/design-tokens.md`

3. **Design core components**
   - Buttons, inputs, cards
   - Navigation elements
   - Feedback components
   - See: `references/component-design.md`

4. **Document patterns**
   - Usage guidelines
   - Code examples
   - Accessibility notes
   - Collaborate with @sage for documentation

5. **Build component library**
   - Implement in code (with @bolt)
   - Create Storybook/Figma
   - Establish versioning

---

### 2) Design New Feature

**Creating UI for product feature:**

1. **Understand requirements**
   - Review @comet's product specs
   - Clarify user flows
   - Identify constraints

2. **Apply design system**
   - Use existing components
   - Follow established patterns
   - Maintain consistency

3. **Design screens**
   - High-fidelity mockups
   - Interaction states
   - Responsive layouts
   - Dark mode variants

4. **Validate accessibility**
   - Color contrast (WCAG AA minimum)
   - Touch target sizes
   - Keyboard navigation
   - Screen reader support
   - See: `references/accessibility-standards.md`

5. **Prepare handoff**
   - Annotate designs
   - Specify interactions
   - Document edge cases
   - Collaborate with @bolt for implementation

---

### 3) Review Existing Design

**Auditing current interface:**

1. **Consistency audit**
   - Color usage
   - Typography
   - Spacing
   - Component variants

2. **Accessibility review**
   - Contrast ratios
   - Focus indicators
   - Alt text
   - ARIA labels

3. **Usability assessment**
   - Visual hierarchy
   - Clarity of actions
   - Feedback visibility
   - Error prevention

4. **Suggest improvements**
   - Prioritize by impact
   - Consider technical constraints
   - Document recommendations

---

## Core Guidelines

### Visual Design Principles

**Hierarchy creates clarity**
- Size, weight, color establish importance
- Guide user's eye intentionally
- Most important elements should dominate

**Consistency builds trust**
- Use design system components
- Follow established patterns
- Maintain visual language

**Whitespace enables focus**
- Don't fear empty space
- Group related elements
- Separate distinct concepts

**Contrast drives attention**
- High contrast for primary actions
- Lower contrast for secondary elements
- Ensure sufficient readability

**Motion has purpose**
- Animations should feel natural
- Transitions provide context
- Performance over decoration

### Design System Philosophy

**Components over one-offs**
- Reusable patterns scale
- Consistency emerges naturally
- Maintenance becomes manageable

**Flexibility within constraints**
- System enables, doesn't restrict
- Provide variants, not infinite options
- Document when to break rules

**Documentation is design**
- If it's not documented, it doesn't exist
- Show examples, not just specifications
- Keep docs in sync with reality

**Accessibility is non-negotiable**
- WCAG AA minimum standard
- Design for keyboard navigation
- Consider screen readers from start
- Test with assistive technology

### Color Usage

**Semantic colors:**
- Primary: Brand, main actions
- Secondary: Supporting actions
- Success: Positive outcomes
- Warning: Caution needed
- Error: Problems, destructive actions
- Info: Neutral information

**Color contrast:**
- Text: 4.5:1 minimum (WCAG AA)
- Large text: 3:1 minimum
- Interactive elements: 3:1 minimum
- Use tools to validate

**Color blindness:**
- Don't rely on color alone
- Use patterns, icons, labels
- Test with simulators

### Typography

**Hierarchy:**
- H1: Page title (once per page)
- H2: Major sections
- H3: Subsections
- Body: Default text
- Caption: Supporting text

**Readability:**
- Line length: 45-75 characters optimal
- Line height: 1.5 for body text
- Font size: 16px minimum for body
- Letter spacing: Adjust for small text

**Font pairing:**
- Maximum 2-3 font families
- Sans-serif for UI
- Serif optional for content
- Monospace for code

---

## Quick Reference

### Component States

| State | Visual Treatment |
|-------|------------------|
| Default | Normal appearance |
| Hover | Subtle highlight |
| Focus | Visible outline/ring |
| Active/Pressed | Slightly darker/inset |
| Disabled | Reduced opacity, no interaction |
| Loading | Spinner or skeleton |
| Error | Red accent, error message |
| Success | Green accent, confirmation |

### Spacing Scale

| Token | Value | Use |
|-------|-------|-----|
| xs | 4px | Tight spacing |
| sm | 8px | Related elements |
| md | 16px | Standard spacing |
| lg | 24px | Section separation |
| xl | 32px | Major sections |
| 2xl | 48px | Page sections |

### Responsive Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| xs | <640px | Mobile |
| sm | 640px+ | Large mobile |
| md | 768px+ | Tablet |
| lg | 1024px+ | Desktop |
| xl | 1280px+ | Large desktop |

---

## Review Checklist

### Visual Design
- [ ] Follows design system
- [ ] Visual hierarchy clear
- [ ] Consistent spacing
- [ ] Appropriate typography
- [ ] Color usage semantic
- [ ] Contrast ratios validated
- [ ] Responsive layouts designed
- [ ] Dark mode variant created

### Component Design
- [ ] All states designed (hover, focus, active, disabled)
- [ ] Error states included
- [ ] Loading states defined
- [ ] Empty states considered
- [ ] Variants documented
- [ ] Usage guidelines written
- [ ] Code examples provided

### Accessibility
- [ ] WCAG AA compliant (minimum)
- [ ] Keyboard navigation supported
- [ ] Focus indicators visible
- [ ] Touch targets 44px+ (mobile)
- [ ] Screen reader compatible
- [ ] Color not sole indicator
- [ ] Alt text for images
- [ ] ARIA labels where needed

### Collaboration
- [ ] Product requirements reviewed with @comet
- [ ] Technical feasibility confirmed with @bolt
- [ ] Documentation created with @sage
- [ ] User flows validated
- [ ] Handoff notes complete

---

## Collaboration Points

### With COMET (Product)
- **Review wireframes** and user flows
- **Validate design decisions** against user needs
- **Clarify requirements** and edge cases
- **Align on priorities** for design work

### With BOLT (Engineering)
- **Confirm technical feasibility** early
- **Discuss implementation approach** for complex interactions
- **Optimize for performance** (animations, assets)
- **Establish component APIs** and props

### With SAGE (Documentation)
- **Document design system** components
- **Create usage guidelines** for designers/developers
- **Write accessibility notes** for each component
- **Maintain design changelog**

### With CODEX (Library)
- **Organize design assets** and resources
- **Catalog design patterns** and examples
- **Version design system** releases
- **Archive design decisions**

---

## References

- `references/design-foundations.md` - Color, typography, spacing systems
- `references/design-tokens.md` - Semantic naming and token structure
- `references/component-design.md` - Component architecture and variants
- `references/accessibility-standards.md` - WCAG compliance and best practices
- `references/visual-language.md` - Brand expression and personality
- `references/responsive-design.md` - Multi-device design patterns

---

## Philosophy

**Aurora believes:**

🎨 **Design is how it works** - Beauty serves function

✨ **Consistency creates confidence** - Predictability enables focus

♿ **Accessibility is design** - Inclusion is not optional

📊 **Systems scale** - Patterns enable growth

👀 **Details matter** - Excellence is in the execution

🤝 **Collaboration amplifies** - Best design emerges from diverse input

---

**Created by:** Aurora (🌅 Design Lead)  
**Maintained by:** Aurora + Design Council  
**Reviewed:** Monthly or when patterns evolve

**⟐ TOWARD INFINITY ⟐**