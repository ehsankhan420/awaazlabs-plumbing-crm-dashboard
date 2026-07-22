/**
 * CANONICAL STATUS MODELS — Plumbing Automation Dashboard UI spec §3, implemented verbatim.
 *
 * FROZEN FILE. Declared exactly once; imported everywhere else.
 *
 * Do not add a status that the spec does not list. Do not paraphrase a label.
 * Do not re-declare any of these unions in a feature file.
 */

/* ------------------------------------------------------------------------------------
 * Job Status — §3.1
 *   new > ready_for_dispatch > dispatching > assigned > scheduled > en_route >
 *   in_progress > completed | canceled
 * ---------------------------------------------------------------------------------- */

export const JOB_STATUSES = [
  'new',
  'ready_for_dispatch',
  'dispatching',
  'assigned',
  'scheduled',
  'en_route',
  'in_progress',
  'completed',
  'canceled',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Readonly<Record<JobStatus, string>> = {
  new: 'New',
  ready_for_dispatch: 'Ready for Dispatch',
  dispatching: 'Dispatching',
  assigned: 'Assigned',
  scheduled: 'Scheduled',
  en_route: 'En Route',
  in_progress: 'In Progress',
  completed: 'Completed',
  canceled: 'Canceled',
};

/** Legal next states. §5.2 Outcome actions are "displayed only when valid for the current status". */
export const JOB_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  new: ['ready_for_dispatch', 'canceled'],
  ready_for_dispatch: ['dispatching', 'canceled'],
  dispatching: ['assigned', 'canceled'],
  assigned: ['scheduled', 'en_route', 'canceled'],
  scheduled: ['en_route', 'in_progress', 'canceled'],
  en_route: ['in_progress', 'canceled'],
  in_progress: ['completed', 'canceled'],
  completed: [],
  canceled: [],
};

/** Statuses that count as "open" work (not terminal). */
export function isJobOpen(status: JobStatus): boolean {
  return status !== 'completed' && status !== 'canceled';
}

/* ------------------------------------------------------------------------------------
 * Assignment Status — §3.2
 * ---------------------------------------------------------------------------------- */

export const ASSIGNMENT_ACTIVE_STATUSES = ['unassigned', 'matching', 'contacting', 'awaiting_response'] as const;
export type AssignmentActiveStatus = (typeof ASSIGNMENT_ACTIVE_STATUSES)[number];

export const ASSIGNMENT_STATUSES = [
  ...ASSIGNMENT_ACTIVE_STATUSES,
  'accepted',
  'manually_assigned',
  'exhausted',
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ASSIGNMENT_STATUS_LABELS: Readonly<Record<AssignmentStatus, string>> = {
  unassigned: 'Unassigned',
  matching: 'Matching',
  contacting: 'Contacting',
  awaiting_response: 'Awaiting Response',
  accepted: 'Accepted',
  manually_assigned: 'Manually Assigned',
  exhausted: 'Exhausted',
};

/** §5.1 Dispatch "In Dispatch" card: Unassigned, Matching, Contacting, Awaiting Response combined. */
export function isAssignmentActive(status: AssignmentStatus): boolean {
  return (ASSIGNMENT_ACTIVE_STATUSES as readonly string[]).includes(status);
}

/** §5.1 "Assigned Today" card: Accepted and Manually Assigned combined. */
export function isAssignmentAssigned(status: AssignmentStatus): boolean {
  return status === 'accepted' || status === 'manually_assigned';
}

/* ------------------------------------------------------------------------------------
 * Plumber Outreach Outcome — §3.3. Belongs to one outreach attempt only.
 * ---------------------------------------------------------------------------------- */

export const OUTREACH_OUTCOMES = [
  'accepted',
  'declined',
  'no_answer',
  'voicemail',
  'unavailable',
  'failed',
  'canceled_before_contact',
] as const;
export type OutreachOutcome = (typeof OUTREACH_OUTCOMES)[number];

export const OUTREACH_OUTCOME_LABELS: Readonly<Record<OutreachOutcome, string>> = {
  accepted: 'Accepted',
  declined: 'Declined',
  no_answer: 'No Answer',
  voicemail: 'Voicemail',
  unavailable: 'Unavailable',
  failed: 'Failed',
  canceled_before_contact: 'Canceled Before Contact',
};

/* ------------------------------------------------------------------------------------
 * Job Priority — §3.4. Emergency is never inferred from color alone.
 * ---------------------------------------------------------------------------------- */

export const JOB_PRIORITIES = ['routine', 'urgent', 'emergency'] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];

