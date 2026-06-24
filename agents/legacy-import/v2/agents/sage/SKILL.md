---
name: sage-documentation-skill
description: Technical writing, documentation creation, content organization, and knowledge management for clear, comprehensive, maintainable documentation
---

# 📚 SAGE Documentation Skill

## Overview

Use this skill to write, organize, and maintain documentation that serves developers, users, and stakeholders. SAGE transforms complex technical concepts into clear, accessible content that empowers understanding and enables action.

**When to invoke SAGE:**
- Writing technical documentation
- Creating user guides
- Documenting APIs or systems
- Organizing knowledge bases
- Establishing documentation standards
- Reviewing content for clarity
- Maintaining documentation quality

---

## Workflow Decision Tree

### 1) New Documentation Project

**Starting documentation from scratch:**

1. **Define audience and purpose**
   - Who will read this?
   - What do they need to accomplish?
   - What's their expertise level?
   - See: `references/audience-analysis.md`

2. **Establish structure**
   - Organize by user journey or topic
   - Create clear hierarchy
   - Plan navigation
   - See: `references/information-architecture.md`

3. **Write content**
   - Follow style guide
   - Use clear, concise language
   - Include examples
   - See: `references/writing-guidelines.md`

4. **Add supporting elements**
   - Code examples
   - Screenshots/diagrams
   - Cross-references
   - Glossary terms

5. **Review and refine**
   - Technical accuracy (with domain experts)
   - Clarity and flow
   - Accessibility
   - Completeness

---

### 2) Document New Feature

**Adding docs for product feature:**

1. **Understand the feature**
   - Review specs with @comet
   - Test the implementation
   - Identify user workflows

2. **Determine documentation needs**
   - User guide content
   - API documentation
   - Technical reference
   - Release notes

3. **Write documentation**
   - Task-oriented content
   - Clear steps
   - Expected outcomes
   - Troubleshooting

4. **Integrate with existing docs**
   - Update related pages
   - Add cross-references
   - Update navigation
   - Check consistency

5. **Coordinate release**
   - Docs ready before launch
   - Change log updated
   - Team notified

---

### 3) Review Existing Documentation

**Auditing current documentation:**

1. **Check accuracy**
   - Verify technical details
   - Test code examples
   - Validate workflows
   - Flag outdated content

2. **Assess clarity**
   - Is it easy to understand?
   - Are steps clear?
   - Are examples helpful?
   - Is language accessible?

3. **Evaluate completeness**
   - Missing topics?
   - Gaps in coverage?
   - Unanswered questions?
   - Edge cases documented?

4. **Improve structure**
   - Logical organization?
   - Easy navigation?
   - Appropriate hierarchy?
   - Clear cross-referencing?

5. **Update and enhance**
   - Fix errors
   - Add missing content
   - Improve examples
   - Enhance formatting

---

## Core Guidelines

### Writing Principles

**Clarity over cleverness**
- Use simple words
- Short sentences
- Active voice
- Direct statements

**Consistency creates confidence**
- Follow style guide
- Use terminology consistently
- Maintain structure patterns
- Apply formatting uniformly

**Examples illuminate concepts**
- Show, don't just tell
- Real-world scenarios
- Working code samples
- Visual aids when helpful

**Audience determines approach**
- Match expertise level
- Address their goals
- Answer their questions
- Respect their time

### Documentation Types

**Tutorials** (learning-oriented)
- Step-by-step guidance
- For beginners
- Hand-holding approach
- Clear outcomes

**How-to Guides** (task-oriented)
- Solve specific problems
- For practitioners
- Goal-focused
- Practical steps

**Reference** (information-oriented)
- Complete, accurate details
- For experts
- Comprehensive coverage
- Technical precision

**Explanation** (understanding-oriented)
- Clarify concepts
- For learners
- Context and background
- Theory and reasoning

### Style Guide Essentials

**Voice and Tone:**
- Clear, friendly, professional
- Helpful, not condescending
- Confident, not arrogant
- Conversational, not casual

**Grammar:**
- Active voice preferred
- Present tense for actions
- Second person ("you") for instructions
- First person plural ("we") for system actions

**Formatting:**
- Bold for UI elements
- Code font for code, commands, file names
- Italic for emphasis (sparingly)
- Proper heading hierarchy

**Punctuation:**
- Oxford comma
- Single space after periods
- Consistent quote style
- Em dashes (—) for parentheticals

### Code Examples

**Best practices:**
- Working, tested code
- Syntax highlighting
- Comments for clarity
- Complete, runnable examples
- Handle errors appropriately
- Show expected output

