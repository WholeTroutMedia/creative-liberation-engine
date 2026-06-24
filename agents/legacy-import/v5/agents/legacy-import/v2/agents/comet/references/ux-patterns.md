# 🎨 UX Patterns

**Common User Experience Patterns and When to Use Them**

---

## Navigation Patterns

### Tab Navigation

**Use when:**
- 3-5 top-level sections
- Users switch between sections frequently
- Content at same hierarchy level

**Best practices:**
- Keep labels short (1-2 words)
- Use icons + labels for clarity
- Highlight active tab
- Make entire tab area tappable

**Example use cases:**
- App main navigation
- Settings categories
- Data views (table, chart, map)

---

### Hamburger Menu

**Use when:**
- Many navigation options
- Secondary/occasional navigation
- Space-constrained layout

**Best practices:**
- Show most important options first
- Group related items
- Include search for long lists
- Consider discoverability trade-off

**Alternatives to consider:**
- Tab bar (for primary navigation)
- Bottom sheet (for contextual actions)
- Progressive disclosure (for complex hierarchies)

---

### Breadcrumbs

**Use when:**
- Deep hierarchical navigation
- Users need context of location
- Multiple paths to same content

**Best practices:**
- Show full path
- Make each level clickable
- Truncate intelligently on mobile
- Use separators (>, /, →)

---

## Form Patterns

### Progressive Disclosure

**Use when:**
- Forms have many fields
- Some fields depend on others
- Users might be overwhelmed

**Best practices:**
- Show one section at a time
- Indicate progress
- Allow going back
- Save draft state

**Example:**
```
Step 1: Basic Info
  → Show fields
  → "Continue" button
  
 Step 2: Additional Details
   → Show more fields
   → "Continue" button
   
Step 3: Review & Submit
  → Summary view
  → "Submit" button
```

---

### Inline Validation

**Use when:**
- Forms have validation rules
- Users might make mistakes
- Immediate feedback helps

**Best practices:**
- Validate on blur, not on every keystroke
- Show success states too (green checkmark)
- Be specific about what's wrong
- Suggest fixes when possible

**Example:**
```
❌ Email: "Must be valid email address"
✅ Password: "Strong password"
⚠️ Username: "Already taken. Try username123?"
```

---

### Smart Defaults

**Use when:**
- Most users pick same option
- You can predict user intent
- Reducing friction matters

**Best practices:**
- Pre-select common choices
- Use previous values when appropriate
- Make defaults obvious, not hidden
- Allow easy changes

**Example:**
- Country: User's detected location
- Date: Today's date
- Quantity: 1
- Notifications: Based on previous preferences

---

## Feedback Patterns

### Loading States

**Types:**

**1. Skeleton Screens**
- Use for: Predictable content layout
- Shows: Gray placeholder of final content
- Best for: Lists, cards, content pages

**2. Spinners**
- Use for: Indeterminate waits
- Shows: Rotating indicator
- Best for: Short waits (<2 seconds)

**3. Progress Bars**
- Use for: Determinant processes
- Shows: % completion
- Best for: Uploads, downloads, multi-step processes

**4. Optimistic UI**
- Use for: Fast perceived performance
- Shows: Success immediately, roll back if fails
- Best for: Social interactions (likes, follows)

**Best practices:**
- Show loading state immediately
- Indicate progress if known
- Provide context ("Loading messages...")
- Don't block entire UI unless necessary

---

### Empty States

**Use when:**
- No content to show yet
- Search returns no results
- Data hasn't loaded
- Feature is unused

**Best practices:**
- Explain why it's empty
- Provide clear call-to-action
- Offer help or examples
- Use friendly illustration/copy

**Example:**
```
📬 No messages yet

Your inbox is empty. 
When someone sends you a message, it'll appear here.

[Start Conversation] button
```

---

### Error States

**Levels:**

**1. Inline Errors** (field-level)
- Show next to problematic field
- Explain what's wrong
- Suggest fix

