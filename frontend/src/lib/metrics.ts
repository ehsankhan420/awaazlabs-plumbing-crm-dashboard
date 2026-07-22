/**
 * DERIVED METRICS — the single home for every number that appears on more than one tab.
 *
 * FROZEN FILE (Foundation).
 *
 * Cross-tab wirings hold **by construction** here, because each figure is computed exactly
 * once and imported by every surface that shows it:
 *   - Overview Quality Pulse        == Quality tab's current score
 *   - Overview Revenue Influenced   == configured Average Job Value × completed AI jobs
 *   - Assignment Rate agrees across Overview, Jobs, Dispatch Queue, Plumber Dispatch Agent
 */

import { mockNow } from '@/mock/orgs';
import type { Session } from '@/mock/data-access';
import type {
  CallInteraction,
  DispatchRecord,
  Job,
  MockOrganization,
  OrgFixture,
} from '@/mock/schema';
import {
  DISPATCH_ASSIGNMENT_THRESHOLD_MINUTES,
  ESCALATION_ACK_THRESHOLD_MINUTES,
  OPTIMIZATION_APPLIED_STATUSES,
  OPTIMIZATION_FLAGGED_STATUSES,
  isAssignmentActive,
  isAssignmentAssigned,
} from '@/shared/status-models';
import type { AssignmentStatus } from '@/shared/status-models';
import { ratio } from './format';

/* ==================================================================================
 * Scoping — the global location filter applies to every metric on every tab
 * ================================================================================== */

interface HasLocation {
  readonly locationId: string;
}

export function scopeToLocation<T extends HasLocation>(rows: readonly T[], session: Session): readonly T[] {
  if (session.locationId === null) return rows;
  return rows.filter((r) => r.locationId === session.locationId);
}

/* ==================================================================================
 * Elapsed time + time windows — all anchored to MOCK_NOW_UTC so fixture aging states
 * (overdue escalations, exhausted dispatches) are stable and reproducible.
 * ================================================================================== */

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

export function hoursSince(iso: string): number {
  return (mockNow().getTime() - new Date(iso).getTime()) / MS_PER_HOUR;
}

export function minutesSince(iso: string): number {
  return hoursSince(iso) * 60;
}

export function daysSince(iso: string): number {
  return (mockNow().getTime() - new Date(iso).getTime()) / MS_PER_DAY;
}

function isSameUtcDay(iso: string, reference: Date): boolean {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === reference.getUTCFullYear() &&
    d.getUTCMonth() === reference.getUTCMonth() &&
    d.getUTCDate() === reference.getUTCDate()
  );
}

export function isToday(iso: string): boolean {
  return isSameUtcDay(iso, mockNow());
}

/** Trailing N days, inclusive of now, exclusive of the future. */
export function isWithinTrailingDays(iso: string, days: number): boolean {
  const age = daysSince(iso);
  return age >= 0 && age <= days;
}

export function isWithinNextDays(iso: string, days: number): boolean {
  const age = daysSince(iso);
  return age < 0 && -age <= days;
}

/** "Delta vs same weekday last week" — the same UTC weekday, 7 days back. */
export function isSameWeekdayLastWeek(iso: string): boolean {
  const target = new Date(mockNow().getTime() - 7 * MS_PER_DAY);
  return isSameUtcDay(iso, target);
}

/** "This week" = trailing 7 days. */
export function isThisWeek(iso: string): boolean {
  return isWithinTrailingDays(iso, 7);
}

export function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = mockNow();
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth();
}

/* ==================================================================================
 * Aggregate quality score — THE canonical definition.
 * Overview's Quality Pulse and the Quality tab both read this function.
 * ================================================================================== */

export function aggregateQualityScore(calls: readonly CallInteraction[]): number | null {
  const graded = calls.filter((c) => c.grade !== null);
  if (graded.length === 0) return null;
  const sum = graded.reduce((acc, c) => acc + (c.grade?.overall ?? 0), 0);
  return Math.round(sum / graded.length);
}

