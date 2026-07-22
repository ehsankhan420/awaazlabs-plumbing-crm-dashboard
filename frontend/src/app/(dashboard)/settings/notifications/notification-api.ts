/**
 * Notification settings & delivery — frontend-only build.
 *
 * Serves plumbing-domain notification data from a module-level in-memory store, seeded on
 * first read from the org fixture (escalations, exhausted dispatches, line health). Writes
 * (add/remove recipient, mark read, retry) mutate the store for the session. The exported
 * signatures are unchanged, so the notifications settings page needs no structural edits.
 */

import type { Session } from '@/mock/data-access';
import { getFixture } from '@/mock/fixtures';

export type NotificationAgentKey =
  | 'receptionist'
  | 'dispatch'
  | 'chat'
  | 'review_taker'
  | 'reengagement'
  | 'post_service_followup';

export type NotificationEventType =
  | 'job_created'
  | 'escalation_created'
  | 'dispatch_exhausted'
  | 'job_needs_review'
  | 'after_hours_job'
  | 'emergency_detected';

export type NotificationPriority = 'normal' | 'medium' | 'high' | 'urgent';
export type NotificationDetailMode = 'safe_summary' | 'detailed';
export type NotificationDeliveryStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped' | 'suppressed';
export type NotificationChannel = 'email' | 'in_app';

export interface NotificationAgentDto {
  readonly key: NotificationAgentKey;
  readonly label: string;
  readonly enabled: boolean;
}

export interface NotificationEventDefinitionDto {
  readonly eventType: NotificationEventType;
  readonly label: string;
  readonly description: string;
  readonly priority: NotificationPriority;
  readonly locked: boolean;
}

export interface NotificationRecipientDto {
  readonly id: string;
  readonly email: string;
  readonly isActive: boolean;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NotificationPreferenceDto {
  readonly id: string;
  readonly agent: NotificationAgentKey;
  readonly eventType: NotificationEventType;
  readonly emailEnabled: boolean;
  readonly inAppEnabled: boolean;
  readonly enabled: boolean;
  readonly priority: NotificationPriority;
  readonly detailMode: NotificationDetailMode;
  readonly locked: boolean;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NotificationSettingsDto {
  readonly agents: readonly NotificationAgentDto[];
  readonly events: {
    readonly receptionist: readonly NotificationEventDefinitionDto[];
  };
  readonly recipients: readonly NotificationRecipientDto[];
  readonly preferences: readonly NotificationPreferenceDto[];
  readonly unreadCount: number;
}

export interface NotificationEventDto {
  readonly id: string;
  readonly agent: NotificationAgentKey;
  readonly eventType: NotificationEventType;
  readonly title: string;
  readonly body: string;
  readonly priority: NotificationPriority;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly locationId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly readAt: string | null;
  readonly readBy: string | null;
  readonly createdAt: string;
}

export interface NotificationDeliveryDto {
  readonly id: string;
  readonly notificationEventId: string;
  readonly channel: NotificationChannel;
  readonly recipientEmail: string | null;
  readonly status: NotificationDeliveryStatus;
  readonly provider: string | null;
  readonly providerMessageId: string | null;
  readonly errorMessage: string | null;
  readonly attemptCount: number;
  readonly sentAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly event: NotificationEventDto | null;
}

export interface NotificationDeliveryHealthDto {
  readonly sentToday: number;
  readonly failedToday: number;
}

export class NotificationApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'NotificationApiError';
    this.code = code;
  }
}

const AGENT_LABELS: Record<NotificationAgentKey, string> = {
  receptionist: 'AI Receptionist',
  dispatch: 'Plumber Dispatch Agent',
  chat: 'Chat Agents',
  review_taker: 'Review Taker',
  reengagement: 'Reengagement',
  post_service_followup: 'Post-Service Follow-Up',
};

