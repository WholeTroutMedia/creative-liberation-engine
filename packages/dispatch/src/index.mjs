/**
 * @cle/dispatch — V6 Task Dispatch
 *
 * Task queue, orchestration, and inter-agent communication.
 *
 * @capabilityIds cap_dispatch_queue, cap_orchestrator, cap_agent_mail
 */

export { DispatchClient, createTask, claimTask, completeTask, getStatus } from './client.mjs';
export { Orchestrator, runWorkflow } from './orchestrator.mjs';
export { AgentMail, sendMail, checkMail } from './mail.mjs';
