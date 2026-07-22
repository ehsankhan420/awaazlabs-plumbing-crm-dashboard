/**
 * MOCK DATA SCHEMA — Plumbing Automation Dashboard.
 *
 * FROZEN FILE (Foundation).
 *
 * The dashboard is the system of record for interactions and outcomes; customer data is
 * limited to the contact envelope the intake agents actually capture: name, phone,
 * service address, and job context. Nothing more is defined here.
 */

import type {
  AgentId,
  AssignmentStatus,
  CallDirection,
  CallDisposition,
  CampaignContactStatus,
  CampaignStatus,
  ChatChannel,
  ChatOutcome,
  EscalationSeverity,
  EscalationStatus,
  EscalationTrigger,
  FlagStatus,
  GradingDimension,
  IntakeChannel,
  InteractionAgentId,
  IssueType,
  JobCreator,
  JobPriority,
  JobStatus,
  KnowledgeRequestStatus,
  Language,
  NotificationDeliveryStatus,
  OptimizationEventStatus,
  OutreachOutcome,
  PartyType,
  PlumberAvailability,
  RecordingConsentMode,
  ReviewRequestStatus,
  Role,
  Specialty,
  SuppressionSource,
} from '@/shared/status-models';

/* ==================================================================================
 * Customer envelope
 * ================================================================================== */

/**
 * The identity block. Returned as a whole or not at all — never partially redacted.
 * A Viewer receives a masked phone only; the raw value is absent from the object.
 */
export interface CustomerIdentity {
  readonly firstName: string;
  readonly lastName: string;
  /** E.164. Masked in the UI until an authorized, audited reveal (§5.2). */
  readonly phoneE164: string;
}

/** The contact record. Every customer-level row in the app carries one of these. */
export interface CustomerContact {
  readonly id: string;
  readonly identity: CustomerIdentity | null;
  /** Street address the job is at. Captured by intake; shown in the job drawer. */
  readonly serviceAddress: string;
  readonly zip: string;
  readonly serviceAreaId: string;
  readonly language: Language;
  readonly locationId: string;
  readonly consentBasis: string | null;
  readonly suppressed: boolean;
}

/* ==================================================================================
 * Organization, location, service areas
 * ================================================================================== */

export interface BusinessHours {
  /** 0 = Sunday. Absent day = closed. */
  readonly day: number;
  readonly openMinute: number;
  readonly closeMinute: number;
}

/** §2.3: plumber qualification is specialty + service area + availability. */
export interface ServiceArea {
  readonly id: string;
  readonly name: string;
  readonly zips: readonly string[];
}

export interface MockLocation {
  readonly id: string;
  readonly name: string;
  /** IANA zone. All timestamps stored UTC, rendered in the location's timezone. */
  readonly timezone: string;
  readonly businessHours: readonly BusinessHours[];
  readonly holidays: readonly string[];
  readonly recordingConsentMode: RecordingConsentMode;
  readonly escalationForwardingNumber: string;
}

export interface MockOrganization {
  readonly id: string;
  readonly name: string;
  readonly locations: readonly MockLocation[];
  readonly serviceAreas: readonly ServiceArea[];
  /**
   * §5.1 Revenue Influenced: "completed AI-created jobs multiplied by configured Average
   * Job Value". `null` means unset, which hides the revenue card entirely.
   */
  readonly avgJobValueUsd: number | null;
  readonly planMinutes: number;
  readonly planChatSessions: number;
}

/** Single-location businesses see no location filter. */
export function isMultiLocation(org: MockOrganization): boolean {
  return org.locations.length > 1;
}

/* ==================================================================================
 * Plumbers — operational resources, not dashboard members (§2.1)
 * ================================================================================== */

export interface Plumber {
  readonly id: string;
  readonly name: string;
  readonly phoneE164: string;
  readonly specialties: readonly Specialty[];
  readonly serviceAreaIds: readonly string[];
  readonly availability: PlumberAvailability;
  readonly activeJobs: number;
  /** Share of outreach attempts this plumber accepted, 0..1. */
  readonly acceptanceRate: number;
  readonly lastContactedUtc: string | null;
}