/** 30-day trend sparkline. One implementation for Overview and Quality. */
export function qualityTrend(calls: readonly CallInteraction[], days: number): readonly number[] {
  const buckets: number[][] = Array.from({ length: days }, () => []);

  for (const call of calls) {
    if (call.grade === null) continue;
    const age = Math.floor(daysSince(call.atUtc));
    if (age < 0 || age >= days) continue;
    buckets[days - 1 - age].push(call.grade.overall);
  }

  // Carry the last known value across days with no graded calls, rather than plotting a
  // zero — a day with no calls is not a day of terrible quality.
  const out: number[] = [];
  let last = 0;
  for (const bucket of buckets) {
    if (bucket.length > 0) {
      last = bucket.reduce((a, b) => a + b, 0) / bucket.length;
    }
    out.push(Math.round(last * 10) / 10);
  }
  return out;
}

/** Quality loop stage counts. */
export interface LoopCounts {
  readonly callsCompleted: number;
  readonly analyzedAndGraded: number;
  readonly flaggedForOptimization: number;
  readonly optimizationsApplied: number;
}

export function loopCounts(fixture: OrgFixture, session: Session): LoopCounts {
  const calls = scopeToLocation(fixture.calls, session);
  const completed = calls.filter((c) => c.disposition !== 'abandoned' && c.disposition !== 'no_answer');

  return {
    callsCompleted: completed.length,
    analyzedAndGraded: calls.filter((c) => c.grade !== null).length,
    flaggedForOptimization: fixture.optimizationEvents.filter((e) =>
      (OPTIMIZATION_FLAGGED_STATUSES as readonly string[]).includes(e.status),
    ).length,
    optimizationsApplied: fixture.optimizationEvents.filter((e) =>
      (OPTIMIZATION_APPLIED_STATUSES as readonly string[]).includes(e.status),
    ).length,
  };
}

/** Count of optimization events this month. */
export function optimizationEventsThisMonth(fixture: OrgFixture): number {
  return fixture.optimizationEvents.filter((e) => isThisMonth(e.detectedAtUtc)).length;
}

/* ==================================================================================
 * Dispatch — §5.1 Dispatch KPI cards + §5.5 Dispatch Queue. One taxonomy, three surfaces.
 * ================================================================================== */

export interface DispatchCounts {
  /** Unassigned + Matching + Contacting + Awaiting Response combined. */
  readonly inDispatch: number;
  readonly byStatus: Readonly<Record<AssignmentStatus, number>>;
  /** Accepted + Manually Assigned, today. */
  readonly assignedToday: number;
  /** Assigned jobs ÷ jobs that entered dispatch (trailing 30 days). */
  readonly assignmentRate: number | null;
  /** Exhausted + overdue dispatch records. Destructive accent. */
  readonly needsAttention: number;
  readonly awaitingResponse: number;
  readonly unassigned: number;
}

/** A dispatch is overdue when it sits unassigned past its priority's threshold. */
export function isDispatchOverdue(record: DispatchRecord, job: Job | null): boolean {
  if (!isAssignmentActive(record.status)) return false;
  const priority = job?.priority ?? 'routine';
  return minutesSince(record.startedAtUtc) > DISPATCH_ASSIGNMENT_THRESHOLD_MINUTES[priority];
}

export function dispatchCounts(fixture: OrgFixture, session: Session): DispatchCounts {
  const rows = scopeToLocation(fixture.dispatchRecords, session);
  const jobsById = new Map(fixture.jobs.map((j) => [j.id, j]));

  const byStatus = {
    unassigned: 0,
    matching: 0,
    contacting: 0,
    awaiting_response: 0,
    accepted: 0,
    manually_assigned: 0,
    exhausted: 0,
  } as Record<AssignmentStatus, number>;
  for (const row of rows) byStatus[row.status] += 1;

  const assignedToday = rows.filter(
    (r) => isAssignmentAssigned(r.status) && r.acceptedAtUtc !== null && isToday(r.acceptedAtUtc),
  ).length;

  const entered30d = rows.filter((r) => isWithinTrailingDays(r.startedAtUtc, 30));
  const assigned30d = entered30d.filter((r) => isAssignmentAssigned(r.status));

  const overdue = rows.filter((r) => isDispatchOverdue(r, jobsById.get(r.jobId) ?? null));

  return {
    inDispatch: rows.filter((r) => isAssignmentActive(r.status)).length,
    byStatus,
    assignedToday,
    assignmentRate: ratio(assigned30d.length, entered30d.length),
    needsAttention: byStatus.exhausted + overdue.length,
    awaitingResponse: byStatus.awaiting_response,
    unassigned: byStatus.unassigned,
  };
}

