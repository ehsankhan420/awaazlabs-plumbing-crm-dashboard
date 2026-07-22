/**
 * DASHBOARD DATA ADAPTER — the single data source for every live hook.
 *
 * Frontend-only build: every fetcher computes from the deterministic mock fixtures
 * (src/mock) instead of a backend. The exported surface is written so a future backend
 * can slot in behind these functions without touching any page: each fetcher keeps its
 * async signature, and mutations update an in-memory overlay so acknowledge / note /
 * status actions behave like real writes for the lifetime of the session.
 */

import { getFixture } from '@/mock/fixtures';
import {
  listCalls,
  listChats,
  listDispatchRecords,
  listEscalations,
  listJobs,
  canAccessMedia,
  canPerformWorkflowActions,
  type CallInteractionView,
  type ChatInteractionView,
  type DispatchRecordView,
  type EscalationView,
  type GatedRows,
  type JobView,
  type Session,
} from '@/mock/data-access';
import { writeAuditEvent } from '@/shared/audit';
import type { KnowledgeBlock, LiveCallNow, MockLocation, OrgFixture } from '@/mock/schema';
import {
  dispatchCounts,
  isEscalationOverdue,
  jobNeedsAttention,
  jobStats,
  minutesSince,
  qualityTrend,
  aggregateQualityScore,
  optimizationEventsThisMonth,
  revenueInfluencedEstimate,
  scopeToLocation,
  telemetry,
  isToday,
  isWithinTrailingDays,
  daysSince,
  type DispatchCounts,
  type JobStats,
} from '@/lib/metrics';
import { getOrgById, mockNow } from '@/mock/orgs';
import type {
  CallDisposition,
  IntakeChannel,
  JobStatus,
  KnowledgeRequestStatus,
  Language,
  OutreachOutcome,
  RecordingConsentMode,
} from '@/shared/status-models';
import { OUTREACH_OUTCOMES } from '@/shared/status-models';

/** Small artificial latency so loading states render believably. */
const SIMULATED_LATENCY_MS = 120;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ==================================================================================
 * In-memory overlay — mutations write here; fetchers apply it after fixture reads.
 * A hard refresh resets it, which is acceptable and stated for a frontend-only build.
 * ================================================================================== */

interface Note {
  readonly at: string;
  readonly author: string;
  readonly body: string;
}

interface EscalationOverlay {
  status?: 'acknowledged' | 'resolved';
  acknowledgedAtUtc?: string;
  acknowledgedBy?: string;
  owner?: string;
  resolutionNote?: string;
  resolvedAtUtc?: string;
}

interface DispatchOverlay {
  status?: DispatchRecordView['status'];
  assignedPlumberId?: string | null;
  currentCandidateId?: string | null;
  notes?: Note[];
}

const overlay = {
  jobStatus: new Map<string, JobStatus>(),
  jobNotes: new Map<string, Note[]>(),
  escalations: new Map<string, EscalationOverlay>(),
  dispatch: new Map<string, DispatchOverlay>(),
  readNotifications: new Set<string>(),
  allNotificationsReadAt: null as string | null,
  knowledgeBlocks: new Map<string, LiveKnowledgeContentBlock[]>(),
  knowledgeRequests: new Map<string, LiveKnowledgeChangeRequest[]>(),
  flaggedInteractions: [] as { interactionId: string; reason: string; context: string; at: string }[],
};

/** Wall-clock "now" for user-initiated writes (notes, acknowledgements). */
function nowIso(): string {
  return new Date().toISOString();
}

function fixtureFor(session: Session): OrgFixture {
  return getFixture(session.orgId);
}

/* ==================================================================================
 * Jobs
 * ================================================================================== */

export type JobStatsDto = JobStats;

export interface LiveJobsSnapshot {
  readonly gated: GatedRows<JobView>;
  readonly stats: JobStatsDto;
}

function applyJobOverlay(job: JobView): JobView {
  const status = overlay.jobStatus.get(job.id);
  const notes = overlay.jobNotes.get(job.id);
  if (!status && !notes) return job;
  return {
    ...job,
    status: status ?? job.status,
    staffNotes: notes ? [...job.staffNotes, ...notes] : job.staffNotes,
    timeline: status
      ? [...job.timeline, { at: nowIso(), label: statusTimelineLabel(status), actor: 'Staff' }]
      : job.timeline,
  };
}

function statusTimelineLabel(status: JobStatus): string {
  switch (status) {
    case 'en_route': return 'En Route';
    case 'in_progress': return 'In Progress';
    case 'completed': return 'Completed';
    case 'canceled': return 'Canceled';
    default: return 'Status updated';
  }
}

export async function fetchLiveJobs(session: Session): Promise<LiveJobsSnapshot> {
  await delay(SIMULATED_LATENCY_MS);
  const fixture = fixtureFor(session);
  const gated = listJobs(fixture, session);
  const stats = jobStats(fixture, session);
  if (gated.kind === 'aggregate') return { gated, stats };
  const rows = gated.rows.map((row) => ({
    ...applyJobOverlay(row),
    needsAttention: jobNeedsAttention(row, fixture),
  }));
  return { gated: { kind: 'rows', rows }, stats };
}