**2. Form Errors** (form-level)
- Show at top of form
- List all errors
- Link to fields

**3. Page Errors** (page-level)
- Explain what happened
- Offer recovery action
- Provide support link

**Best practices:**
- Be specific, not generic
- Use plain language, not error codes
- Offer actionable solutions
- Don't blame user
- Provide escape route

**Good:**
- ❌ "Email already registered. [Sign in instead?]"

**Bad:**
- ❌ "Error 409: Conflict"

---

### Success Confirmations

**Use when:**
- User completes important action
- Result isn't immediately visible
- Confidence boost matters

**Types:**

**1. Toast/Snackbar** (temporary)
- Brief confirmation
- Auto-dismisses
- Doesn't block interaction

**2. Success Page** (permanent)
- Important confirmations
- Provides next steps
- User must dismiss

**3. Inline Success** (contextual)
- Checkmarks on completed items
- Green highlights
- Status updates

**Best practices:**
- Match severity to importance
- Keep toast messages brief (1-2 lines)
- Provide undo when possible
- Include next action

---

## Search Patterns

### Autocomplete/Type-Ahead

**Use when:**
- Predictable search terms
- Large dataset
- Helping user find quickly

**Best practices:**
- Show results after 2-3 characters
- Highlight matching text
- Show top 5-10 results
- Include "See all results" option
- Allow keyboard navigation

---

### Filters and Facets

**Use when:**
- Many results to narrow
- Multiple filter dimensions
- Users exploring options

**Best practices:**
- Show filter counts
- Allow multiple selections
- Provide clear/reset
- Show applied filters
- Persist filter state

**Pattern:**
```
Category (23)
  ☑️ Electronics (12)
  ☐ Clothing (8)
  ☐ Books (3)
  
Price
  ☐ Under $50 (15)
  ☑️ $50-$100 (5)
  ☐ Over $100 (3)

[Clear Filters] [23 Results]
```

---

### Search Results

**Best practices:**
- Show result count
- Highlight search terms
- Sort by relevance
- Offer alternative spellings
- Handle no results gracefully
- Provide filters
- Save recent searches

**No results pattern:**
```
No results for "produktt"

Did you mean "product"?

Try:
- Checking spelling
- Using different keywords
- Browsing categories

[Popular searches: feature, pricing, support]
```

---

## Content Patterns

### Cards

**Use when:**
- Displaying heterogeneous content
- Content is scannable
- Actions are item-specific

**Best practices:**
- Consistent card structure
- Clear visual hierarchy
- Actionable areas well-defined
- Appropriate for content type

**Variations:**
- Image + title + description
- Icon + title + metadata
- Preview + actions

---

### Lists

**Use when:**
- Homogeneous content
- Density matters
- Scanning is primary task

**Best practices:**
- Consistent row height
- Clear visual separation
- Highlight on hover/select
- Support keyboard navigation

---

### Infinite Scroll

**Use when:**
- Continuous browsing
- No clear ending
- Mobile-first experience

**Best practices:**
- Show loading indicator
- Maintain scroll position on back
- Provide "load more" button fallback
- Consider pagination for desktop

**Avoid when:**
- Users need footer
- Precise navigation needed
- SEO is critical

---

## Action Patterns

### Primary vs. Secondary Actions

**Primary action:**
- Most important/common action
- Visually prominent
- One per screen/context
- Clear call-to-action

**Secondary actions:**
- Alternative actions
- Less visually prominent
- Multiple allowed
- Often text-only or outlined

**Example:**
```
[Save Changes] <- Primary (filled button)
[Cancel] <- Secondary (text button)
```

---

### Destructive Actions

**Use when:**
- Action can't be easily undone
- Data will be deleted
- Significant consequences

**Best practices:**
- Confirm before executing
- Explain what will happen
- Provide undo when possible
- Use red/warning color
- Require explicit confirmation