export const JOB_PRIORITY_LABELS: Readonly<Record<JobPriority, string>> = {
  routine: 'Routine',
  urgent: 'Urgent',
  emergency: 'Emergency',
};

/**
 * §5.5 dispatch assignment thresholds (minutes a dispatch may sit unassigned before it
 * is overdue). Emergency jobs are human-owned immediately; urgent/routine get a window.
 */
export const DISPATCH_ASSIGNMENT_THRESHOLD_MINUTES: Readonly<Record<JobPriority, number>> = {
  routine: 240,
  urgent: 60,
  emergency: 15,
};

/* ------------------------------------------------------------------------------------
 * Escalation — §3.5 status, §3.6 severity, §3.7 trigger
 * ---------------------------------------------------------------------------------- */

export const ESCALATION_STATUSES = ['open', 'acknowledged', 'resolved'] as const;
export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];

export const ESCALATION_STATUS_LABELS: Readonly<Record<EscalationStatus, string>> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
};

export const ESCALATION_SEVERITIES = ['attention', 'urgent', 'critical'] as const;
export type EscalationSeverity = (typeof ESCALATION_SEVERITIES)[number];

export const ESCALATION_SEVERITY_LABELS: Readonly<Record<EscalationSeverity, string>> = {
  attention: 'Attention',
  urgent: 'Urgent',
  critical: 'Critical',
};

/** §3.6 acknowledgement thresholds, in minutes. Past threshold => aging badge + Overview banner. */
export const ESCALATION_ACK_THRESHOLD_MINUTES: Readonly<Record<EscalationSeverity, number>> = {
  attention: 240,
  urgent: 30,
  critical: 15,
};

export const ESCALATION_TRIGGERS = [
  'customer_requested_human',
  'emergency_condition',
  'safety_risk',
  'out_of_service_area',
  'no_suitable_plumber',
  'dispatch_exhausted',
  'agent_failure',
] as const;
export type EscalationTrigger = (typeof ESCALATION_TRIGGERS)[number];

export const ESCALATION_TRIGGER_LABELS: Readonly<Record<EscalationTrigger, string>> = {
  customer_requested_human: 'Customer Requested Human',
  emergency_condition: 'Emergency Condition',
  safety_risk: 'Safety Risk',
  out_of_service_area: 'Out of Service Area',
  no_suitable_plumber: 'No Suitable Plumber',
  dispatch_exhausted: 'Dispatch Exhausted',
  agent_failure: 'Agent Failure',
};

/* ------------------------------------------------------------------------------------
 * Call Disposition — §3.8 (+ in_progress for live calls)
 * ---------------------------------------------------------------------------------- */

export const CALL_DISPOSITIONS = [
  'in_progress',
  'job_created',
  'existing_job_updated',
  'information_provided',
  'human_transfer',
  'emergency_escalation',
  'out_of_service_area',
  'duplicate_request',
  'voicemail',
  'no_answer',
  'abandoned',
] as const;
export type CallDisposition = (typeof CALL_DISPOSITIONS)[number];

export const CALL_DISPOSITION_LABELS: Readonly<Record<CallDisposition, string>> = {
  in_progress: 'In Progress',
  job_created: 'Job Created',
  existing_job_updated: 'Existing Job Updated',
  information_provided: 'Information Provided',
  human_transfer: 'Human Transfer',
  emergency_escalation: 'Emergency Escalation',
  out_of_service_area: 'Out of Service Area',
  duplicate_request: 'Duplicate Request',
  voicemail: 'Voicemail',
  no_answer: 'No Answer',
  abandoned: 'Abandoned',
};

/** Dispositions that count as a completed interaction for the success-rate card (§5.1). */
export const CALL_COMPLETED_DISPOSITIONS = [
  'job_created',
  'existing_job_updated',
  'information_provided',
  'human_transfer',
  'emergency_escalation',
  'out_of_service_area',
  'duplicate_request',
] as const satisfies readonly CallDisposition[];