/**
 * §5.5 aging presentation: neutral before threshold; amber when a Routine or Urgent
 * dispatch is approaching its threshold; red when exceeded or Exhausted.
 */
export type AgingLevel = 'none' | 'amber' | 'red';

export function dispatchAgingLevel(record: DispatchRecord, job: Job | null): AgingLevel {
  if (record.status === 'exhausted') return 'red';
  if (!isAssignmentActive(record.status)) return 'none';
  const priority = job?.priority ?? 'routine';
  const threshold = DISPATCH_ASSIGNMENT_THRESHOLD_MINUTES[priority];
  const age = minutesSince(record.startedAtUtc);
  if (age > threshold) return 'red';
  if (age > threshold * 0.7) return 'amber';
  return 'none';
}

/* ==================================================================================
 * Jobs — §5.1 Jobs KPI cards + §5.2 header cards
 * ================================================================================== */

export interface JobStats {
  readonly createdToday: number;
  readonly createdSameWeekdayLastWeek: number;
  readonly createdThisWeek: number;
  /** Jobs created ÷ completed inbound service-intent conversations, this week. */
  readonly jobCreationRateThisWeek: number | null;
  readonly scheduledNext7Days: number;
  readonly completedThisWeek: number;
  readonly canceledThisWeek: number;
  /** Completed ÷ (completed + other closed), this week. Canceled excluded from denominator. */
  readonly completionRateThisWeek: number | null;
  /** Completion rate over the trailing 30 days. Canceled excluded from the denominator. */
  readonly completionRate30d: number | null;
  /** Accepted + Manually Assigned ÷ entered dispatch (30 days). */
  readonly assignmentRate: number | null;
  readonly nextScheduledJob: { readonly customerName: string; readonly startsAtUtc: string } | null;
}

export function jobStats(fixture: OrgFixture, session: Session): JobStats {
  const jobs = scopeToLocation(fixture.jobs, session);
  const calls = scopeToLocation(fixture.calls, session);
  const chats = scopeToLocation(fixture.chats, session);

  const createdThisWeek = jobs.filter((j) => isThisWeek(j.createdAtUtc));

  // Denominator: completed inbound service-intent conversations (calls + chats).
  const completedInboundCalls = calls.filter(
    (c) =>
      c.direction === 'inbound' &&
      isThisWeek(c.atUtc) &&
      c.disposition !== 'abandoned' &&
      c.disposition !== 'no_answer' &&
      c.disposition !== 'voicemail',
  );
  const completedChatSessions = chats.filter((c) => isThisWeek(c.atUtc) && c.outcome !== 'abandoned');
  const completedInboundThisWeek = completedInboundCalls.length + completedChatSessions.length;

  const completedThisWeek = jobs.filter((j) => j.status === 'completed' && isThisWeek(j.createdAtUtc));
  const canceledThisWeek = jobs.filter((j) => j.status === 'canceled' && isThisWeek(j.createdAtUtc));
  const closedThisWeekNonCanceled = jobs.filter(
    (j) => isThisWeek(j.createdAtUtc) && (j.status === 'completed' || j.status === 'in_progress' || j.status === 'en_route'),
  );

  const trailing30 = jobs.filter((j) => isWithinTrailingDays(j.createdAtUtc, 30) && j.status !== 'canceled');
  const completed30 = trailing30.filter((j) => j.status === 'completed');

  const scheduled = jobs
    .filter(
      (j) =>
        j.status === 'scheduled' &&
        j.scheduledWindow !== null &&
        isWithinNextDays(j.scheduledWindow.startUtc, 7),
    )
    .sort((a, b) => (a.scheduledWindow!.startUtc < b.scheduledWindow!.startUtc ? -1 : 1));

  const contactsById = new Map(fixture.contacts.map((c) => [c.id, c]));
  const next = scheduled[0] ?? null;
  const nextContact = next ? contactsById.get(next.contactId) : undefined;

  const dispatch = dispatchCounts(fixture, session);

  return {
    createdToday: jobs.filter((j) => isToday(j.createdAtUtc)).length,
    createdSameWeekdayLastWeek: jobs.filter((j) => isSameWeekdayLastWeek(j.createdAtUtc)).length,
    createdThisWeek: createdThisWeek.length,
    jobCreationRateThisWeek: ratio(createdThisWeek.length, completedInboundThisWeek),
    scheduledNext7Days: scheduled.length,
    completedThisWeek: completedThisWeek.length,
    canceledThisWeek: canceledThisWeek.length,
    completionRateThisWeek: ratio(completedThisWeek.length, closedThisWeekNonCanceled.length),
    completionRate30d: ratio(completed30.length, trailing30.length),
    assignmentRate: dispatch.assignmentRate,
    nextScheduledJob:
      next && next.scheduledWindow
        ? {
            customerName: nextContact?.identity
              ? `${nextContact.identity.firstName} ${nextContact.identity.lastName}`
              : 'Customer',
            startsAtUtc: next.scheduledWindow.startUtc,
          }
        : null,
  };
}

