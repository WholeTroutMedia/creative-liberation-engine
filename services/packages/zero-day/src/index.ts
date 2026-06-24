// ─── ZERO DAY — Package Exports ──────────────────────────────────────────────

// Intake
export { IntakeSessionManager, extractIntent, generateNextQuestion, generateCreativeBrief } from './intake/form-engine.js';
export type { ClientIntent, IntakeQuestion, IntakeSession } from './intake/form-engine.js';

// Contracts
export { generateContract, generateChangeOrder, CONTRACT_DEFAULTS } from './contracts/generator.js';
export type { ContractInput, GeneratedContract } from './contracts/generator.js';
export { triggerRetainerOnAcceptance, RETAINER_ACCEPTANCE_TOOL } from './contracts/retainer-acceptance.js';
export type { ProposalAcceptance, RetainerAcceptanceResult } from './contracts/retainer-acceptance.js';

// Delivery
export { DeliveryEngine } from './delivery/delivery-engine.js';
export type { Project, Deliverable, ProjectStatus, DeliverableStatus } from './delivery/delivery-engine.js';

// Profitability
export { ProfitabilityMonitor } from './financials/profitability.js';
export type { ProfitabilityReport, TimeEntry, Expense } from './financials/profitability.js';

// Intelligence
export * from './intelligence/index.js';
export { leadScorer, LeadScoringEngine, LeadScoreSchema } from './intelligence/lead-scoring.js';
export type { LeadScore } from './intelligence/lead-scoring.js';

// Flows
export { onboardingDraftFlow, OnboardingInputSchema } from './flows/onboarding.js';
export { prospectPipelineFlow, ProspectInputSchema, ProspectOutputSchema } from './flows/prospect-pipeline.js';
export type { ProspectInput, ProspectOutput } from './flows/prospect-pipeline.js';

// CRM Sync
export { crmSync, CRMSyncService, PipelineStageSchema } from './intelligence/crm-sync.js';
export type { PipelineRecord, PipelineStage, CRMSummary } from './intelligence/crm-sync.js';

// UI Components (T20260308-485)
export { IntakeStepper, ContractPreviewModal } from './ui/index.js';

// GTM Analytics (T20260308-485)
export {
  trackIntakeStarted,
  trackIntakeStep,
  trackBriefGenerated,
  trackContractGenerated,
  trackContractPreviewed,
  trackContractSent,
  trackContractSigned,
} from './analytics/index.js';

// Landing Intelligence: Conversion Events + PostHog (T20260309-651)
export {
  ZeroDayConversionEvent,
  ConversionEventType,
  captureCtaClick,
  captureEmailSubmit,
  captureFormComplete,
  capturePartnerInquiry,
  captureDemoRequest,
  validateConversionEvents,
} from './analytics/conversion-events.js';
export type { ZeroDayConversionEvent as ZeroDayConversionEventType } from './analytics/conversion-events.js';

// Creative DNA Vectors (T20260308-696)
export {
  generateCreativeDNA,
  mergeCreativeDNA,
  vectorSimilarity,
  CREATIVE_DNA_TOOLS,
} from './intelligence/creative-dna.js';
export type {
  AestheticVector,
  CreativeDNA,
  GenerateCreativeDNAInput,
} from './intelligence/creative-dna.js';

// A2A Protocol (T20260308-506)
export {
  A2AMessageType,
  A2AClient,
  getA2AClient,
  buildMessage,
  A2A_TOOLS,
} from './flows/a2a-protocol.js';
export type {
  A2AMessage,
  A2ATask,
  SendResult,
  A2AClientConfig,
} from './flows/a2a-protocol.js';

// Notifications — RELAY outbound layer (Wave 29)
export { notifier, ZeroDayNotifier } from './notifications/notifier.js';
export type { NotificationType, NotificationPayload } from './notifications/notifier.js';