/* ==================================================================================
 * Agent registry
 * ================================================================================== */

export const AGENT_CHANNELS = ['voice', 'chat'] as const;
export type AgentChannel = (typeof AGENT_CHANNELS)[number];

export const AGENT_TYPES = ['inbound', 'outbound'] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export interface KpiDefinition {
  readonly key: string;
  readonly label: string;
  readonly format: 'count' | 'percent' | 'duration_ms' | 'duration_s' | 'currency_usd';
  readonly description?: string;
}

/**
 * Every agent, standard or custom, renders from the same schema. Custom agents (e.g.
 * Post-Service Follow-Up) get a dashboard page via /agents/[slug] with zero frontend work.
 * `icon` is a lucide-react icon name resolved through a single allow-list map.
 */
export interface AgentRegistryEntry {
  readonly id: AgentId | string;
  readonly name: string;
  readonly type: AgentType;
  readonly channel: AgentChannel;
  readonly icon: string;
  readonly metricsContract: readonly KpiDefinition[];
  /** Standard agents have bespoke tabs; custom agents render via /agents/[slug]. */
  readonly isCustom: boolean;
  readonly slug: string;
}

/* ==================================================================================
 * Jobs — the master operational record (§5.2)
 * ================================================================================== */

export interface JobTimelineEvent {
  readonly at: string;
  readonly label: string;
  readonly actor: string;
}

/** §5.2 Customer Communication: confirmations and notices sent to the customer. */
export interface CustomerNotification {
  readonly at: string;
  readonly kind:
    | 'job_created_confirmation'
    | 'assignment_confirmation'
    | 'arrival_window_notification'
    | 'reschedule_notice'
    | 'cancellation_notice';
  readonly channel: 'sms' | 'voice' | 'whatsapp';
  readonly deliveryStatus: NotificationDeliveryStatus;
}

/** A service window: requested by the customer, or the confirmed arrival window. */
export interface ServiceWindow {
  readonly startUtc: string;
  readonly endUtc: string;
}

export interface Job {
  readonly id: string;
  /** Human-readable job reference, e.g. "JOB-2417". */
  readonly reference: string;
  readonly contactId: string;
  readonly status: JobStatus;
  readonly priority: JobPriority;
  readonly issueType: IssueType;
  /** Short work description, e.g. "Water heater replacement". */
  readonly jobType: string;
  /** The customer's own words, captured at intake. */
  readonly customerDescription: string;
  /** §2.2: preferred window captured at intake — not a guaranteed arrival window. */
  readonly requestedWindow: ServiceWindow | null;
  /** §2.2: displayed only after a plumber assignment is accepted and confirmed. */
  readonly scheduledWindow: ServiceWindow | null;
  readonly intakeChannel: IntakeChannel;
  readonly language: Language;
  readonly createdBy: JobCreator;
  readonly createdByAgent: AgentId | null;
  readonly createdAtUtc: string;
  readonly locationId: string;
  readonly serviceAreaId: string;
  /** Dispatch linkage. Null when the job never required dispatch. */
  readonly dispatchId: string | null;
  readonly requiredSpecialty: Specialty;
  readonly assignedPlumberId: string | null;
  readonly originatingInteractionId: string | null;
  readonly timeline: readonly JobTimelineEvent[];
  readonly notifications: readonly CustomerNotification[];
  readonly staffNotes: readonly { readonly at: string; readonly author: string; readonly body: string }[];
}

/* ==================================================================================
 * Dispatch records — the plumber-assignment worklist (§5.5)
 * ================================================================================== */

/** §5.5 Outreach Attempts: one row per outbound plumber contact. */
export interface OutreachAttempt {
  readonly attemptNumber: number;
  readonly plumberId: string;
  readonly at: string;
  readonly outcome: OutreachOutcome;
  readonly callDurationSeconds: number | null;
  readonly interactionId: string | null;
}