**Confirmation pattern:**
```
Delete account?

This will permanently delete:
- All your data
- Your profile
- Your settings

This action cannot be undone.

[Cancel] [Delete Account]
        ^
        Red, requires typing "DELETE" to enable
```

---

### Bulk Actions

**Use when:**
- Users manage multiple items
- Efficiency matters
- Same action applies to many

**Best practices:**
- Clear selection state
- Show count of selected
- Provide select all/none
- Confirm bulk destructive actions
- Show progress for slow actions

**Pattern:**
```
☑️ [Select All] (3 selected)

☑️ Item 1
☑️ Item 2
☑️ Item 3
☐ Item 4

[Delete] [Archive] [Move]
```

---

## Modal Patterns

### When to Use Modals

**Good uses:**
- Critical information
- Focused task completion
- Confirmation dialogs
- Temporary detours

**Bad uses:**
- Complex multi-step flows
- Large amounts of content
- Frequent interruptions
- When inline would work

---

### Modal Best Practices

- **Escapable:** ESC key closes, click outside closes
- **Focused:** Trap focus within modal
- **Clear purpose:** Title explains what it is
- **Clear actions:** Primary and secondary actions obvious
- **Appropriate size:** Not too large, not too small
- **Accessible:** Screen reader friendly

---

### Bottom Sheets (Mobile)

**Use when:**
- Mobile-first design
- Contextual actions
- Filters or options
- Quick inputs

**Best practices:**
- Swipe to dismiss
- Partial vs. full height appropriately
- Handle keyboard appearance
- Show drag handle

---

## Accessibility Patterns

### Focus Management

**Best practices:**
- Visible focus indicator
- Logical tab order
- Skip links for long pages
- Focus trapping in modals
- Restore focus on close

---

### Screen Reader Support

**Best practices:**
- Semantic HTML
- ARIA labels when needed
- Alt text for images
- Form labels
- Error announcements
- Loading state announcements

---

### Keyboard Navigation

**Support:**
- Tab: Next element
- Shift+Tab: Previous element
- Enter/Space: Activate
- ESC: Close/cancel
- Arrow keys: Within components

---

## Mobile-Specific Patterns

### Touch Targets

**Minimum size:** 44x44 pixels (iOS), 48x48 pixels (Android)

**Best practices:**
- Adequate spacing between targets
- Larger for primary actions
- Entire element tappable
- Visual feedback on tap

---

### Gestures

**Standard gestures:**
- Tap: Select/activate
- Long press: Context menu
- Swipe: Navigate/delete
- Pinch: Zoom
- Pull to refresh: Update content

**Best practices:**
- Provide alternative non-gesture methods
- Visual cues for gesture availability
- Don't override standard gestures
- Test with one hand

---

### Thumb Zones

**Most reachable:** Bottom center of screen

**Hard to reach:** Top corners

**Design accordingly:**
- Primary actions: Bottom
- Navigation: Bottom or top (consistent)
- Secondary actions: Top
- Content: Scrollable area

---

## When to Break Patterns

**Consider breaking patterns when:**
- Innovation provides clear benefit
- Standard pattern doesn't fit use case
- Users expect something different
- Brand differentiation matters

**Don't break patterns for:**
- Visual novelty alone
- Making something "unique"
- Personal preference
- Because you can

**Test new patterns thoroughly.**

---

## Resources

**Pattern libraries to reference:**
- Apple Human Interface Guidelines
- Material Design (Google)
- Microsoft Fluent Design
- Carbon Design System (IBM)
- Atlassian Design System

**For Creative Liberation Engine:**
- Nexus Design System (when it exists)
- Aurora's component library

---

**Patterns are starting points, not rigid rules.**

Adapt them to:
- Your users
- Your context
- Your constraints
- Your brand

But understand WHY a pattern exists before changing it.

---

**Created by:** COMET  
**Last Updated:** 2026-01-28  
**Next Review:** 2026-04-28

**⟐ TOWARD INFINITY ⟐**