export async function updateLiveJobStatus(session: Session, jobId: string, status: JobStatus): Promise<void> {
  if (!canPerformWorkflowActions(session)) return;
  overlay.jobStatus.set(jobId, status);
  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: 'job_status_change',
    objectRef: `job:${jobId}`,
    locationId: session.locationId,
    detail: { status },
  });
}

export async function addLiveJobNote(session: Session, jobId: string, body: string): Promise<void> {
  const notes = overlay.jobNotes.get(jobId) ?? [];
  notes.push({ at: nowIso(), author: session.actor, body });
  overlay.jobNotes.set(jobId, notes);
  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: 'note_edit',
    objectRef: `job:${jobId}`,
    locationId: session.locationId,
  });
}

export async function recordLiveCustomerSearch(session: Session, query: string): Promise<void> {
  if (query.trim().length === 0) return;
  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: 'customer_search',
    objectRef: `search:${query.slice(0, 40)}`,
    locationId: session.locationId,
  });
}

/**
 * The audited reveal. In a backend build the raw number would only ever be delivered
 * here; the mock keeps the same choke point.
 */
export async function revealLivePhone(session: Session, jobId: string): Promise<string | null> {
  const fixture = fixtureFor(session);
  const job = fixture.jobs.find((j) => j.id === jobId);
  const contact = job ? fixture.contacts.find((c) => c.id === job.contactId) : undefined;
  if (!contact?.identity || session.role === 'VIEWER') return null;
  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: 'phone_number_reveal',
    objectRef: `job:${jobId}`,
    locationId: session.locationId,
  });
  return contact.identity.phoneE164;
}

/** Flag-for-review, shared by Jobs, Conversations, and Dispatch drawers. */
export async function flagLiveInteraction(
  session: Session,
  interactionId: string,
  reason: string,
  context: string,
): Promise<void> {
  overlay.flaggedInteractions.push({ interactionId, reason, context, at: nowIso() });
  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: 'note_edit',
    objectRef: `flag:${interactionId}`,
    locationId: session.locationId,
    detail: { reason },
  });
}

/* ==================================================================================
 * Escalations
 * ================================================================================== */

export interface EscalationStatsDto {
  readonly total: number;
  readonly open: number;
  readonly overdue: number;
  readonly ackRate: number | null;
  readonly medianTimeToAckSeconds: number | null;
  readonly triggerCounts: Readonly<Record<string, number>>;
}

export interface LiveEscalationsSnapshot {
  readonly gated: GatedRows<EscalationView>;
  readonly stats: EscalationStatsDto;
}

function applyEscalationOverlay(row: EscalationView): EscalationView {
  const o = overlay.escalations.get(row.id);
  if (!o) return row;
  return {
    ...row,
    status: o.status ?? row.status,
    acknowledgedAtUtc: o.acknowledgedAtUtc ?? row.acknowledgedAtUtc,
    acknowledgedBy: o.acknowledgedBy ?? row.acknowledgedBy,
    owner: o.owner ?? row.owner,
    resolutionNote: o.resolutionNote ?? row.resolutionNote,
    resolvedAtUtc: o.resolvedAtUtc ?? row.resolvedAtUtc,
  };
}

function escalationStats(rows: readonly EscalationView[]): EscalationStatsDto {
  const open = rows.filter((e) => e.status === 'open');
  const acked = rows.filter((e) => e.acknowledgedAtUtc !== null);
  const eligible = rows.filter((e) => e.status !== 'open' || e.acknowledgedAtUtc !== null);

  const ackDurations = acked
    .map((e) => (new Date(e.acknowledgedAtUtc!).getTime() - new Date(e.atUtc).getTime()) / 1000)
    .filter((s) => s >= 0)
    .sort((a, b) => a - b);
  const median = ackDurations.length
    ? ackDurations[Math.floor(ackDurations.length / 2)]
    : null;

  const triggerCounts: Record<string, number> = {};
  for (const row of rows) triggerCounts[row.trigger] = (triggerCounts[row.trigger] ?? 0) + 1;

  return {
    total: rows.length,
    open: open.length,
    overdue: rows.filter((e) => isEscalationOverdue(e)).length,
    ackRate: rows.length ? acked.length / Math.max(1, eligible.length) : null,
    medianTimeToAckSeconds: median,
    triggerCounts,
  };
}

export async function fetchLiveEscalations(session: Session): Promise<LiveEscalationsSnapshot> {
  await delay(SIMULATED_LATENCY_MS);
  const fixture = fixtureFor(session);
  const gated = listEscalations(fixture, session);
  if (gated.kind === 'aggregate') {
    return { gated, stats: escalationStats([]) };
  }
  const rows = gated.rows.map(applyEscalationOverlay);
  return { gated: { kind: 'rows', rows }, stats: escalationStats(rows) };
}