/* ------------------------------------------------------------------------------------
 * Chat Outcome — §3.9
 * ---------------------------------------------------------------------------------- */

export const CHAT_OUTCOMES = ['resolved', 'job_created', 'escalated', 'abandoned'] as const;
export type ChatOutcome = (typeof CHAT_OUTCOMES)[number];

export const CHAT_OUTCOME_LABELS: Readonly<Record<ChatOutcome, string>> = {
  resolved: 'Resolved',
  job_created: 'Job Created',
  escalated: 'Escalated',
  abandoned: 'Abandoned',
};

/* ------------------------------------------------------------------------------------
 * Review Outreach Status — §3.10
 * ---------------------------------------------------------------------------------- */

export const REVIEW_REQUEST_STATUSES = [
  'eligible',
  'contacted',
  'reached',
  'ask_delivered',
  'link_sent',
  'review_posted',
  'declined',
  'opted_out',
] as const;
export type ReviewRequestStatus = (typeof REVIEW_REQUEST_STATUSES)[number];

export const REVIEW_REQUEST_STATUS_LABELS: Readonly<Record<ReviewRequestStatus, string>> = {
  eligible: 'Eligible',
  contacted: 'Contacted',
  reached: 'Reached',
  ask_delivered: 'Ask Delivered',
  link_sent: 'Link Sent',
  review_posted: 'Review Posted',
  declined: 'Declined',
  opted_out: 'Opted Out',
};

/* ------------------------------------------------------------------------------------
 * Campaign — §3.11 status, §3.12 contact status
 * ---------------------------------------------------------------------------------- */

export const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'running', 'paused', 'completed'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Readonly<Record<CampaignStatus, string>> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
};

export const CAMPAIGN_CONTACT_STATUSES = [
  'queued',
  'attempted',
  'reached',
  'job_created',
  'exhausted',
  'opted_out',
] as const;
export type CampaignContactStatus = (typeof CAMPAIGN_CONTACT_STATUSES)[number];

export const CAMPAIGN_CONTACT_STATUS_LABELS: Readonly<Record<CampaignContactStatus, string>> = {
  queued: 'Queued',
  attempted: 'Attempted',
  reached: 'Reached',
  job_created: 'Job Created',
  exhausted: 'Exhausted',
  opted_out: 'Opted Out',
};

/* ------------------------------------------------------------------------------------
 * Quality Flag — §3.13
 * ---------------------------------------------------------------------------------- */

export const FLAG_STATUSES = ['submitted', 'under_review', 'resolved'] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

export const FLAG_STATUS_LABELS: Readonly<Record<FlagStatus, string>> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  resolved: 'Resolved',
};

/* ------------------------------------------------------------------------------------
 * Optimization — §3.14
 * ---------------------------------------------------------------------------------- */

export const OPTIMIZATION_EVENT_STATUSES = ['detected', 'in_tuning', 'deployed', 'verified'] as const;
export type OptimizationEventStatus = (typeof OPTIMIZATION_EVENT_STATUSES)[number];

export const OPTIMIZATION_EVENT_STATUS_LABELS: Readonly<Record<OptimizationEventStatus, string>> = {
  detected: 'Detected',
  in_tuning: 'In Tuning',
  deployed: 'Deployed',
  verified: 'Verified',
};

export const OPTIMIZATION_FLAGGED_STATUSES = ['detected', 'in_tuning'] as const;
export const OPTIMIZATION_APPLIED_STATUSES = ['deployed', 'verified'] as const;

/* ------------------------------------------------------------------------------------
 * Knowledge Request Status — §3.15
 * ---------------------------------------------------------------------------------- */

export const KNOWLEDGE_REQUEST_STATUSES = ['requested', 'in_review', 'scheduled', 'live'] as const;
export type KnowledgeRequestStatus = (typeof KNOWLEDGE_REQUEST_STATUSES)[number];

export const KNOWLEDGE_REQUEST_STATUS_LABELS: Readonly<Record<KnowledgeRequestStatus, string>> = {
  requested: 'Requested',
  in_review: 'In Review',
  scheduled: 'Scheduled',
  live: 'Live',
};