const EVENT_DEFS: readonly NotificationEventDefinitionDto[] = [
  { eventType: 'job_created', label: 'Job created', description: 'A new job was created from an inbound interaction.', priority: 'normal', locked: false },
  { eventType: 'escalation_created', label: 'Escalation created', description: 'An interaction was escalated for human ownership.', priority: 'high', locked: false },
  { eventType: 'dispatch_exhausted', label: 'Dispatch exhausted', description: 'No eligible plumber accepted within the attempt window.', priority: 'high', locked: false },
  { eventType: 'job_needs_review', label: 'Job needs review', description: 'A job requires manual staff review before dispatch.', priority: 'medium', locked: false },
  { eventType: 'after_hours_job', label: 'After-hours job', description: 'A job was created outside configured business hours.', priority: 'normal', locked: false },
  { eventType: 'emergency_detected', label: 'Emergency detected', description: 'A suspected emergency was flagged and routed to staff.', priority: 'urgent', locked: true },
];

interface OrgNotifications {
  recipients: NotificationRecipientDto[];
  preferences: NotificationPreferenceDto[];
  events: NotificationEventDto[];
  deliveries: NotificationDeliveryDto[];
  read: Set<string>;
}

const store = new Map<string, OrgNotifications>();
let seq = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function seed(session: Session): OrgNotifications {
  const existing = store.get(session.orgId);
  if (existing) return existing;

  const fixture = getFixture(session.orgId);
  const at = nowIso();

  const preferences: NotificationPreferenceDto[] = EVENT_DEFS.map((def, i) => ({
    id: `pref_${i}`,
    agent: 'receptionist',
    eventType: def.eventType,
    emailEnabled: def.priority !== 'normal',
    inAppEnabled: true,
    enabled: true,
    priority: def.priority,
    detailMode: 'safe_summary',
    locked: def.locked,
    createdBy: session.actor,
    createdAt: at,
    updatedAt: at,
  }));

  const recipients: NotificationRecipientDto[] = fixture.members
    .filter((m) => m.role === 'OWNER_ADMIN' || m.role === 'MANAGER')
    .map((m, i) => ({
      id: `rcpt_${i}`,
      email: m.email,
      isActive: true,
      createdBy: session.actor,
      createdAt: at,
      updatedAt: at,
    }));

  // Seed a handful of events from real operational state.
  const events: NotificationEventDto[] = [];
  const deliveries: NotificationDeliveryDto[] = [];

  for (const esc of fixture.escalations.slice(0, 4)) {
    seq += 1;
    const id = `ntf_${seq}`;
    events.push({
      id,
      agent: 'receptionist',
      eventType: esc.severity === 'critical' ? 'emergency_detected' : 'escalation_created',
      title: `Escalation ${esc.reference}`,
      body: esc.reason,
      priority: esc.severity === 'critical' ? 'urgent' : 'high',
      entityType: 'escalation',
      entityId: esc.id,
      locationId: esc.locationId,
      metadata: {},
      readAt: null,
      readBy: null,
      createdAt: esc.atUtc,
    });
    deliveries.push({
      id: `del_${seq}`,
      notificationEventId: id,
      channel: 'email',
      recipientEmail: recipients[0]?.email ?? null,
      status: seq % 7 === 0 ? 'failed' : 'sent',
      provider: 'mock',
      providerMessageId: `mock_${seq}`,
      errorMessage: seq % 7 === 0 ? 'Mailbox temporarily unavailable.' : null,
      attemptCount: 1,
      sentAt: esc.atUtc,
      createdAt: esc.atUtc,
      updatedAt: esc.atUtc,
      event: events[events.length - 1],
    });
  }

  for (const disp of fixture.dispatchRecords.filter((d) => d.status === 'exhausted').slice(0, 2)) {
    seq += 1;
    const id = `ntf_${seq}`;
    events.push({
      id,
      agent: 'dispatch',
      eventType: 'dispatch_exhausted',
      title: 'Dispatch exhausted',
      body: 'All eligible plumbers were contacted without an acceptance.',
      priority: 'high',
      entityType: 'dispatch',
      entityId: disp.id,
      locationId: disp.locationId,
      metadata: {},
      readAt: null,
      readBy: null,
      createdAt: disp.startedAtUtc,
    });
  }

  const seeded: OrgNotifications = { recipients, preferences, events, deliveries, read: new Set() };
  store.set(session.orgId, seeded);
  return seeded;
}

async function delay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 80));
}