export async function acknowledgeLiveEscalation(session: Session, escalationId: string): Promise<void> {
  const existing = overlay.escalations.get(escalationId) ?? {};
  overlay.escalations.set(escalationId, {
    ...existing,
    status: existing.status === 'resolved' ? 'resolved' : 'acknowledged',
    acknowledgedAtUtc: nowIso(),
    acknowledgedBy: session.actor,
    owner: existing.owner ?? session.actor,
  });
}

export async function assignLiveEscalationOwner(session: Session, escalationId: string, owner: string): Promise<void> {
  const existing = overlay.escalations.get(escalationId) ?? {};
  overlay.escalations.set(escalationId, { ...existing, owner });
}

export async function saveLiveEscalationNote(session: Session, escalationId: string, body: string): Promise<void> {
  const existing = overlay.escalations.get(escalationId) ?? {};
  overlay.escalations.set(escalationId, { ...existing, resolutionNote: body });
  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: 'note_edit',
    objectRef: `escalation:${escalationId}`,
    locationId: session.locationId,
  });
}

export async function resolveLiveEscalation(session: Session, escalationId: string, note: string): Promise<void> {
  const existing = overlay.escalations.get(escalationId) ?? {};
  overlay.escalations.set(escalationId, {
    ...existing,
    status: 'resolved',
    resolutionNote: note || existing.resolutionNote,
    resolvedAtUtc: nowIso(),
    acknowledgedAtUtc: existing.acknowledgedAtUtc ?? nowIso(),
    acknowledgedBy: existing.acknowledgedBy ?? session.actor,
  });
}

/* ==================================================================================
 * Calls & chats
 * ================================================================================== */

export interface LiveCallsSnapshot {
  readonly gated: GatedRows<CallInteractionView>;
  /** §5.1 Live Calls Now panel. */
  readonly active: readonly LiveCallNow[];
}

export async function fetchLiveCalls(session: Session): Promise<LiveCallsSnapshot> {
  await delay(SIMULATED_LATENCY_MS);
  const fixture = fixtureFor(session);
  return { gated: listCalls(fixture, session), active: fixture.liveCalls };
}

export interface LiveChatsSnapshot {
  readonly gated: GatedRows<ChatInteractionView>;
}

export async function fetchLiveChats(session: Session): Promise<LiveChatsSnapshot> {
  await delay(SIMULATED_LATENCY_MS);
  const fixture = fixtureFor(session);
  return { gated: listChats(fixture, session) };
}

export function recordLiveMediaAccess(session: Session, kind: 'recording_playback' | 'transcript_view', objectRef: string): void {
  if (!canAccessMedia(session)) return;
  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: kind,
    objectRef,
    locationId: session.locationId,
  });
}

/* ==================================================================================
 * Notifications — derived from operational state, plus a read overlay
 * ================================================================================== */

export interface LiveNotificationItem {
  readonly id: string;
  readonly agent: string;
  readonly eventType: string;
  readonly title: string;
  readonly body: string;
  readonly priority: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly locationId: string | null;
  readonly metadata: Record<string, unknown>;
  readonly readAt: string | null;
  readonly readBy: string | null;
  readonly createdAt: string;
}

export interface LiveNotificationCounts {
  readonly total: number;
  readonly unreadCount: number;
  readonly escalationsPending: number;
  readonly dispatchPending: number;
  readonly items: readonly LiveNotificationItem[];
}

