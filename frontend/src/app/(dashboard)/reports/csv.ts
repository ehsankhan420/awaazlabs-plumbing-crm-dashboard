/**
 * On-demand CSV builders for the operational tables (Jobs, Dispatch Queue, Conversations,
 * Escalations, Campaign contacts).
 *
 * SECURITY — the one rule that governs this whole file:
 * Every builder reads ONLY from the *projected* views the data-access layer returns
 * (`JobView`, `DispatchRecordView`, `CallInteractionView`, `ChatInteractionView`, and a
 * `ContactView` map). The raw E.164 phone field is never referenced here. A phone the user
 * has not revealed exports as its mask — exactly the value the table renders — and a
 * Viewer (who cannot export at all) never reaches a builder.
 */

import { formatDateTime, formatDuration, timezoneFor } from '@/lib/format';
import { getLocationById } from '@/mock/orgs';
import type {
  CallInteractionView,
  ChatInteractionView,
  ContactView,
  DispatchRecordView,
  JobView,
} from '@/mock/data-access';
import type { Campaign, CampaignContact } from '@/mock/schema';
import {
  AGENT_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  CALL_DISPOSITION_LABELS,
  CAMPAIGN_CONTACT_STATUS_LABELS,
  CHAT_CHANNEL_LABELS,
  CHAT_OUTCOME_LABELS,
  INTAKE_CHANNEL_LABELS,
  ISSUE_TYPE_LABELS,
  JOB_CREATOR_LABELS,
  JOB_PRIORITY_LABELS,
  JOB_STATUS_LABELS,
  SPECIALTY_LABELS,
} from '@/shared/status-models';

/** RFC-4180 field escaping: wrap in quotes and double any embedded quote. */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(columns: readonly string[], rows: ReadonlyArray<readonly string[]>): string {
  const header = columns.map(csvField).join(',');
  const body = rows.map((r) => r.map(csvField).join(','));
  return [header, ...body].join('\r\n');
}

/** A phone is only ever the projected mask — never the raw number. */
function phoneOf(contact: ContactView | null): string {
  return contact?.identity?.phoneMasked ?? '—';
}

function nameOf(contact: ContactView | null): string {
  const id = contact?.identity;
  return id ? `${id.firstName} ${id.lastName}` : 'Unknown customer';
}

/** Triggers a client-side Blob download. No network, no server round-trip. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ==================================================================================
 * Builders — each takes rows already projected by the data-access layer.
 * ================================================================================== */

const JOB_COLUMNS = [
  'Job reference',
  'Customer name',
  'Phone (masked)',
  'Issue type',
  'Job type',
  'Priority',
  'Job status',
  'Assignment status',
  'Assigned plumber',
  'Intake channel',
  'Created by',
  'Created at',
  'Requested window start',
  'Scheduled window start',
  'Service area',
  'ZIP',
  'Location',
] as const;

export function buildJobsCsv(rows: readonly JobView[], orgId: string): string {
  const body = rows.map((job) => {
    const tz = timezoneFor(orgId, job.locationId);
    return [
      job.reference,
      nameOf(job.contact),
      phoneOf(job.contact),
      ISSUE_TYPE_LABELS[job.issueType],
      job.jobType,
      JOB_PRIORITY_LABELS[job.priority],
      JOB_STATUS_LABELS[job.status],
      job.dispatch ? ASSIGNMENT_STATUS_LABELS[job.dispatch.status] : '',
      job.assignedPlumberName ?? '',
      INTAKE_CHANNEL_LABELS[job.intakeChannel],
      JOB_CREATOR_LABELS[job.createdBy],
      formatDateTime(job.createdAtUtc, tz),
      job.requestedWindow ? formatDateTime(job.requestedWindow.startUtc, tz) : '',
      job.scheduledWindow ? formatDateTime(job.scheduledWindow.startUtc, tz) : '',
      job.serviceAreaName ?? job.serviceAreaId,
      job.contact.zip,
      job.locationName ?? getLocationById(orgId, job.locationId)?.name ?? job.locationId,
    ];
  });
  return toCsv(JOB_COLUMNS, body);
}

const DISPATCH_COLUMNS = [
  'Job reference',
  'Customer name',
  'Phone (masked)',
  'Issue / job type',
  'Required specialty',
  'Service area',
  'Priority',
  'Assignment status',
  'Current candidate',
  'Assigned plumber',
  'Started at',
  'Accepted at',
  'Attempts',
  'Location',
] as const;

export function buildDispatchCsv(rows: readonly DispatchRecordView[], orgId: string): string {
  const body = rows.map((record) => {
    const tz = timezoneFor(orgId, record.locationId);
    return [
      record.job?.reference ?? record.jobId,
      nameOf(record.contact),
      phoneOf(record.contact),
      record.job ? `${ISSUE_TYPE_LABELS[record.job.issueType]} — ${record.job.jobType}` : '',
      SPECIALTY_LABELS[record.requiredSpecialty],
      record.serviceAreaName ?? record.serviceAreaId,
      record.job ? JOB_PRIORITY_LABELS[record.job.priority] : '',
      ASSIGNMENT_STATUS_LABELS[record.status],
      record.currentCandidateName ?? '',
      record.assignedPlumberName ?? '',
      formatDateTime(record.startedAtUtc, tz),
      record.acceptedAtUtc ? formatDateTime(record.acceptedAtUtc, tz) : '',
      String(record.attempts.length),
      record.locationName ?? getLocationById(orgId, record.locationId)?.name ?? record.locationId,
    ];
  });
  return toCsv(DISPATCH_COLUMNS, body);
}

