/**
 * Local view-model types for the §5.5 Dispatch Queue worklist.
 *
 * These describe optimistic UI state (row action results) and a per-row display model that
 * the table and the CSV export share, so a cell and its exported value can never disagree.
 * Nothing here re-declares a canonical status — statuses come from `@/shared/status-models`.
 */

import type { AgingLevel } from '@/lib/metrics';
import type { DispatchRecordView } from '@/mock/data-access';
import type { AssignmentStatus, JobPriority } from '@/shared/status-models';

/** One entry in the displayed status timeline. */
export interface DisplayTimelineEntry {
  readonly at: string;
  readonly status: AssignmentStatus;
  readonly actor: string;
  /** Optional human note attached by a row action (retry, escalation, manual assignment). */
  readonly note?: string;
}

/**
 * Optimistic per-row overrides. The fixture is read-only, so a row action mutates only
 * this local map, never the record.
 */
export interface DispatchOverride {
  /** New effective status after Retry / Assign Manually / Mark Exhausted. */
  readonly status?: AssignmentStatus;
  readonly assignedPlumberId?: string | null;
  readonly currentCandidateId?: string | null;
  readonly extraTimeline: readonly DisplayTimelineEntry[];
  readonly extraNotes: readonly { readonly at: string; readonly body: string }[];
}

/**
 * One display row, computed once in the client from the projected record + overrides,
 * then consumed identically by the table and the exporter. `phoneMasked` is the ONLY
 * phone value that ever leaves the projection here — the raw number is never read.
 */
export interface DispatchRowVM {
  readonly record: DispatchRecordView;
  readonly effectiveStatus: AssignmentStatus;
  readonly effectiveCandidateName: string | null;
  readonly effectivePlumberName: string | null;
  readonly customerName: string;
  readonly phoneMasked: string;
  readonly jobReference: string;
  readonly issueJobType: string;
  readonly priority: JobPriority;
  /** Requested window formatted in the row's location timezone, or '—'. */
  readonly requestedWindowLabel: string;
  readonly ageMinutes: number;
  readonly agingLevel: AgingLevel;
  readonly lastAttempt: string;
  readonly attemptsCount: number;
  readonly serviceAreaName: string;
  readonly locationName: string;
  readonly timezone: string;
}