export async function fetchLiveNotifications(session: Session): Promise<LiveNotificationCounts> {
  await delay(SIMULATED_LATENCY_MS);
  const fixture = fixtureFor(session);

  const escalations = scopeToLocation(fixture.escalations, session)
    .map((e) => ({ ...e, ...overlay.escalations.get(e.id) }))
    .filter((e) => e.status === 'open');
  const dispatch = scopeToLocation(fixture.dispatchRecords, session).filter(
    (d) => (overlay.dispatch.get(d.id)?.status ?? d.status) === 'exhausted',
  );
  const unhealthyLines = scopeToLocation(fixture.lines, session).filter((l) => !l.healthy);

  const items: LiveNotificationItem[] = [
    ...escalations.map((e) => ({
      id: `ntf_esc_${e.id}`,
      agent: 'system',
      eventType: 'escalation_open',
      title: `Escalation ${e.reference} needs acknowledgement`,
      body: e.reason,
      priority: e.severity === 'critical' ? 'high' : 'normal',
      entityType: 'escalation',
      entityId: e.id,
      locationId: e.locationId,
      metadata: {},
      readAt: null,
      readBy: null,
      createdAt: e.atUtc,
    })),
    ...dispatch.map((d) => ({
      id: `ntf_disp_${d.id}`,
      agent: 'dispatch',
      eventType: 'dispatch_exhausted',
      title: 'Dispatch exhausted — no plumber accepted',
      body: 'All eligible plumbers were contacted without an acceptance.',
      priority: 'high',
      entityType: 'dispatch',
      entityId: d.id,
      locationId: d.locationId,
      metadata: {},
      readAt: null,
      readBy: null,
      createdAt: d.startedAtUtc,
    })),
    ...unhealthyLines.map((l) => ({
      id: `ntf_line_${l.id}`,
      agent: 'system',
      eventType: 'line_health',
      title: `Line ${l.number} failing its health check`,
      body: 'Messages and calls on this line may not be delivered.',
      priority: 'normal',
      entityType: 'line',
      entityId: l.id,
      locationId: l.locationId,
      metadata: {},
      readAt: null,
      readBy: null,
      createdAt: l.lastCheckedUtc,
    })),
  ]
    .map((item) => {
      const read =
        overlay.readNotifications.has(item.id) ||
        (overlay.allNotificationsReadAt !== null && item.createdAt <= overlay.allNotificationsReadAt);
      return read ? { ...item, readAt: nowIso(), readBy: session.actor } : item;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const unread = items.filter((i) => i.readAt === null);

  return {
    total: items.length,
    unreadCount: unread.length,
    escalationsPending: escalations.length,
    dispatchPending: dispatch.length,
    items,
  };
}

export async function markLiveNotificationRead(session: Session, eventId: string, read = true): Promise<void> {
  if (read) overlay.readNotifications.add(eventId);
  else overlay.readNotifications.delete(eventId);
}

export async function markAllLiveNotificationsRead(_session: Session): Promise<void> {
  overlay.allNotificationsReadAt = nowIso();
}

/* ==================================================================================
 * Dispatch Queue
 * ================================================================================== */

export type DispatchStatsDto = DispatchCounts;

export interface LiveDispatchQueueSnapshot {
  readonly gated: GatedRows<DispatchRecordView>;
  readonly stats: DispatchStatsDto;
}

function applyDispatchOverlay(row: DispatchRecordView): DispatchRecordView {
  const o = overlay.dispatch.get(row.id);
  if (!o) return row;
  return {
    ...row,
    status: o.status ?? row.status,
    assignedPlumberId: o.assignedPlumberId !== undefined ? o.assignedPlumberId : row.assignedPlumberId,
    currentCandidateId: o.currentCandidateId !== undefined ? o.currentCandidateId : row.currentCandidateId,
    notes: o.notes ? [...row.notes, ...o.notes] : row.notes,
  };
}

export async function fetchLiveDispatchQueue(session: Session): Promise<LiveDispatchQueueSnapshot> {
  await delay(SIMULATED_LATENCY_MS);
  const fixture = fixtureFor(session);
  const gated = listDispatchRecords(fixture, session);
  const stats = dispatchCounts(fixture, session);
  if (gated.kind === 'aggregate') return { gated, stats };
  return { gated: { kind: 'rows', rows: gated.rows.map(applyDispatchOverlay) }, stats };
}

function dispatchAction(session: Session, dispatchId: string, action: string): void {
  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: 'dispatch_queue_action',
    objectRef: `dispatch:${dispatchId}`,
    locationId: session.locationId,
    detail: { action },
  });
}

export async function retryLiveDispatch(session: Session, dispatchId: string): Promise<void> {
  const existing = overlay.dispatch.get(dispatchId) ?? {};
  overlay.dispatch.set(dispatchId, { ...existing, status: 'contacting' });
  dispatchAction(session, dispatchId, 'retry_outreach');
}

export async function assignLiveDispatchManually(session: Session, dispatchId: string, plumberId: string): Promise<void> {
  const existing = overlay.dispatch.get(dispatchId) ?? {};
  overlay.dispatch.set(dispatchId, {
    ...existing,
    status: 'manually_assigned',
    assignedPlumberId: plumberId,
    currentCandidateId: null,
  });
  dispatchAction(session, dispatchId, 'assign_manually');
}

export async function changeLiveDispatchCandidate(session: Session, dispatchId: string, plumberId: string): Promise<void> {
  const existing = overlay.dispatch.get(dispatchId) ?? {};
  overlay.dispatch.set(dispatchId, { ...existing, currentCandidateId: plumberId, status: 'contacting' });
  dispatchAction(session, dispatchId, 'change_candidate');
}

export async function markLiveDispatchExhausted(session: Session, dispatchId: string): Promise<void> {
  const existing = overlay.dispatch.get(dispatchId) ?? {};
  overlay.dispatch.set(dispatchId, { ...existing, status: 'exhausted', currentCandidateId: null });
  dispatchAction(session, dispatchId, 'mark_exhausted');
}

/** §5.5 "Escalate" row action: hands the dispatch to a named team member for manual handling. */
export async function escalateLiveDispatch(session: Session, dispatchId: string, assignee: string): Promise<void> {
  const existing = overlay.dispatch.get(dispatchId) ?? {};
  const notes = existing.notes ?? [];
  notes.push({ at: nowIso(), author: session.actor, body: `Escalated to ${assignee} for manual handling.` });
  overlay.dispatch.set(dispatchId, { ...existing, notes });
  dispatchAction(session, dispatchId, 'escalate');
}

