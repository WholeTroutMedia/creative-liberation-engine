---
name: Metricool Campaigner
description: Skill for composing, formatting, validating, and scheduling multi-channel social media campaigns using the Metricool client service.
---

# Metricool Campaigner — Social Media Automation Skill

This skill teaches the Creative Liberation Engine agentic swarms (Copywriter, Typographer, VFX, and QA) how to compose, format, validate, and schedule social media campaigns through Metricool.

## When to Use This Skill

Activate this skill when:
- The user requests to "schedule a post", "publish a campaign", or "queue a social update".
- A project reaches a milestone and needs automated social broadcasting.
- Collecting and reporting social platform metrics/analytics.

---

## Operating Swarm Roles

- **Copywriter Agent:** Crafts targeted text variations for different platforms (X, LinkedIn, Instagram).
- **Visual FX & Typographer:** Normalizes, scales, and prepares images/video assets.
- **Systems QA:** Audits character limits, formatting, and link structures before scheduling.
- **Integration Specialist:** Executes MCP tools (`metricool_schedule_post`) using the generated drafts.

---

## Platform Compliance Guidelines

The Systems QA agent must enforce these guidelines before calling the scheduler tool:

### 1. X / Twitter
- **Character Limit:** Strictly 280 characters.
- **Formatting:** Keep hooks punchy. Limit hashtags to 1-2 relevant tags.
- **Media:** Supported (Images/Videos).

### 2. LinkedIn
- **Character Limit:** Up to 3,000 characters.
- **Formatting:** Focus on professional storytelling, carriage returns (whitespace) for readability, and place links/calls-to-action clearly.
- **Hashtags:** Use 3-5 broad professional tags (e.g., #AI, #Innovation).

### 3. Instagram
- **Character Limit:** Up to 2,200 characters.
- **Media Requirement:** **Mandatory**. Post will fail without an attached image or video.
- **Hashtags:** Add up to 10-15 targeted tags.

### 4. Facebook
- **Character Limit:** Up to 63,000 characters.
- **Formatting:** Community-focused, friendly tone, direct call-to-action link.

---

## Step-by-Step Execution Protocol

### Step 1: Draft Compilation
The **Copywriter** generates platform-specific variations of the message text.
*Example:*
* LinkedIn: Deep-dive context and technical insights.
* X: Punchy, short summaries.

### Step 2: Media Preparation
The **VFX & Typographer** agents compile the public URLs for any visual assets. If they are local files, they must be uploaded to a public repository (e.g., CLE media bucket) to get a public URL for Metricool's normalization endpoint.

### Step 3: Compliance Check (QA Gate)
The **Systems QA** agent validates:
1. That character constraints are met for each selected network.
2. That all URLs inside the copy are valid and accessible.
3. That media requirements are satisfied (e.g., Instagram has media).

### Step 4: Dispatch Scheduling
The **Integration Specialist** calls:
```typescript
metricool_schedule_post({
  text: "Copy text here",
  dateTime: "YYYY-MM-DDTHH:mm:ss",
  timezone: "America/New_York",
  networks: ["twitter", "linkedin"],
  mediaUrls: ["https://picsum.photos/800/600"]
});
```

---

## Analytics Optimization Loop

Weekly or post-campaign, the STRATA agent should call `metricool_get_analytics` for active channels to:
1. Identify high-performing posts (impressions, clicks, shares).
2. Report engagement rates back to the team.
3. Feed the feedback metrics into future copywriting loops.