/**
 * §5.2 Needs Attention scope: Ready for Dispatch jobs without active dispatch, Exhausted
 * dispatches, overdue Scheduled jobs without progress, and Emergency jobs without an
 * acknowledged escalation.
 */
export function jobNeedsAttention(job: Job, fixture: OrgFixture): boolean {
  if (job.status === 'ready_for_dispatch' && job.dispatchId === null) return true;

  if (job.dispatchId) {
    const dispatch = fixture.dispatchRecords.find((d) => d.id === job.dispatchId);
    if (dispatch?.status === 'exhausted') return true;
  }

  if (
    job.status === 'scheduled' &&
    job.scheduledWindow !== null &&
    hoursSince(job.scheduledWindow.startUtc) > 1
  ) {
    return true;
  }

  if (job.priority === 'emergency') {
    const acknowledged = fixture.escalations.some(
      (e) => e.jobId === job.id && (e.status === 'acknowledged' || e.status === 'resolved'),
    );
    if (!acknowledged) return true;
  }

  return false;
}

/* ==================================================================================
 * Revenue Influenced (§5.1) — an estimate, labeled as such.
 *
 * "Completed AI-created jobs multiplied by configured Average Job Value."
 * ================================================================================== */

export interface RevenueEstimate {
  /** Completed jobs created by an AI agent (voice or chat) this month. */
  readonly contributingCompletedJobs: number;
  readonly avgJobValueUsd: number;
  readonly totalUsd: number;
}

/**
 * Returns `null` when the org has not configured an Average Job Value — the card hides
 * entirely. Returning 0 would render a misleading $0.
 */
export function revenueInfluencedEstimate(
  fixture: OrgFixture,
  org: MockOrganization,
  session: Session,
): RevenueEstimate | null {
  if (org.avgJobValueUsd === null) return null;

  const jobs = scopeToLocation(fixture.jobs, session);
  const contributing = jobs.filter(
    (j) =>
      j.status === 'completed' &&
      isThisMonth(j.createdAtUtc) &&
      (j.createdBy === 'ai_receptionist' || j.createdBy === 'chat_agent'),
  );

  return {
    contributingCompletedJobs: contributing.length,
    avgJobValueUsd: org.avgJobValueUsd,
    totalUsd: contributing.length * org.avgJobValueUsd,
  };
}

/* ==================================================================================
 * Operational telemetry (§5.1)
 * ================================================================================== */

export interface Telemetry {
  readonly callsToday: number;
  readonly minutesToday: number;
  readonly avgDurationSeconds: number | null;
  readonly avgCostPerInteractionUsd: number | null;
  readonly avgFirstAudioResponseMs: number | null;
  readonly successRate: number | null;
  readonly completedCount: number;
  readonly attemptedCount: number;
  readonly liveCallsNow: number;
}

/** "Average First-Audio Response with an 800-millisecond target line." */
export const FIRST_AUDIO_TARGET_MS = 800;

export function telemetry(fixture: OrgFixture, session: Session): Telemetry {
  const calls = scopeToLocation(fixture.calls, session);
  const today = calls.filter((c) => isToday(c.atUtc));
  const chats = scopeToLocation(fixture.chats, session);

  const completed = calls.filter((c) => c.disposition !== 'abandoned' && c.disposition !== 'no_answer');
  const totalInteractions = calls.length + chats.length;
  const totalCost = calls.reduce((acc, c) => acc + c.costUsd, 0);

  return {
    callsToday: today.length,
    minutesToday: Math.round(today.reduce((acc, c) => acc + c.durationSeconds, 0) / 60),
    avgDurationSeconds: calls.length ? calls.reduce((a, c) => a + c.durationSeconds, 0) / calls.length : null,
    avgCostPerInteractionUsd: totalInteractions ? totalCost / totalInteractions : null,
    avgFirstAudioResponseMs: calls.length
      ? calls.reduce((a, c) => a + c.firstAudioResponseMs, 0) / calls.length
      : null,
    successRate: ratio(completed.length, calls.length),
    completedCount: completed.length,
    attemptedCount: calls.length,
    liveCallsNow: fixture.liveCalls.length,
  };
}