export async function addLiveDispatchNote(session: Session, dispatchId: string, body: string): Promise<void> {
  const existing = overlay.dispatch.get(dispatchId) ?? {};
  const notes = existing.notes ?? [];
  notes.push({ at: nowIso(), author: session.actor, body });
  overlay.dispatch.set(dispatchId, { ...existing, notes });
  dispatchAction(session, dispatchId, 'add_note');
}

/* ==================================================================================
 * Overview aggregates: telemetry / revenue / quality
 * ================================================================================== */

export interface TelemetryStatsDto {
  readonly callsToday: number;
  readonly minutesToday: number;
  readonly avgDurationSeconds: number | null;
  readonly avgCostPerInteractionUsd: number | null;
  readonly avgFirstAudioResponseMs: number | null;
  readonly mostRecentCall: { readonly atUtc: string; readonly firstAudioResponseMs: number } | null;
  readonly successRate: number | null;
  readonly completedCount: number;
  readonly attemptedCount: number;
  readonly interactionsByAgent: Readonly<Record<string, number>>;
  readonly overallVoice: number;
  readonly allChannels: number;
  readonly windowDays: number;
  readonly series: {
    readonly days: readonly string[];
    readonly calls: readonly number[];
    readonly minutes: readonly number[];
    readonly firstAudioMs: readonly (number | null)[];
  };
}

