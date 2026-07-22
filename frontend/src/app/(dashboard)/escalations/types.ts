/**
 * §5.4 Escalations — view-model types and the trigger→color binding.
 *
 * The canonical enums (`EscalationStatus`, `EscalationSeverity`, `EscalationTrigger`) are
 * imported from `@/shared/status-models`; nothing is re-declared here.
 */

import type { EscalationView } from '@/mock/data-access';
import type { EscalationSeverity, EscalationStatus, EscalationTrigger } from '@/shared/status-models';

/** Optimistic ownership / acknowledgement state. The fixture is read-only, so a tap records here. */
export interface EscalationOverride {
  readonly status?: EscalationStatus;
  readonly acknowledgedAtUtc?: string;
  readonly acknowledgedBy?: string;
  readonly owner?: string;
  readonly resolutionNote?: string;
  readonly resolvedAtUtc?: string;
}

/** One resolved source link (§5.4 "Source links to Call, Chat, Job, or Dispatch."). */
export interface EscalationSourceLink {
  readonly kind: 'call' | 'chat' | 'job' | 'dispatch';
  readonly href: string;
  readonly label: string;
}

export interface EscalationRowVM {
  readonly record: EscalationView;
  readonly customerName: string;
  readonly source: EscalationSourceLink | null;
  readonly triggerLabel: string;
  readonly severity: EscalationSeverity;
  readonly effectiveStatus: EscalationStatus;
  readonly owner: string | null;
  readonly acknowledgedAtUtc: string | null;
  readonly acknowledgedBy: string | null;
  readonly resolutionNote: string | null;
  readonly locationName: string;
  readonly timezone: string;
  readonly timestampLabel: string;
  readonly ackTimestampLabel: string | null;
  readonly ageMinutes: number;
  /** §3.6 threshold minutes for this severity. */
  readonly thresholdMinutes: number;
  /** Open past its severity's acknowledgement threshold — aging badge + banner membership. */
  readonly pastThreshold: boolean;
}

/**
 * Trigger → categorical color, one fixed binding assigned once in `ESCALATION_TRIGGERS`
 * order (never cycled), so color follows the entity and filtering never repaints
 * survivors. Safety-critical triggers take the reserved status tokens because they carry
 * a genuine severity meaning.
 */
export const TRIGGER_SERIES: Readonly<Record<EscalationTrigger, string>> = {
  customer_requested_human: 'var(--chart-1)',
  emergency_condition: 'hsl(var(--destructive))',
  safety_risk: 'var(--status-warning)',
  out_of_service_area: 'var(--chart-2)',
  no_suitable_plumber: 'var(--chart-3)',
  dispatch_exhausted: 'var(--chart-4)',
  agent_failure: 'var(--chart-5)',
};
