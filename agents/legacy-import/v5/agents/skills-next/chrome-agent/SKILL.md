# SKILL: chrome-agent

## Identity
**Skill ID:** `chrome-agent`
**Name:** Chrome Agent (Web Operator)
**Kind:** `next_skill`
**Source:** `v6-next`

## Description
Autonomous Chrome integration leveraging Playwright, CDP (Chrome DevTools Protocol), and VLM (Vision-Language Model) lenses for end-to-end DOM manipulation and visual orchestration. This acts as the execution bridge for navigating, extracting, and manipulating the live web without relying on fragile DOM selectors.

## Capabilities
1. **CDP AOM Extraction:** Reads the Accessibility Object Model directly via Chrome DevTools Protocol for semantic page understanding.
2. **VLM Bounding Box Resolution:** Takes viewport screenshots and uses Gemini Pro/Flash to identify interactive elements.
3. **Stealth Execution:** Masks headless browser traits to avoid Cloudflare/Akamai blocking.
4. **Local Extension Bridge:** Connects to the CLE Bridge Chrome Extension for executing actions in the user's active desktop session.

## Contracts
- Inputs: `target_url`, `intent`, `action_sequence`
- Outputs: `viewport_screenshot`, `extracted_data`, `execution_trace`
- Schema: Follows standard `V6_CONSTITUTION.md` execution directives.

## Execution Path
`services/chrome-agent/executor.py`
