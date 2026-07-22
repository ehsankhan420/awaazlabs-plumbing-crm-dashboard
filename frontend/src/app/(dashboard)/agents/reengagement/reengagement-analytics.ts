/**
 * §14.1 / §14.2 REENGAGEMENT DERIVATIONS — pure functions, no JSX.
 *
 * The six-stage funnel builder lives here and is imported by BOTH the §14.1 agent tab and
 * the §14.2 campaign-detail view, which is what makes the two funnels literally identical
 * (spec §14.2: "Funnel identical to 14.1 scoped to the campaign") rather than two lookalike
 * derivations that could drift.
 *
 * Interpretation note (see reengagement_campaigns_audit.md): the canonical campaign-contact
 * status model (§17) has six states — queued > attempted > reached > booked | exhausted |
 * opt_out — which do not map one-to-one onto the funnel's six stages. The mapping below is
 * documented and monotonic; it is not fabricated. "Audience" is the set of contacts entered
 * into the campaign pipeline (the tracked unit), which is distinct from the configured
 * "audience size" shown in the §14.2 list column.
 */

import type { FunnelStage } from '@/components/charts/funnel';
import { ratio } from '@/lib/format';
import { scopeToLocation } from '@/lib/metrics';
import type { Session } from '@/mock/data-access';
import type { CallInteraction, Campaign, CampaignContact, OrgFixture } from '@/mock/schema';
import type { CampaignContactStatus } from '@/shared/status-models';

/* ==================================================================================
 * The six-stage funnel (spec §14.1)
 *   audience → contacted → reached → conversation completed → booking intent → booked
 * ================================================================================== */

/** Live-answer states: the contact actually spoke with the agent. */
const REACHED_STATUSES: ReadonlySet<CampaignContactStatus> = new Set(['reached', 'opted_out', 'job_created']);
/** Everyone reached completed a conversation (opt_out declined *after* being reached). */
const CONVERSATION_STATUSES: ReadonlySet<CampaignContactStatus> = new Set(['reached', 'opted_out', 'job_created']);
/** Booking intent: considered booking. opt_out drops here — reached, but declined. */
const INTENT_STATUSES: ReadonlySet<CampaignContactStatus> = new Set(['reached', 'job_created']);

export interface ReengagementFunnel {
  readonly stages: readonly FunnelStage[];
  readonly audience: number;
  readonly contacted: number;
  readonly reached: number;
  readonly conversationsCompleted: number;
  readonly bookingIntent: number;
  readonly booked: number;
}

/**
 * Build the funnel from a set of campaign contacts. Every stage is a superset filter of the
 * next, so counts are guaranteed monotonically non-increasing.
 */
export function reengagementFunnel(contacts: readonly CampaignContact[]): ReengagementFunnel {
  const audience = contacts.length;
  const contacted = contacts.filter((c) => c.attempts > 0).length;
  const reached = contacts.filter((c) => REACHED_STATUSES.has(c.status)).length;
  const conversationsCompleted = contacts.filter((c) => CONVERSATION_STATUSES.has(c.status)).length;
  const bookingIntent = contacts.filter((c) => INTENT_STATUSES.has(c.status)).length;
  const booked = contacts.filter((c) => c.status === 'job_created').length;

  const stages: readonly FunnelStage[] = [
    { key: 'audience', label: 'Audience', count: audience },
    { key: 'contacted', label: 'Contacted', count: contacted },
    { key: 'reached', label: 'Reached', count: reached },
    { key: 'conversation_completed', label: 'Conversation completed', count: conversationsCompleted },
    { key: 'booking_intent', label: 'Booking intent', count: bookingIntent },
    { key: 'job_created', label: 'Job created', count: booked },
  ];

  return { stages, audience, contacted, reached, conversationsCompleted, bookingIntent, booked };
}

/** Relief-channel table for the funnel: stage, count, conversion from the prior stage. */
export function funnelTableData(stages: readonly FunnelStage[]): {
  columns: readonly string[];
  rows: ReadonlyArray<readonly string[]>;
} {
  return {
    columns: ['Stage', 'Count', 'Conversion from prior'],
    rows: stages.map((s, i) => {
      const prev = i > 0 ? stages[i - 1].count : null;
      const conv = prev !== null ? ratio(s.count, prev) : null;
      return [s.label, String(s.count), conv === null ? '—' : `${Math.round(conv * 100)}%`];
    }),
  };
}

/* ==================================================================================
 * §14.1 stat cards
 * ================================================================================== */