function dayKey(offsetDaysAgo: number): string {
  const d = new Date(mockNow().getTime() - offsetDaysAgo * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export async function fetchLiveTelemetry(session: Session): Promise<TelemetryStatsDto> {
  await delay(SIMULATED_LATENCY_MS);
  const fixture = fixtureFor(session);
  const base = telemetry(fixture, session);
  const calls = scopeToLocation(fixture.calls, session);
  const chats = scopeToLocation(fixture.chats, session);
  const windowDays = 30;

  const interactionsByAgent: Record<string, number> = {};
  for (const call of calls) {
    if (!isWithinTrailingDays(call.atUtc, windowDays)) continue;
    interactionsByAgent[call.agent] = (interactionsByAgent[call.agent] ?? 0) + 1;
  }
  for (const chat of chats) {
    if (!isWithinTrailingDays(chat.atUtc, windowDays)) continue;
    interactionsByAgent.chat = (interactionsByAgent.chat ?? 0) + 1;
  }

  const days: string[] = [];
  const callSeries: number[] = [];
  const minuteSeries: number[] = [];
  const firstAudioSeries: (number | null)[] = [];
  for (let d = windowDays - 1; d >= 0; d -= 1) {
    days.push(dayKey(d));
    const dayCalls = calls.filter((c) => Math.floor(daysSince(c.atUtc)) === d);
    callSeries.push(dayCalls.length);
    minuteSeries.push(Math.round(dayCalls.reduce((a, c) => a + c.durationSeconds, 0) / 60));
    firstAudioSeries.push(
      dayCalls.length
        ? Math.round(dayCalls.reduce((a, c) => a + c.firstAudioResponseMs, 0) / dayCalls.length)
        : null,
    );
  }

  const sorted = [...calls].sort((a, b) => b.atUtc.localeCompare(a.atUtc));
  const mostRecent = sorted[0] ?? null;

  return {
    callsToday: base.callsToday,
    minutesToday: base.minutesToday,
    avgDurationSeconds: base.avgDurationSeconds,
    avgCostPerInteractionUsd: base.avgCostPerInteractionUsd,
    avgFirstAudioResponseMs: base.avgFirstAudioResponseMs,
    mostRecentCall: mostRecent
      ? { atUtc: mostRecent.atUtc, firstAudioResponseMs: mostRecent.firstAudioResponseMs }
      : null,
    successRate: base.successRate,
    completedCount: base.completedCount,
    attemptedCount: base.attemptedCount,
    interactionsByAgent,
    overallVoice: calls.filter((c) => isWithinTrailingDays(c.atUtc, windowDays)).length,
    allChannels:
      calls.filter((c) => isWithinTrailingDays(c.atUtc, windowDays)).length +
      chats.filter((c) => isWithinTrailingDays(c.atUtc, windowDays)).length,
    windowDays,
    series: { days, calls: callSeries, minutes: minuteSeries, firstAudioMs: firstAudioSeries },
  };
}

export interface RevenueStatsDto {
  /** Null when Average Job Value is not configured — the card hides (§5.1). */
  readonly estimate: {
    readonly contributingCompletedJobs: number;
    readonly avgJobValueUsd: number;
    readonly totalUsd: number;
  } | null;
  readonly windowLabel: 'this_month';
}

export async function fetchLiveRevenue(session: Session): Promise<RevenueStatsDto> {
  await delay(SIMULATED_LATENCY_MS);
  const fixture = fixtureFor(session);
  const org = getOrgById(session.orgId);
  if (!org) return { estimate: null, windowLabel: 'this_month' };
  return { estimate: revenueInfluencedEstimate(fixture, org, session), windowLabel: 'this_month' };
}

export interface QualityStatsDto {
  readonly score: number | null;
  readonly trend30d: readonly (number | null)[];
  readonly optimizationEvents: number;
  readonly gradedCalls: number;
  readonly windowDays: number;
  readonly method: string;
}

export async function fetchLiveQuality(session: Session): Promise<QualityStatsDto> {
  await delay(SIMULATED_LATENCY_MS);
  const fixture = fixtureFor(session);
  const calls = scopeToLocation(fixture.calls, session);
  return {
    score: aggregateQualityScore(calls),
    trend30d: qualityTrend(calls, 30),
    optimizationEvents: optimizationEventsThisMonth(fixture),
    gradedCalls: calls.filter((c) => c.grade !== null).length,
    windowDays: 30,
    method: 'Average of per-interaction QA grades across all agents, trailing 30 days.',
  };
}

/* ==================================================================================
 * AI Receptionist stats (§5.6)
 * ================================================================================== */

export interface CategoryCountDto<K extends string> {
  readonly key: K;
  readonly count: number;
}

export interface AgentTrendDto {
  readonly days: readonly string[];
  readonly calls: readonly number[];
  readonly outcomes: readonly number[];
}

export interface ReceptionistStatsDto {
  readonly windowDays: number;
  readonly inboundCallsHandled: number;
  readonly jobsCreated: number;
  readonly jobCreationRate: number | null;
  readonly avgQaGrade: number | null;
  readonly outcomeDistribution: readonly CategoryCountDto<CallDisposition>[];
  readonly channelDistribution: readonly CategoryCountDto<IntakeChannel>[];
  readonly languageDistribution: readonly CategoryCountDto<Language>[];
  /** Handled calls and jobs created over time. */
  readonly trend: AgentTrendDto;
  readonly openFlags: number;
  readonly recentOptimizations: number;
}

export async function fetchLiveReceptionistStats(session: Session): Promise<ReceptionistStatsDto> {
  await delay(SIMULATED_LATENCY_MS);
  const fixture = fixtureFor(session);
  const windowDays = 30;
  const calls = scopeToLocation(fixture.calls, session).filter(
    (c) => c.agent === 'receptionist' && isWithinTrailingDays(c.atUtc, windowDays),
  );
  const handled = calls.filter((c) => c.disposition !== 'in_progress');
  const jobsCreated = handled.filter((c) => c.disposition === 'job_created');
  const intentful = handled.filter(
    (c) => !['voicemail', 'no_answer', 'abandoned', 'duplicate_request'].includes(c.disposition),
  );
  const graded = handled.filter((c) => c.grade !== null);

  const outcomeCounts = new Map<CallDisposition, number>();
  for (const c of handled) outcomeCounts.set(c.disposition, (outcomeCounts.get(c.disposition) ?? 0) + 1);

  const jobs = scopeToLocation(fixture.jobs, session).filter((j) => isWithinTrailingDays(j.createdAtUtc, windowDays));
  const channelCounts = new Map<IntakeChannel, number>();
  for (const j of jobs) channelCounts.set(j.intakeChannel, (channelCounts.get(j.intakeChannel) ?? 0) + 1);

  const languageCounts = new Map<Language, number>();
  for (const j of jobs) languageCounts.set(j.language, (languageCounts.get(j.language) ?? 0) + 1);

  const days: string[] = [];
  const callSeries: number[] = [];
  const jobSeries: number[] = [];
  for (let d = windowDays - 1; d >= 0; d -= 1) {
    days.push(dayKey(d));
    callSeries.push(handled.filter((c) => Math.floor(daysSince(c.atUtc)) === d).length);
    jobSeries.push(jobsCreated.filter((c) => Math.floor(daysSince(c.atUtc)) === d).length);
  }

  return {
    windowDays,
    inboundCallsHandled: handled.length,
    jobsCreated: jobsCreated.length,
    jobCreationRate: intentful.length ? jobsCreated.length / intentful.length : null,
    avgQaGrade: graded.length
      ? Math.round(graded.reduce((a, c) => a + (c.grade?.overall ?? 0), 0) / graded.length)
      : null,
    outcomeDistribution: [...outcomeCounts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count),
    channelDistribution: [...channelCounts.entries()].map(([key, count]) => ({ key, count })),
    languageDistribution: [...languageCounts.entries()].map(([key, count]) => ({ key, count })),
    trend: { days, calls: callSeries, outcomes: jobSeries },
    openFlags: fixture.flags.filter((f) => f.status !== 'resolved').length,
    recentOptimizations: fixture.optimizationEvents.filter((e) => e.agent === 'receptionist').length,
  };
}

/* ==================================================================================
 * Plumber Dispatch Agent stats (§5.7)
 * ================================================================================== */

export interface DispatchAgentStatsDto {
  readonly windowDays: number;
  readonly outboundCallsHandled: number;
  readonly assignmentsSecured: number;
  readonly assignmentRate: number | null;
  readonly avgQaGrade: number | null;
  readonly outreachOutcomeDistribution: readonly CategoryCountDto<OutreachOutcome>[];
  /** Outbound calls and accepted assignments over time. */
  readonly trend: AgentTrendDto;
  readonly openFlags: number;
  readonly recentOptimizations: number;
  readonly serviceAreasCovered: number;
}

export async function fetchLiveDispatchAgentStats(session: Session): Promise<DispatchAgentStatsDto> {
  await delay(SIMULATED_LATENCY_MS);
  const fixture = fixtureFor(session);
  const windowDays = 30;
  const calls = scopeToLocation(fixture.calls, session).filter(
    (c) => c.agent === 'dispatch' && isWithinTrailingDays(c.atUtc, windowDays),
  );
  const graded = calls.filter((c) => c.grade !== null);

  const records = scopeToLocation(fixture.dispatchRecords, session).filter((d) =>
    isWithinTrailingDays(d.startedAtUtc, windowDays),
  );
  const secured = records.filter((d) => d.status === 'accepted');

  const outcomeCounts = new Map<OutreachOutcome, number>();
  for (const record of records) {
    for (const attempt of record.attempts) {
      outcomeCounts.set(attempt.outcome, (outcomeCounts.get(attempt.outcome) ?? 0) + 1);
    }
  }

  const days: string[] = [];
  const callSeries: number[] = [];
  const acceptSeries: number[] = [];
  for (let d = windowDays - 1; d >= 0; d -= 1) {
    days.push(dayKey(d));
    callSeries.push(calls.filter((c) => Math.floor(daysSince(c.atUtc)) === d).length);
    acceptSeries.push(
      secured.filter((r) => r.acceptedAtUtc !== null && Math.floor(daysSince(r.acceptedAtUtc)) === d).length,
    );
  }

  return {
    windowDays,
    outboundCallsHandled: calls.length,
    assignmentsSecured: records.filter((d) => d.status === 'accepted' || d.status === 'manually_assigned').length,
    assignmentRate: records.length
      ? records.filter((d) => d.status === 'accepted' || d.status === 'manually_assigned').length / records.length
      : null,
    avgQaGrade: graded.length
      ? Math.round(graded.reduce((a, c) => a + (c.grade?.overall ?? 0), 0) / graded.length)
      : null,
    outreachOutcomeDistribution: OUTREACH_OUTCOMES.map((key) => ({
      key,
      count: outcomeCounts.get(key) ?? 0,
    })).filter((e) => e.count > 0),
    trend: { days, calls: callSeries, outcomes: acceptSeries },
    openFlags: fixture.flags.filter((f) => f.status !== 'resolved').length,
    recentOptimizations: fixture.optimizationEvents.filter((e) => e.agent === 'dispatch').length,
    serviceAreasCovered: fixture.org.serviceAreas.length,
  };
}

/* ==================================================================================
 * Agent Knowledge — content + change-request workflow, on an in-memory store
 * ================================================================================== */

export interface LiveKnowledgeEntry {
  readonly label: string;
  readonly value: string;
}

export interface LiveKnowledgeContentBlock {
  readonly id: string;
  readonly category: string;
  readonly locationId: string | null;
  readonly entries: readonly LiveKnowledgeEntry[];
  readonly updatedAtUtc: string;
  readonly updatedBy: string | null;
}

function knowledgeBlocksFor(session: Session): LiveKnowledgeContentBlock[] {
  let blocks = overlay.knowledgeBlocks.get(session.orgId);
  if (!blocks) {
    const fixture = fixtureFor(session);
    blocks = fixture.knowledgeBlocks.map((b: KnowledgeBlock, i: number) => ({
      id: `kb_${session.orgId}_${i}`,
      category: b.category,
      locationId: b.locationId,
      entries: b.entries,
      updatedAtUtc: mockNow().toISOString(),
      updatedBy: null,
    }));
    overlay.knowledgeBlocks.set(session.orgId, blocks);
  }
  return blocks;
}

export async function fetchLiveKnowledgeContent(session: Session): Promise<readonly LiveKnowledgeContentBlock[]> {
  await delay(SIMULATED_LATENCY_MS);
  return knowledgeBlocksFor(session);
}

export async function updateLiveKnowledgeContent(
  session: Session,
  id: string,
  entries: readonly LiveKnowledgeEntry[],
): Promise<LiveKnowledgeContentBlock> {
  const blocks = knowledgeBlocksFor(session);
  const index = blocks.findIndex((b) => b.id === id);
  if (index < 0) throw new Error('Knowledge block not found');
  const updated: LiveKnowledgeContentBlock = {
    ...blocks[index],
    entries,
    updatedAtUtc: nowIso(),
    updatedBy: session.actor,
  };
  blocks[index] = updated;
  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: 'knowledge_change_request',
    objectRef: `knowledge:${id}`,
    locationId: session.locationId,
    detail: { action: 'content_update' },
  });
  return updated;
}