export interface DispatchRecord {
  readonly id: string;
  readonly jobId: string;
  readonly status: AssignmentStatus;
  readonly requiredSpecialty: Specialty;
  readonly serviceAreaId: string;
  readonly zip: string;
  readonly locationId: string;
  /** Plumber currently being contacted or awaited. */
  readonly currentCandidateId: string | null;
  readonly assignedPlumberId: string | null;
  readonly startedAtUtc: string;
  readonly acceptedAtUtc: string | null;
  readonly scheduledWindow: ServiceWindow | null;
  readonly attempts: readonly OutreachAttempt[];
  /** Plumber ids evaluated as eligible for this dispatch, in contact order. */
  readonly eligiblePlumberIds: readonly string[];
  readonly statusTimeline: readonly { readonly at: string; readonly status: AssignmentStatus; readonly actor: string }[];
  readonly notes: readonly { readonly at: string; readonly author: string; readonly body: string }[];
  /** Linked human-owned escalation, set when the dispatch is exhausted (§2.3). */
  readonly escalationId: string | null;
}

/* ==================================================================================
 * Interactions (§5.3)
 * ================================================================================== */

/** Per-interaction sub-scores rolling into the overall grade. */
export type GradeBreakdown = Readonly<Record<GradingDimension, number>>;

export interface QaGrade {
  readonly overall: number;
  readonly breakdown: GradeBreakdown;
}

export interface TranscriptTurn {
  readonly speaker: 'agent' | 'caller';
  readonly at: string;
  readonly text: string;
  /** PII redaction markers — character ranges within `text` that were redacted. */
  readonly redactions: readonly { readonly start: number; readonly end: number; readonly kind: string }[];
}

/**
 * Recording + transcript, bundled into one nullable block so a Viewer receives
 * `media: null` and there is literally nothing to play or read.
 */
export interface InteractionMedia {
  readonly recordingUrl: string;
  readonly transcript: readonly TranscriptTurn[];
  /** Consent disclosure event, shown when two-party consent mode was active. */
  readonly consentDisclosureAtUtc: string | null;
}

export interface CallInteraction {
  readonly id: string;
  readonly kind: 'call';
  readonly atUtc: string;
  readonly direction: CallDirection;
  readonly agent: InteractionAgentId;
  /** §5.3 Party Type: Customer or Plumber. */
  readonly partyType: PartyType;
  /** Customer contact for customer calls; null for plumber outreach calls. */
  readonly contactId: string | null;
  /** Plumber for outbound dispatch calls; null otherwise. */
  readonly plumberId: string | null;
  readonly durationSeconds: number;
  readonly disposition: CallDisposition;
  readonly priority: JobPriority;
  readonly grade: QaGrade | null;
  readonly locationId: string;
  readonly media: InteractionMedia | null;
  readonly firstAudioResponseMs: number;
  readonly costUsd: number;
  /** §5.2 extracted intake / dispatch data for the call drawer. */
  readonly extracted: {
    readonly issueType: IssueType | null;
    readonly jobType: string | null;
    readonly requiredSpecialty: Specialty | null;
    readonly preferredWindowLabel: string | null;
    readonly plumberResponse: OutreachOutcome | null;
  } | null;
  readonly linked: {
    readonly jobId: string | null;
    readonly dispatchId: string | null;
    readonly escalationId: string | null;
    readonly reviewRequestId: string | null;
    readonly campaignId: string | null;
  };
}

export interface ChatMessage {
  readonly at: string;
  readonly speaker: 'agent' | 'customer' | 'human_staff';
  readonly text: string;
  /** Handoff markers where a human took over. */
  readonly isHandoffMarker: boolean;
}