export interface ReengagementStats {
  readonly contactsAttempted: number;
  readonly reached: number;
  /** reached ÷ contacted. */
  readonly reachRate: number | null;
  readonly conversationsCompleted: number;
  readonly bookings: number;
  /** booked ÷ reached (spec: "conversion rate from reached"). */
  readonly bookingConversionFromReached: number | null;
  readonly optOuts: number;
  /** mean attempts across contacts that booked. */
  readonly avgAttemptsPerBooking: number | null;
}

export function reengagementStats(contacts: readonly CampaignContact[]): ReengagementStats {
  const f = reengagementFunnel(contacts);
  const bookedContacts = contacts.filter((c) => c.status === 'job_created');
  const totalBookedAttempts = bookedContacts.reduce((acc, c) => acc + c.attempts, 0);

  return {
    contactsAttempted: f.contacted,
    reached: f.reached,
    reachRate: ratio(f.reached, f.contacted),
    conversationsCompleted: f.conversationsCompleted,
    bookings: f.booked,
    bookingConversionFromReached: ratio(f.booked, f.reached),
    // §14.1: "Opt-outs generated (auto-writes to suppression)". Count the opt-out flag.
    optOuts: contacts.filter((c) => c.optOut).length,
    avgAttemptsPerBooking: bookedContacts.length > 0 ? totalBookedAttempts / bookedContacts.length : null,
  };
}

/* ==================================================================================
 * Aggregation helpers for the §14.1 agent tab (all reengagement campaigns in scope)
 * ================================================================================== */

/** Reengagement-type campaigns visible under the current location filter. */
export function reengagementCampaigns(fixture: OrgFixture, session: Session): readonly Campaign[] {
  return scopeToLocation(fixture.campaigns, session).filter((c) => c.type === 'reengagement');
}

export function reengagementContacts(fixture: OrgFixture, session: Session): readonly CampaignContact[] {
  return reengagementCampaigns(fixture, session).flatMap((c) => c.contacts);
}

/* ==================================================================================
 * §14.1 best-contact-window heatmap — reach rate by hour-of-day × day-of-week
 *
 * Data source: the reengagement agent's outbound calls. A call "reached" the contact when
 * its disposition is anything other than no-answer, voicemail, or abandoned. Timestamps are
 * bucketed in the *location's* timezone (§2.7), never the browser's.
 * ================================================================================== */

const NOT_REACHED_DISPOSITIONS: ReadonlySet<CallInteraction['disposition']> = new Set([
  'no_answer',
  'voicemail',
  'abandoned',
]);

/** Monday-first day rows, matching how a front desk reads a work week. */
export const HEATMAP_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const WEEKDAY_TO_ROW: Readonly<Record<string, number>> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/** Business-leaning outbound window; keeps the grid legible instead of 24 sparse columns. */
export const HEATMAP_HOURS: readonly number[] = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

function localDayHour(iso: string, timeZone: string): { row: number; col: number } | null {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '';
  const row = WEEKDAY_TO_ROW[weekday];
  // Intl can emit "24" for midnight under hour12:false; normalise to 0.
  const hour = Number.parseInt(hourStr, 10) % 24;
  const col = HEATMAP_HOURS.indexOf(hour);
  if (row === undefined || col === -1) return null;
  return { row, col };
}

export interface HeatmapResult {
  /** `values[row][col]` = reach-rate percentage (0–100), or null for no calls in that cell. */
  readonly values: ReadonlyArray<ReadonlyArray<number | null>>;
  readonly hourLabels: readonly string[];
  readonly totalCalls: number;
}

function hourLabel(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

export function reachRateHeatmap(
  fixture: OrgFixture,
  session: Session,
  timezoneFor: (locationId: string) => string,
): HeatmapResult {
  const calls = scopeToLocation(fixture.calls, session).filter((c) => c.agent === 'reengagement');

  const reachedGrid: number[][] = HEATMAP_DAY_LABELS.map(() => HEATMAP_HOURS.map(() => 0));
  const totalGrid: number[][] = HEATMAP_DAY_LABELS.map(() => HEATMAP_HOURS.map(() => 0));

  for (const call of calls) {
    const cell = localDayHour(call.atUtc, timezoneFor(call.locationId));
    if (!cell) continue;
    totalGrid[cell.row][cell.col] += 1;
    if (!NOT_REACHED_DISPOSITIONS.has(call.disposition)) reachedGrid[cell.row][cell.col] += 1;
  }

  const values = totalGrid.map((cols, r) =>
    cols.map((total, c) => (total === 0 ? null : Math.round((reachedGrid[r][c] / total) * 100))),
  );

  return {
    values,
    hourLabels: HEATMAP_HOURS.map(hourLabel),
    totalCalls: calls.length,
  };
}
