/**
 * §5.4 KPI metrics and the aging rule, computed from the escalation set.
 *
 * The past-threshold rule is the SAME rule the Overview attention banner uses
 * (`isEscalationOverdue` in `src/lib/metrics.ts`): open, and older than its severity's
 * acknowledgement threshold (§3.6: Attention 4h, Urgent 30m, Critical 15m). The threshold
 * minutes are never hardcoded — they come from `status-models.ts`.
 */

import { minutesSince } from '@/lib/metrics';
import { ratio } from '@/lib/format';
import {
  ESCALATION_ACK_THRESHOLD_MINUTES,
  ESCALATION_TRIGGERS,
  type EscalationSeverity,
  type EscalationStatus,
  type EscalationTrigger,
} from '@/shared/status-models';

/** The effective, override-aware shape the metrics operate on. */
export interface EscalationLike {
  readonly atUtc: string;
  readonly trigger: EscalationTrigger;
  readonly severity: EscalationSeverity;
  readonly status: EscalationStatus;
  readonly acknowledgedAtUtc: string | null;
}

/** §3.6 threshold per severity — read from the enum, never inlined. */
export function ackThresholdMinutes(severity: EscalationSeverity): number {
  return ESCALATION_ACK_THRESHOLD_MINUTES[severity];
}

/** §3.6 aging rule, identical to the attention banner's escalation branch. */
export function isPastThreshold(e: EscalationLike): boolean {
  if (e.status !== 'open') return false;
  return minutesSince(e.atUtc) > ackThresholdMinutes(e.severity);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface EscalationStats {
  readonly total: number;
  /** §5.4 "Open Escalations." */
  readonly open: number;
  /** §5.4 "Overdue Escalations" — open past their severity's threshold. */
  readonly overdue: number;
  readonly ackRate: number | null;
  readonly medianTimeToAckSeconds: number | null;
  readonly triggerCounts: Readonly<Record<EscalationTrigger, number>>;
}

export function computeEscalationStats(rows: readonly EscalationLike[]): EscalationStats {
  const open = rows.filter((e) => e.status === 'open');
  const acked = rows.filter((e) => e.acknowledgedAtUtc !== null);

  const ackDurations = acked
    .map((e) => (new Date(e.acknowledgedAtUtc as string).getTime() - new Date(e.atUtc).getTime()) / 1000)
    .filter((s) => s >= 0);

  const triggerCounts = Object.fromEntries(ESCALATION_TRIGGERS.map((t) => [t, 0])) as Record<
    EscalationTrigger,
    number
  >;
  for (const row of rows) triggerCounts[row.trigger] += 1;

  return {
    total: rows.length,
    open: open.length,
    overdue: rows.filter(isPastThreshold).length,
    ackRate: ratio(acked.length, rows.length),
    medianTimeToAckSeconds: median(ackDurations),
    triggerCounts,
  };
}