export async function listNotificationSettings(session: Session): Promise<NotificationSettingsDto> {
  await delay();
  const s = seed(session);
  const agents: NotificationAgentDto[] = (Object.keys(AGENT_LABELS) as NotificationAgentKey[]).map((key) => ({
    key,
    label: AGENT_LABELS[key],
    enabled: key === 'receptionist' || key === 'dispatch',
  }));
  const unreadCount = s.events.filter((e) => !s.read.has(e.id)).length;
  return {
    agents,
    events: { receptionist: EVENT_DEFS },
    recipients: s.recipients,
    preferences: s.preferences,
    unreadCount,
  };
}

export async function addNotificationRecipient(session: Session, email: string): Promise<NotificationRecipientDto> {
  await delay();
  const s = seed(session);
  seq += 1;
  const at = nowIso();
  const recipient: NotificationRecipientDto = {
    id: `rcpt_new_${seq}`,
    email,
    isActive: true,
    createdBy: session.actor,
    createdAt: at,
    updatedAt: at,
  };
  s.recipients = [...s.recipients, recipient];
  return recipient;
}

export async function removeNotificationRecipient(session: Session, recipientId: string): Promise<void> {
  await delay();
  const s = seed(session);
  s.recipients = s.recipients.filter((r) => r.id !== recipientId);
}

export async function retryNotificationDelivery(session: Session, deliveryId: string): Promise<NotificationDeliveryDto> {
  await delay();
  const s = seed(session);
  const idx = s.deliveries.findIndex((d) => d.id === deliveryId);
  if (idx < 0) throw new NotificationApiError('not_found', 'Delivery not found.');
  const at = nowIso();
  const delivery: NotificationDeliveryDto = {
    ...s.deliveries[idx],
    status: 'sent',
    errorMessage: null,
    attemptCount: s.deliveries[idx].attemptCount + 1,
    sentAt: at,
    updatedAt: at,
  };
  s.deliveries[idx] = delivery;
  return delivery;
}

export async function listNotificationDeliveryHistory(
  session: Session,
  input: {
    readonly eventType?: NotificationEventType | null;
    readonly channel?: NotificationChannel | null;
    readonly status?: NotificationDeliveryStatus | null;
    readonly dateFrom?: string | null;
    readonly dateTo?: string | null;
    readonly limit?: number;
  } = {},
): Promise<{
  readonly deliveries: readonly NotificationDeliveryDto[];
  readonly total: number;
  readonly health: NotificationDeliveryHealthDto;
}> {
  await delay();
  const s = seed(session);
  let rows = [...s.deliveries];
  if (input.eventType) rows = rows.filter((d) => d.event?.eventType === input.eventType);
  if (input.channel) rows = rows.filter((d) => d.channel === input.channel);
  if (input.status) rows = rows.filter((d) => d.status === input.status);
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const limited = rows.slice(0, input.limit ?? 100);
  return {
    deliveries: limited,
    total: rows.length,
    health: {
      sentToday: s.deliveries.filter((d) => d.status === 'sent').length,
      failedToday: s.deliveries.filter((d) => d.status === 'failed').length,
    },
  };
}

export async function listNotificationEvents(
  session: Session,
  input: {
    readonly read?: boolean | null;
    readonly eventType?: NotificationEventType | null;
    readonly limit?: number;
  } = {},
): Promise<{ readonly events: readonly NotificationEventDto[]; readonly total: number }> {
  await delay();
  const s = seed(session);
  let rows = s.events.map((e) => ({ ...e, readAt: s.read.has(e.id) ? nowIso() : null }));
  if (input.eventType) rows = rows.filter((e) => e.eventType === input.eventType);
  if (input.read === true) rows = rows.filter((e) => e.readAt !== null);
  if (input.read === false) rows = rows.filter((e) => e.readAt === null);
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { events: rows.slice(0, input.limit ?? 100), total: rows.length };
}

export async function markNotificationRead(session: Session, eventId: string, read = true): Promise<void> {
  await delay();
  const s = seed(session);
  if (read) s.read.add(eventId);
  else s.read.delete(eventId);
}

export async function markAllNotificationsRead(session: Session): Promise<void> {
  await delay();
  const s = seed(session);
  for (const e of s.events) s.read.add(e.id);
}