const CONVERSATION_COLUMNS = [
  'Timestamp',
  'Type',
  'Channel',
  'Direction',
  'Party',
  'Name',
  'Phone (masked)',
  'Outcome',
  'Duration',
  'Messages',
  'Agent / intent',
  'Grade',
  'Location',
] as const;

/**
 * Conversations spans calls and chats. The two record shapes are unified into one
 * interaction table so a single CSV mirrors the tab. Fields that do not apply to a kind
 * are left blank rather than faked.
 */
export function buildConversationsCsv(
  calls: readonly CallInteractionView[],
  chats: readonly ChatInteractionView[],
  orgId: string,
): string {
  const callRows = calls.map((c) => {
    const tz = timezoneFor(orgId, c.locationId);
    return [
      formatDateTime(c.atUtc, tz),
      'Call',
      'Voice',
      c.direction,
      c.partyType === 'plumber' ? 'Plumber' : 'Customer',
      c.partyType === 'plumber' ? c.plumber?.name ?? 'Plumber' : nameOf(c.contact),
      phoneOf(c.contact),
      CALL_DISPOSITION_LABELS[c.disposition],
      formatDuration(c.durationSeconds),
      '',
      AGENT_LABELS[c.agent],
      c.grade ? String(c.grade.overall) : '',
      c.locationId,
    ];
  });

  const chatRows = chats.map((c) => {
    const tz = timezoneFor(orgId, c.locationId);
    return [
      formatDateTime(c.atUtc, tz),
      'Chat',
      CHAT_CHANNEL_LABELS[c.channel] ?? c.channel,
      '',
      'Customer',
      nameOf(c.contact),
      phoneOf(c.contact),
      CHAT_OUTCOME_LABELS[c.outcome],
      '',
      String(c.messageCount),
      c.intent,
      c.grade ? String(c.grade.overall) : '',
      c.locationId,
    ];
  });

  // Newest first, matching the tab's default ordering.
  const merged = [...callRows, ...chatRows].sort((a, b) =>
    a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0,
  );
  return toCsv(CONVERSATION_COLUMNS, merged);
}

export function buildCallsCsv(calls: readonly CallInteractionView[], orgId: string): string {
  return buildConversationsCsv(calls, [], orgId);
}

export function buildChatsCsv(chats: readonly ChatInteractionView[], orgId: string): string {
  return buildConversationsCsv([], chats, orgId);
}

const ESCALATION_COLUMNS = [
  'Reference',
  'Customer name',
  'Severity',
  'Trigger',
  'Status',
  'Owner',
  'Acknowledged at',
  'Acknowledged by',
  'Created at',
  'Resolution note',
  'Location',
] as const;

export interface EscalationCsvRow {
  readonly reference: string;
  readonly customerName: string;
  readonly severityLabel: string;
  readonly triggerLabel: string;
  readonly statusLabel: string;
  readonly owner: string;
  readonly acknowledgedAt: string;
  readonly acknowledgedBy: string;
  readonly createdAt: string;
  readonly resolutionNote: string;
  readonly locationName: string;
}

export function buildEscalationsCsv(rows: readonly EscalationCsvRow[]): string {
  const body = rows.map((row) => [
    row.reference,
    row.customerName,
    row.severityLabel,
    row.triggerLabel,
    row.statusLabel,
    row.owner,
    row.acknowledgedAt,
    row.acknowledgedBy,
    row.createdAt,
    row.resolutionNote,
    row.locationName,
  ]);
  return toCsv(ESCALATION_COLUMNS, body);
}

const CAMPAIGN_CONTACT_COLUMNS = [
  'Campaign',
  'Campaign type',
  'Customer name',
  'Phone (masked)',
  'Contact status',
  'Attempts',
  'Last outcome',
  'Created job',
  'Opt-out',
  'Location',
] as const;

export interface CampaignContactRow {
  readonly campaign: Campaign;
  readonly contact: CampaignContact;
  /** Projected identity view for this contact, or null when not surfaced by any reader. */
  readonly contactView: ContactView | null;
}

export function buildCampaignContactsCsv(rows: readonly CampaignContactRow[]): string {
  const body = rows.map(({ campaign, contact, contactView }) => [
    campaign.name,
    campaign.type,
    nameOf(contactView),
    phoneOf(contactView),
    CAMPAIGN_CONTACT_STATUS_LABELS[contact.status],
    String(contact.attempts),
    contact.lastOutcome ?? '',
    contact.createdJobId ?? '',
    contact.optOut ? 'Yes' : 'No',
    campaign.locationId,
  ]);
  return toCsv(CAMPAIGN_CONTACT_COLUMNS, body);
}