export interface ChatInteraction {
  readonly id: string;
  readonly kind: 'chat';
  readonly atUtc: string;
  readonly channel: ChatChannel;
  readonly contactId: string | null;
  readonly lastMessageAtUtc: string;
  readonly outcome: ChatOutcome;
  readonly messageCount: number;
  readonly intent: string;
  readonly language: Language;
  readonly locationId: string;
  readonly responseLatencyMs: number;
  readonly grade: QaGrade | null;
  readonly humanHandoff: boolean;
  readonly linked: { readonly jobId: string | null; readonly escalationId: string | null };
  /** Null for Viewer, exactly as with calls. */
  readonly messages: readonly ChatMessage[] | null;
}

/* ==================================================================================
 * Escalations — human-owned work (§5.4)
 * ================================================================================== */

export interface Escalation {
  readonly id: string;
  /** Human-readable reference, e.g. "ESC-104". */
  readonly reference: string;
  readonly atUtc: string;
  readonly contactId: string | null;
  readonly jobId: string | null;
  readonly dispatchId: string | null;
  readonly sourceInteractionId: string | null;
  readonly trigger: EscalationTrigger;
  readonly severity: EscalationSeverity;
  readonly reason: string;
  /** §2.4: every escalation has an owner. Null = unowned, needs assignment. */
  readonly owner: string | null;
  readonly status: EscalationStatus;
  readonly acknowledgedAtUtc: string | null;
  readonly acknowledgedBy: string | null;
  readonly resolutionNote: string | null;
  readonly resolvedAtUtc: string | null;
  readonly locationId: string;
}

/* ==================================================================================
 * Quality
 * ================================================================================== */

export interface OptimizationEvent {
  readonly id: string;
  readonly detectedAtUtc: string;
  readonly agent: AgentId;
  readonly status: OptimizationEventStatus;
  /** Client-safe language, controlled vocabulary. Never internal tuning mechanics. */
  readonly whatWasDetected: string;
  readonly whatWasChanged: string;
  /** Measured after deployment. Null until a `verified` event has a delta. */
  readonly gradeDelta: number | null;
  readonly deployedAtUtc: string | null;
  readonly verifiedAtUtc: string | null;
}

export interface FlaggedInteraction {
  readonly id: string;
  readonly interactionId: string;
  readonly submittedAtUtc: string;
  readonly submittedBy: string;
  readonly status: FlagStatus;
  readonly reason: string;
  readonly resolutionNote: string | null;
}

/* ==================================================================================
 * Growth — reviews & campaigns
 * ================================================================================== */

export interface ReviewRequest {
  readonly id: string;
  readonly contactId: string;
  readonly jobId: string;
  readonly status: ReviewRequestStatus;
  readonly calledAtUtc: string | null;
  readonly callDurationSeconds: number | null;
  readonly linkClicked: boolean;
  readonly postedRating: number | null;
  readonly postedAtUtc: string | null;
  readonly locationId: string;
  readonly interactionId: string | null;
}

/** Private feedback capture after the ask. */
export interface PrivateFeedback {
  readonly id: string;
  readonly atUtc: string;
  readonly contactId: string;
  readonly summary: string;
  readonly sourceInteractionId: string;
  readonly status: 'new' | 'actioned';
  readonly locationId: string;
}

export interface PublishedReview {
  readonly id: string;
  readonly atUtc: string;
  readonly rating: number;
  readonly excerpt: string;
  readonly url: string;
  readonly attributed: boolean;
  readonly locationId: string;
}

export const CAMPAIGN_TYPES = ['reengagement', 'seasonal_maintenance', 'follow_up'] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export interface CampaignContact {
  readonly id: string;
  readonly contactId: string;
  readonly status: CampaignContactStatus;
  readonly attempts: number;
  readonly lastOutcome: string | null;
  readonly createdJobId: string | null;
  readonly optOut: boolean;
}

export interface Campaign {
  readonly id: string;
  readonly name: string;
  readonly type: CampaignType;
  readonly status: CampaignStatus;
  readonly audienceSize: number;
  readonly startedAtUtc: string | null;
  readonly locationId: string;
  /** Audience definition summary (segment rules). */
  readonly audienceDefinition: readonly string[];
  /** Pacing settings, displayed read-only. */
  readonly pacing: {
    readonly callingWindowLocal: string;
    readonly maxAttempts: number;
    readonly retrySpacingHours: number;
  };
  readonly contacts: readonly CampaignContact[];
}

