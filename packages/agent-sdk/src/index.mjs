/**
 * @cle/agent-sdk — V6 Agent Development Kit
 *
 * Framework for building, deploying, and managing autonomous agents.
 * Includes browser automation (CLE Browser) and security (SPECTRE).
 *
 * @capabilityIds cap_cle_agent_sdk, cap_cle_browser, cap_spectre_security
 */

export { Agent, createAgent, defineSkill, defineWorkflow } from './agent.mjs';
export { CLEBrowser, browse, screenshot, scrape } from './browser.mjs';
export { Spectre, validateAuth, enforcePolicy, auditAction } from './security.mjs';