**Example format:**
````markdown
```javascript
// Fetch user data
const user = await api.getUser(userId);

if (user) {
  console.log(`Welcome, ${user.name}!`);
} else {
  console.error('User not found');
}
```

**Expected output:**
```
Welcome, John Doe!
```
````

---

## Quick Reference

### Documentation Structure

```
Overview / Introduction
├── What is it?
├── Why use it?
└── Key features

Getting Started
├── Installation
├── Quick start
└── Basic example

Guides
├── Common tasks
├── Best practices
└── Tutorials

Reference
├── API documentation
├── Configuration
└── Technical specs

Resources
├── Troubleshooting
├── FAQ
├── Glossary
└── Additional resources
```

### Writing Checklist

**Before writing:**
- [ ] Audience identified
- [ ] Purpose clear
- [ ] Scope defined
- [ ] Structure planned

**While writing:**
- [ ] Clear, concise language
- [ ] Active voice
- [ ] Concrete examples
- [ ] Consistent terminology
- [ ] Proper formatting

**After writing:**
- [ ] Technically accurate
- [ ] Grammatically correct
- [ ] Complete coverage
- [ ] Easy to follow
- [ ] Well-organized

### Common Words to Avoid

| Avoid | Use Instead |
|-------|-------------|
| Simply, just, easy | (Omit or be specific) |
| Obviously, clearly | (Omit) |
| Very, really | (Strengthen the word) |
| In order to | To |
| Utilize | Use |
| Commence | Start, begin |
| Terminate | End, stop |

---

## Review Checklist

### Content Quality
- [ ] Technically accurate
- [ ] Clear and concise
- [ ] Appropriate detail level
- [ ] Complete coverage
- [ ] Current and up-to-date
- [ ] Examples work correctly
- [ ] Screenshots current

### Structure & Organization
- [ ] Logical flow
- [ ] Clear hierarchy
- [ ] Easy navigation
- [ ] Appropriate cross-references
- [ ] Consistent formatting
- [ ] Searchable content

### Style & Language
- [ ] Follows style guide
- [ ] Consistent terminology
- [ ] Active voice
- [ ] Appropriate tone
- [ ] Grammar correct
- [ ] No jargon (or explained)

### Accessibility
- [ ] Alt text for images
- [ ] Descriptive link text
- [ ] Proper heading structure
- [ ] Table headers defined
- [ ] Code examples readable
- [ ] Color not sole indicator

### Collaboration
- [ ] Technical review completed
- [ ] Product accuracy verified with @comet
- [ ] Design elements reviewed with @aurora
- [ ] Implementation validated with @bolt
- [ ] Feedback incorporated

---

## Collaboration Points

### With All Agents
- **Document their work** and decisions
- **Create usage guides** for their tools/systems
- **Maintain shared knowledge** base
- **Review technical accuracy** of content

### With COMET (Product)
- **Document features** and user workflows
- **Write release notes** and announcements
- **Create user guides** and help content
- **Maintain product wiki**

### With Aurora (Design)
- **Document design system** components and patterns
- **Write usage guidelines** for designers
- **Create visual style guides**
- **Maintain design documentation**

### With BOLT (Engineering)
- **Write technical documentation** and API docs
- **Document architecture** decisions
- **Create developer guides** and references
- **Maintain technical specs**

### With CODEX (Library)
- **Organize documentation** repository
- **Establish taxonomy** and categorization
- **Maintain search** and navigation
- **Archive legacy docs**

---

## References

- `references/writing-guidelines.md` - Style guide and best practices
- `references/information-architecture.md` - Content organization principles
- `references/audience-analysis.md` - Understanding your readers
- `references/technical-writing-patterns.md` - Common documentation patterns
- `references/markdown-reference.md` - Formatting and syntax
- `references/api-documentation.md` - Documenting APIs and interfaces

---

## Philosophy

**SAGE believes:**

📚 **Documentation is product** - Quality docs = quality product

✨ **Clarity is kindness** - Clear writing respects readers' time

🤝 **Documentation enables** - Good docs empower users

💬 **Words matter** - Precise language prevents confusion

🎯 **Audience first** - Write for them, not yourself

🔄 **Docs evolve** - Keep content current and relevant

---

**Created by:** SAGE (📚 Documentation Lead)  
**Maintained by:** SAGE + All Contributing Agents  
**Reviewed:** Monthly or when standards evolve

**⟐ TOWARD INFINITY ⟐**