/* ------------------------------------------------------------------------------------
 * Notification Delivery Status — §3.16
 * ---------------------------------------------------------------------------------- */

export const NOTIFICATION_DELIVERY_STATUSES = ['sent', 'failed'] as const;
export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

export const NOTIFICATION_DELIVERY_STATUS_LABELS: Readonly<Record<NotificationDeliveryStatus, string>> = {
  sent: 'Sent',
  failed: 'Failed',
};

/* ------------------------------------------------------------------------------------
 * Supporting dimensions
 * ---------------------------------------------------------------------------------- */

/** §5.1 Jobs chart series: "Voice, Web Chat, SMS, WhatsApp, Staff Entry". */
export const INTAKE_CHANNELS = ['voice', 'web_chat', 'sms', 'whatsapp', 'staff_entry'] as const;
export type IntakeChannel = (typeof INTAKE_CHANNELS)[number];

export const INTAKE_CHANNEL_LABELS: Readonly<Record<IntakeChannel, string>> = {
  voice: 'Voice',
  web_chat: 'Web Chat',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  staff_entry: 'Staff Entry',
};

/** §5.3 "Chats includes Web Chat, SMS, and WhatsApp." */
export const CHAT_CHANNELS = ['web_chat', 'sms', 'whatsapp'] as const;
export type ChatChannel = (typeof CHAT_CHANNELS)[number];