/* ==================================================================================
 * Attention banner (§5.1) — exactly the spec's five conditions.
 *
 * "Critical or overdue escalation. Dispatch record in Exhausted status. Urgent dispatch
 *  record beyond its assignment threshold. Voice or messaging line health failure.
 *  Usage at or above 90 percent of plan allocation."
 * ================================================================================== */

export interface AttentionCondition {
  readonly key: 'escalation' | 'dispatch_exhausted' | 'dispatch_overdue' | 'line_health' | 'usage_threshold';
  readonly message: string;
  readonly href: string;
  /** Critical items use the destructive variant. */
  readonly critical: boolean;
}

export const USAGE_BANNER_THRESHOLD = 0.9;

export function isEscalationOverdue(escalation: { status: string; atUtc: string; severity: keyof typeof ESCALATION_ACK_THRESHOLD_MINUTES }): boolean {
  if (escalation.status !== 'open') return false;
  return minutesSince(escalation.atUtc) > ESCALATION_ACK_THRESHOLD_MINUTES[escalation.severity];
}

export function attentionConditions(
  fixture: OrgFixture,
  org: MockOrganization,
  session: Session,
): readonly AttentionCondition[] {
  const conditions: AttentionCondition[] = [];

  // 1. Critical or overdue escalation.
  const escalations = scopeToLocation(fixture.escalations, session);
  const criticalOrOverdue = escalations.filter(
    (e) => e.status === 'open' && (e.severity === 'critical' || isEscalationOverdue(e)),
  );
  if (criticalOrOverdue.length > 0) {
    conditions.push({
      key: 'escalation',
      message: `${criticalOrOverdue.length} critical or overdue escalation${criticalOrOverdue.length === 1 ? '' : 's'} awaiting acknowledgement`,
      href: '/escalations',
      critical: true,
    });
  }

  // 2. Dispatch record in Exhausted status.
  const dispatch = scopeToLocation(fixture.dispatchRecords, session);
  const exhausted = dispatch.filter((d) => d.status === 'exhausted');
  if (exhausted.length > 0) {
    conditions.push({
      key: 'dispatch_exhausted',
      message: `${exhausted.length} dispatch${exhausted.length === 1 ? '' : 'es'} exhausted with no plumber assigned`,
      href: '/dispatch-queue',
      critical: true,
    });
  }

  // 3. Urgent dispatch record beyond its assignment threshold.
  const jobsById = new Map(fixture.jobs.map((j) => [j.id, j]));
  const overdueUrgent = dispatch.filter((d) => {
    const job = jobsById.get(d.jobId) ?? null;
    return (job?.priority === 'urgent' || job?.priority === 'emergency') && isDispatchOverdue(d, job);
  });
  if (overdueUrgent.length > 0) {
    conditions.push({
      key: 'dispatch_overdue',
      message: `${overdueUrgent.length} urgent dispatch${overdueUrgent.length === 1 ? '' : 'es'} past the assignment threshold`,
      href: '/dispatch-queue',
      critical: false,
    });
  }

  // 4. Voice or messaging line health failure.
  const unhealthy = scopeToLocation(fixture.lines, session).filter((l) => !l.healthy);
  if (unhealthy.length > 0) {
    conditions.push({
      key: 'line_health',
      message: `${unhealthy.length} phone line${unhealthy.length === 1 ? '' : 's'} failing its health check`,
      href: '/settings/lines',
      critical: false,
    });
  }

  // 5. Usage at or above 90% of plan allocation. Org-wide: a plan is not per-location.
  const usage = org.planMinutes > 0 ? fixture.minutesConsumed / org.planMinutes : 0;
  if (usage >= USAGE_BANNER_THRESHOLD) {
    conditions.push({
      key: 'usage_threshold',
      message: `Usage at ${Math.round(usage * 100)}% of plan minutes this cycle`,
      href: '/settings/billing',
      critical: false,
    });
  }

  return conditions;
}