export interface LiveKnowledgeChangeRequest {
  readonly id: string;
  readonly category: string;
  readonly proposedChange: string;
  readonly reason: string;
  readonly status: KnowledgeRequestStatus;
  readonly requestedBy: string;
  readonly requestedAtUtc: string;
  readonly history: readonly { readonly status: KnowledgeRequestStatus; readonly at: string }[];
}

function knowledgeRequestsFor(session: Session): LiveKnowledgeChangeRequest[] {
  let requests = overlay.knowledgeRequests.get(session.orgId);
  if (!requests) {
    const fixture = fixtureFor(session);
    requests = fixture.knowledgeRequests.map((r) => ({
      id: r.id,
      category: r.category,
      proposedChange: r.proposedChange,
      reason: r.reason,
      status: r.status,
      requestedBy: r.requestedBy,
      requestedAtUtc: r.requestedAtUtc,
      history: r.history.map((h) => ({ status: h.status, at: h.at })),
    }));
    overlay.knowledgeRequests.set(session.orgId, requests);
  }
  return requests;
}

export async function fetchLiveKnowledgeRequests(session: Session): Promise<readonly LiveKnowledgeChangeRequest[]> {
  await delay(SIMULATED_LATENCY_MS);
  return knowledgeRequestsFor(session);
}