/* ==================================================================================
 * Knowledge & Settings
 * ================================================================================== */

/** Agent Knowledge categories for a plumbing operation. */
export const KNOWLEDGE_CATEGORIES = [
  'services_and_repairs',
  'pricing_and_fees',
  'plumbers_and_coverage',
  'hours_and_holidays',
  'service_areas',
  'faq',
  'intake_rules',
  'escalation_routing',
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export interface KnowledgeBlock {
  readonly category: KnowledgeCategory;
  readonly locationId: string | null;
  readonly entries: readonly { readonly label: string; readonly value: string }[];
}

export interface KnowledgeChangeRequest {
  readonly id: string;
  readonly category: KnowledgeCategory;
  readonly proposedChange: string;
  readonly reason: string;
  readonly requestedBy: string;
  readonly requestedAtUtc: string;
  readonly status: KnowledgeRequestStatus;
  readonly history: readonly { readonly at: string; readonly status: KnowledgeRequestStatus }[];
}

export interface Member {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly lastActiveUtc: string;
  readonly mfaEnabled: boolean;
}

export interface PhoneLine {
  readonly id: string;
  readonly number: string;
  readonly kind: 'voice' | 'sms' | 'whatsapp';
  readonly locationId: string;
  readonly healthy: boolean;
  readonly lastCheckedUtc: string;
}

export interface SuppressionEntry {
  readonly id: string;
  readonly phoneE164: string;
  readonly source: SuppressionSource;
  readonly addedAtUtc: string;
  readonly consentBasis: string | null;
}

export interface Invoice {
  readonly id: string;
  readonly periodLabel: string;
  readonly amountUsd: number;
  readonly status: 'paid' | 'due';
  readonly downloadUrl: string;
}

/* ==================================================================================
 * Live calls — the Overview "Live Calls Now" panel (§5.1)
 * ================================================================================== */

export interface LiveCallNow {
  readonly id: string;
  readonly agent: InteractionAgentId;
  readonly direction: CallDirection;
  readonly partyType: PartyType;
  readonly partyLabel: string;
  readonly startedAtUtc: string;
  /** Current call stage, e.g. "Capturing service address". */
  readonly stage: string;
}

/* ==================================================================================
 * The complete fixture bundle for one organization
 * ================================================================================== */

export interface OrgFixture {
  readonly org: MockOrganization;
  readonly contacts: readonly CustomerContact[];
  readonly plumbers: readonly Plumber[];
  readonly jobs: readonly Job[];
  readonly dispatchRecords: readonly DispatchRecord[];
  readonly calls: readonly CallInteraction[];
  readonly chats: readonly ChatInteraction[];
  readonly escalations: readonly Escalation[];
  readonly optimizationEvents: readonly OptimizationEvent[];
  readonly flags: readonly FlaggedInteraction[];
  readonly reviewRequests: readonly ReviewRequest[];
  readonly privateFeedback: readonly PrivateFeedback[];
  readonly publishedReviews: readonly PublishedReview[];
  readonly campaigns: readonly Campaign[];
  readonly knowledgeBlocks: readonly KnowledgeBlock[];
  readonly knowledgeRequests: readonly KnowledgeChangeRequest[];
  readonly members: readonly Member[];
  readonly lines: readonly PhoneLine[];
  readonly suppressionList: readonly SuppressionEntry[];
  readonly invoices: readonly Invoice[];
  readonly agents: readonly AgentRegistryEntry[];
  /** §5.1 Live Calls Now panel. */
  readonly liveCalls: readonly LiveCallNow[];
  /** Current-cycle consumption for Usage and Billing. */
  readonly minutesConsumed: number;
  readonly chatSessionsConsumed: number;
}
