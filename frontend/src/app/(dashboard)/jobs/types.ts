/**
 * Jobs tab — shared client-side types and pure helpers. Spec §5.2.
 *
 * FILTER + SORT state live here so the table and the calendar view consume the same
 * filtered, sorted rows. No color, no `any`, no status string literals — every
 * status/label comes from `@/shared/status-models`.
 */

import type {
  AssignmentStatus,
  IntakeChannel,
  IssueType,
  JobPriority,
  JobStatus,
  Language,
  Specialty,
} from '@/shared/status-models';
import type { ServiceWindow } from '@/mock/schema';
import { formatDate, formatTime } from '@/lib/format';

/** §5.2 filter set. `'all'` = unfiltered. */
export interface JobFilters {
  /** Search by customer name, phone, job reference, ZIP code, or service address. */
  readonly search: string;
  readonly status: JobStatus | 'all';
  readonly assignmentStatus: AssignmentStatus | 'none' | 'all';
  readonly priority: JobPriority | 'all';
  readonly issueType: IssueType | 'all';
  readonly intakeChannel: IntakeChannel | 'all';
  readonly requiredSpecialty: Specialty | 'all';
  readonly assignedPlumberId: string | 'all';
  readonly serviceAreaId: string | 'all';
  /** Location id, or `'all'`. Only surfaced when the org is multi-location. */
  readonly locationId: string | 'all';
  readonly language: Language | 'all';
  /** yyyy-mm-dd, inclusive lower bound on the job's local creation date. '' = open. */
  readonly dateFrom: string;
  /** yyyy-mm-dd, inclusive upper bound. '' = open. */
  readonly dateTo: string;
}

export const DEFAULT_FILTERS: JobFilters = {
  search: '',
  status: 'all',
  assignmentStatus: 'all',
  priority: 'all',
  issueType: 'all',
  intakeChannel: 'all',
  requiredSpecialty: 'all',
  assignedPlumberId: 'all',
  serviceAreaId: 'all',
  locationId: 'all',
  language: 'all',
  dateFrom: '',
  dateTo: '',
};

/** Sortable columns. */
export type SortKey = 'window' | 'created' | 'name' | 'status' | 'priority';

export interface SortState {
  readonly key: SortKey;
  readonly dir: 'asc' | 'desc';
}

/** Default table order: newest work first. */
export const DEFAULT_SORT: SortState = { key: 'created', dir: 'desc' };

/** Severity order for sorting the priority column (Routine < Urgent < Emergency). */
export const PRIORITY_ORDER: Readonly<Record<JobPriority, number>> = {
  routine: 0,
  urgent: 1,
  emergency: 2,
};

/**
 * §5.2 "The calendar displays Requested Service Window until a Scheduled Arrival Window
 * exists." The effective window is the one the calendar groups and the table shows first.
 */
export function effectiveWindow(job: {
  readonly requestedWindow: ServiceWindow | null;
  readonly scheduledWindow: ServiceWindow | null;
}): { window: ServiceWindow; kind: 'scheduled' | 'requested' } | null {
  if (job.scheduledWindow) return { window: job.scheduledWindow, kind: 'scheduled' };
  if (job.requestedWindow) return { window: job.requestedWindow, kind: 'requested' };
  return null;
}

/** "Jul 9 · 8:00–11:00 AM" in the row's location timezone. */
export function formatWindow(window: ServiceWindow, timeZone: string): string {
  return `${formatDate(window.startUtc, timeZone)} · ${formatTime(window.startUtc, timeZone)}–${formatTime(window.endUtc, timeZone)}`;
}

/**
 * Calendar date key (yyyy-mm-dd) in a given IANA timezone. Used only for grouping and
 * range comparison in the calendar and the date-range filter — never for display, which
 * always goes through `@/lib/format`. `en-CA` yields ISO-ordered y-m-d.
 */
export function localDateKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** A run of `count` consecutive yyyy-mm-dd keys (UTC) starting at `anchor`. */
export function dateKeyWindow(anchor: Date, count: number): readonly string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(anchor.getTime() + i * 86_400_000);
    keys.push(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d),
    );
  }
  return keys;
}