export const CHAT_CHANNEL_LABELS: Readonly<Record<ChatChannel, string>> = {
  web_chat: 'Web Chat',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

/** §5.3 "direction (inbound, outbound)". */
export const CALL_DIRECTIONS = ['inbound', 'outbound'] as const;
export type CallDirection = (typeof CALL_DIRECTIONS)[number];

/** §5.3 Party Type: "Customer or Plumber". */
export const PARTY_TYPES = ['customer', 'plumber'] as const;
export type PartyType = (typeof PARTY_TYPES)[number];

export const PARTY_TYPE_LABELS: Readonly<Record<PartyType, string>> = {
  customer: 'Customer',
  plumber: 'Plumber',
};

/**
 * Standard agents (§4.14 AGENTS group). `dispatch` is the Plumber Dispatch Agent.
 * Custom agents append from the registry and render via /agents/[slug].
 */
export const AGENT_IDS = ['receptionist', 'dispatch', 'chat', 'review_taker', 'reengagement'] as const;
export type AgentId = (typeof AGENT_IDS)[number];

export const CUSTOM_AGENT_IDS = ['post_service_followup'] as const;
export type CustomAgentId = (typeof CUSTOM_AGENT_IDS)[number];

/** Any agent that can be attributed an interaction: the five standard, plus custom agents. */
export type InteractionAgentId = AgentId | CustomAgentId;

export const AGENT_LABELS: Readonly<Record<InteractionAgentId, string>> = {
  receptionist: 'AI Receptionist',
  dispatch: 'Plumber Dispatch Agent',
  chat: 'Chat Agents',
  review_taker: 'Review Taker',
  reengagement: 'Reengagement',
  post_service_followup: 'Post-Service Follow-Up',
};

/** Issue types the intake agents capture. Feeds the Jobs "Issue Type" filter and columns. */
export const ISSUE_TYPES = [
  'leaking_pipe',
  'clogged_drain',
  'water_heater_failure',
  'burst_pipe',
  'running_toilet',
  'low_water_pressure',
  'sewer_backup',
  'gas_leak_suspected',
  'fixture_installation',
  'sump_pump_failure',
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_TYPE_LABELS: Readonly<Record<IssueType, string>> = {
  leaking_pipe: 'Leaking Pipe',
  clogged_drain: 'Clogged Drain',
  water_heater_failure: 'Water Heater Failure',
  burst_pipe: 'Burst Pipe',
  running_toilet: 'Running Toilet',
  low_water_pressure: 'Low Water Pressure',
  sewer_backup: 'Sewer Backup',
  gas_leak_suspected: 'Suspected Gas Leak',
  fixture_installation: 'Fixture Installation',
  sump_pump_failure: 'Sump Pump Failure',
};

/** §2.3: plumber qualification = required specialty, service area, availability. */
export const SPECIALTIES = [
  'general_repair',
  'drain_cleaning',
  'water_heater',
  'gas_line',
  'sewer_main',
  'leak_detection',
  'fixture_install',
] as const;
export type Specialty = (typeof SPECIALTIES)[number];

export const SPECIALTY_LABELS: Readonly<Record<Specialty, string>> = {
  general_repair: 'General Repair',
  drain_cleaning: 'Drain Cleaning',
  water_heater: 'Water Heater',
  gas_line: 'Gas Line',
  sewer_main: 'Sewer Main',
  leak_detection: 'Leak Detection',
  fixture_install: 'Fixture Install',
};

/** Plumber availability, shown in the dispatch drawer's Eligible Plumbers section (§5.5). */
export const PLUMBER_AVAILABILITIES = ['available', 'on_job', 'off_shift'] as const;
export type PlumberAvailability = (typeof PLUMBER_AVAILABILITIES)[number];

export const PLUMBER_AVAILABILITY_LABELS: Readonly<Record<PlumberAvailability, string>> = {
  available: 'Available',
  on_job: 'On a Job',
  off_shift: 'Off Shift',
};

/** Who created a job record (§5.2 "Created By"). */
export const JOB_CREATORS = ['ai_receptionist', 'chat_agent', 'staff'] as const;
export type JobCreator = (typeof JOB_CREATORS)[number];

export const JOB_CREATOR_LABELS: Readonly<Record<JobCreator, string>> = {
  ai_receptionist: 'AI Receptionist',
  chat_agent: 'Chat Agent',
  staff: 'Staff',
};

/** §5.2 grading dimensions shown in the Quality Grade drawer section. Order is the spec's. */
export const GRADING_DIMENSIONS = [
  'accuracy',
  'compliance',
  'conversation_quality',
  'task_completion',
  'efficiency',
] as const;
export type GradingDimension = (typeof GRADING_DIMENSIONS)[number];

export const GRADING_DIMENSION_LABELS: Readonly<Record<GradingDimension, string>> = {
  accuracy: 'Operational Accuracy',
  compliance: 'Policy and Safety Compliance',
  conversation_quality: 'Conversation Quality',
  task_completion: 'Task Completion',
  efficiency: 'Efficiency',
};

export const GRADING_DIMENSION_DESCRIPTIONS: Readonly<Record<GradingDimension, string>> = {
  accuracy: 'Information given matched the knowledge base and job record',
  compliance: 'Required disclosures made, safety guidance delivered where applicable',
  conversation_quality: 'Tone, interruption handling, proper opening and closing',
  task_completion: 'Did the interaction achieve its objective (intake, assignment, follow-up, review ask)',
  efficiency: 'Handle time versus benchmark for the interaction type',
};

/** §2.1 roles: "owners, managers, dispatchers, and viewers". */
export const ROLES = ['OWNER_ADMIN', 'MANAGER', 'DISPATCHER', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  OWNER_ADMIN: 'Owner/Admin',
  MANAGER: 'Manager',
  DISPATCHER: 'Dispatcher',
  VIEWER: 'Viewer',
};

/** Per-location setting for one-party vs two-party recording-consent states. */
export const RECORDING_CONSENT_MODES = ['one_party', 'two_party'] as const;
export type RecordingConsentMode = (typeof RECORDING_CONSENT_MODES)[number];

/** Consent and Do-Not-Call: source of suppression. */
export const SUPPRESSION_SOURCES = ['customer_opt_out', 'manual_add', 'complaint'] as const;
export type SuppressionSource = (typeof SUPPRESSION_SOURCES)[number];

export const SUPPRESSION_SOURCE_LABELS: Readonly<Record<SuppressionSource, string>> = {
  customer_opt_out: 'Customer opt-out',
  manual_add: 'Manual add',
  complaint: 'Complaint',
};

/** Language of customer interactions is a data dimension. */
export const LANGUAGES = ['en', 'es', 'other'] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Readonly<Record<Language, string>> = {
  en: 'English',
  es: 'Spanish',
  other: 'Other',
};