export async function submitKnowledgeChangeRequest(
  session: Session,
  category: string,
  proposedChange: string,
  reason: string,
): Promise<LiveKnowledgeChangeRequest> {
  const requests = knowledgeRequestsFor(session);
  const request: LiveKnowledgeChangeRequest = {
    id: `kr_new_${requests.length + 1}`,
    category,
    proposedChange,
    reason,
    status: 'requested',
    requestedBy: session.actor,
    requestedAtUtc: nowIso(),
    history: [{ status: 'requested', at: nowIso() }],
  };
  requests.unshift(request);
  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: 'knowledge_change_request',
    objectRef: `knowledge_request:${request.id}`,
    locationId: session.locationId,
  });
  return request;
}

export async function updateLiveKnowledgeRequestStatus(
  session: Session,
  requestId: string,
  status: KnowledgeRequestStatus,
): Promise<LiveKnowledgeChangeRequest> {
  const requests = knowledgeRequestsFor(session);
  const index = requests.findIndex((r) => r.id === requestId);
  if (index < 0) throw new Error('Knowledge request not found');
  const updated: LiveKnowledgeChangeRequest = {
    ...requests[index],
    status,
    history: [...requests[index].history, { status, at: nowIso() }],
  };
  requests[index] = updated;
  return updated;
}

/* ==================================================================================
 * Lines and Numbers
 * ================================================================================== */

export const KNOWN_LINE_AGENTS = ['receptionist', 'dispatch', 'chat', 'review_taker', 'reengagement'] as const;
export type KnownLineAgent = (typeof KNOWN_LINE_AGENTS)[number];

export interface LiveLocationConfig {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly escalationForwardingNumber: string | null;
  readonly recordingConsentMode: RecordingConsentMode;
}

export interface LiveAgentLine {
  readonly agent: KnownLineAgent;
  readonly locationId: string;
  readonly number: string | null;
  readonly kind: 'voice' | 'chat' | null;
  readonly lastActiveUtc: string | null;
  readonly interactionCount: number;
  readonly healthy: boolean;
}

export interface LiveLinesSnapshot {
  readonly locations: readonly LiveLocationConfig[];
  readonly lines: readonly LiveAgentLine[];
}

export async function fetchLiveLines(session: Session): Promise<LiveLinesSnapshot> {
  await delay(SIMULATED_LATENCY_MS);
  const fixture = fixtureFor(session);
  const locations: LiveLocationConfig[] = fixture.org.locations.map((l: MockLocation) => ({
    id: l.id,
    name: l.name,
    timezone: l.timezone,
    escalationForwardingNumber: l.escalationForwardingNumber,
    recordingConsentMode: l.recordingConsentMode,
  }));

  const lines: LiveAgentLine[] = [];
  for (const location of fixture.org.locations) {
    const voiceLine = fixture.lines.find((l) => l.locationId === location.id && l.kind === 'voice');
    for (const agent of KNOWN_LINE_AGENTS) {
      const agentCalls = fixture.calls.filter((c) => c.agent === agent && c.locationId === location.id);
      const lastCall = agentCalls[0] ?? null;
      lines.push({
        agent,
        locationId: location.id,
        number: agent === 'chat' ? null : voiceLine?.number ?? null,
        kind: agent === 'chat' ? 'chat' : 'voice',
        lastActiveUtc: lastCall?.atUtc ?? null,
        interactionCount: agentCalls.length,
        healthy: agent === 'chat' ? true : voiceLine?.healthy ?? true,
      });
    }
  }

  return { locations, lines };
}

/* ==================================================================================
 * Escalation stats helper kept for pages importing it directly
 * ================================================================================== */

export async function fetchLiveEscalationStats(session: Session): Promise<EscalationStatsDto> {
  const snapshot = await fetchLiveEscalations(session);
  return snapshot.stats;
}

/** Minutes an open escalation has aged, for aging badges. */
export function escalationAgeMinutes(atUtc: string): number {
  return Math.max(0, Math.round(minutesSince(atUtc)));
}

/** True when the timestamp falls on the anchored "today". Re-exported for pages. */
export { isToday as isMockToday };
