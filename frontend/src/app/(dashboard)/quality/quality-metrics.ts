/**
 * QUALITY TAB — local derivations (§12.2, §12.3, §12.6).
 *
 * These are Quality-tab-only shapes (grade bands, per-agent rows, event markers, compliance
 * rates). The CROSS-TAB numbers — aggregate quality score, quality trend, loop counts,
 * optimization-events-this-month — are NOT re-derived here: they come from `@/lib/metrics`,
 * so the Overview §4.4 pulse and this tab read the identical implementation and cannot drift.
 */

import { daysSince, scopeToLocation } from '@/lib/metrics';
import { mockNow } from '@/mock/orgs';
import type { Session } from '@/mock/data-access';
import type { CallInteraction, GradeBreakdown, MockOrganization, OptimizationEvent, OrgFixture, QaGrade } from '@/mock/schema';
import type { LineMarker } from '@/components/charts/line-chart';
import type { HistogramBin } from '@/components/charts/histogram';
import {
  AGENT_IDS,
  ESCALATION_TRIGGERS,
  GRADING_DIMENSIONS,
  type AgentId,
  type GradingDimension,
  type OptimizationEventStatus,
} from '@/shared/status-models';

const MS_PER_DAY = 86_400_000;

/* ==================================================================================
 * §12.2 — Grade distribution histogram
 *
 * Bands chosen to open the tail below 70 (a failing call) and then tighten into 5-point
 * bins across the range where graded business calls actually land (78–96 in the fixture), so
 * the deployment lift moves calls visibly from the 80–84 band into the 90–94 band.
 * ================================================================================== */

interface GradeBand {
  readonly key: string;
  readonly label: string;
  /** Inclusive lower bound. */
  readonly min: number;
  /** Inclusive upper bound. */
  readonly max: number;
}

export const GRADE_BANDS: readonly GradeBand[] = [
  { key: 'lt70', label: '<70', min: 0, max: 69 },
  { key: '70-79', label: '70–79', min: 70, max: 79 },
  { key: '80-84', label: '80–84', min: 80, max: 84 },
  { key: '85-89', label: '85–89', min: 85, max: 89 },
  { key: '90-94', label: '90–94', min: 90, max: 94 },
  { key: '95-100', label: '95–100', min: 95, max: 100 },
];

export function gradeDistribution(calls: readonly CallInteraction[]): readonly HistogramBin[] {
  const graded = calls.filter((c): c is CallInteraction & { grade: QaGrade } => c.grade !== null);
  return GRADE_BANDS.map((band) => ({
    key: band.key,
    label: band.label,
    count: graded.filter((c) => c.grade.overall >= band.min && c.grade.overall <= band.max).length,
  }));
}

/* ==================================================================================
 * §12.2 — Aggregate grade breakdown (the five dimensions, averaged)
 *
 * Overall reuses the canonical `aggregateQualityScore`; the caller passes it in so there is
 * a single source of the headline number. This only averages the five sub-scores.
 * ================================================================================== */

export function aggregateBreakdown(calls: readonly CallInteraction[], overall: number): QaGrade {
  const graded = calls.filter((c): c is CallInteraction & { grade: QaGrade } => c.grade !== null);
  const breakdown = GRADING_DIMENSIONS.reduce((acc, dim: GradingDimension) => {
    const sum = graded.reduce((a, c) => a + c.grade.breakdown[dim], 0);
    acc[dim] = graded.length > 0 ? Math.round(sum / graded.length) : 0;
    return acc;
  }, {} as Record<GradingDimension, number>);
  return { overall, breakdown: breakdown as GradeBreakdown };
}

/* ==================================================================================
 * §12.2 — Per-agent quality table
 * ================================================================================== */

export type QualityTrend = 'up' | 'down' | 'flat';

export interface PerAgentQualityRow {
  readonly agent: AgentId;
  readonly gradedCount: number;
  readonly avgGrade: number;
  readonly trend: QualityTrend;
  readonly openOptimizationItems: number;
}

/**
 * Trend arrow: mean grade in the trailing 15 days vs the 15 days before that. A change of at
 * least 0.5 points flips the arrow; smaller moves read as flat.
 */
function agentTrend(agentCalls: readonly (CallInteraction & { grade: QaGrade })[]): QualityTrend {
  const recent = agentCalls.filter((c) => daysSince(c.atUtc) <= 15);
  const prior = agentCalls.filter((c) => daysSince(c.atUtc) > 15 && daysSince(c.atUtc) <= 30);
  if (recent.length === 0 || prior.length === 0) return 'flat';
  const mean = (rows: readonly (CallInteraction & { grade: QaGrade })[]): number =>
    rows.reduce((a, c) => a + c.grade.overall, 0) / rows.length;
  const delta = mean(recent) - mean(prior);
  if (delta >= 0.5) return 'up';
  if (delta <= -0.5) return 'down';
  return 'flat';
}

export function perAgentQuality(
  calls: readonly CallInteraction[],
  events: readonly OptimizationEvent[],
): readonly PerAgentQualityRow[] {
  const graded = calls.filter((c): c is CallInteraction & { grade: QaGrade } => c.grade !== null);

  return AGENT_IDS.map((agent): PerAgentQualityRow | null => {
    const agentCalls = graded.filter((c) => c.agent === agent);
    if (agentCalls.length === 0) return null;
    const sum = agentCalls.reduce((a, c) => a + c.grade.overall, 0);
    return {
      agent,
      gradedCount: agentCalls.length,
      avgGrade: Math.round(sum / agentCalls.length),
      trend: agentTrend(agentCalls),
      // "Open" = not yet verified (detected, in tuning, or deployed-awaiting-verification).
      openOptimizationItems: events.filter((e) => e.agent === agent && e.status !== 'verified').length,
    };
  }).filter((row): row is PerAgentQualityRow => row !== null);
}

/* ==================================================================================
 * §12.2 — Optimization events as markers on the trend line
 *
 * Marker x = the trend array index of the event's deployment day. `qualityTrend` fills
 * index `days - 1 - age`, so a deployment `age` whole-days ago lands at that same index.
 * Events with no deployment date, or deployed outside the window, produce no marker.
 * ================================================================================== */

export function optimizationMarkers(
  events: readonly OptimizationEvent[],
  days: number,
): readonly LineMarker[] {
  const markers: LineMarker[] = [];
  for (const event of events) {
    if (event.deployedAtUtc === null) continue;
    const age = Math.floor(daysSince(event.deployedAtUtc));
    const x = days - 1 - age;
    if (x < 0 || x >= days) continue;
    markers.push({ x, label: event.whatWasChanged });
  }
  return markers;
}

/**
 * Day labels for the trend x-axis, oldest → newest. Anchored to `MOCK_NOW_UTC` (never the
 * wall clock) and rendered in the given IANA timezone (§2.7: every displayed date carries an
 * explicit timezone, never the browser default).
 */
export function trendDayLabels(days: number, timeZone: string): readonly string[] {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' });
  const nowMs = mockNow().getTime();
  return Array.from({ length: days }, (_, i) => {
    const dayMs = nowMs - (days - 1 - i) * MS_PER_DAY;
    return fmt.format(new Date(dayMs));
  });
}

/* ==================================================================================
 * §12.6 — Compliance sub-panel (exactly three rates), each 0–100 or null
 * ================================================================================== */

export interface ComplianceRates {
  /** Mean of the Policy and Safety Compliance grading dimension across graded calls (target 100%). */
  readonly safetyPolicyCompliance: number | null;
  /** Share of two-party-consent calls with a recording that delivered the consent disclosure. */
  readonly disclosureDelivery: number | null;
  /** Share of escalations correctly triggered (canonical trigger + a routing destination). */
  readonly escalationCorrectness: number | null;
}

export function complianceRates(
  fixture: OrgFixture,
  org: MockOrganization,
  session: Session,
  scopedCalls: readonly CallInteraction[],
): ComplianceRates {
  // 1. Policy and safety compliance — grading dimension two (Compliance).
  const graded = scopedCalls.filter((c): c is CallInteraction & { grade: QaGrade } => c.grade !== null);
  const safetyPolicyCompliance =
    graded.length === 0
      ? null
      : Math.round(graded.reduce((a, c) => a + c.grade.breakdown.compliance, 0) / graded.length);

  // 2. Disclosure delivery — two-party-consent locations only.
  const twoPartyLocationIds = new Set(
    org.locations.filter((l) => l.recordingConsentMode === 'two_party').map((l) => l.id),
  );
  const recordedTwoParty = scopedCalls.filter(
    (c) => twoPartyLocationIds.has(c.locationId) && c.media !== null,
  );
  const disclosureDelivery =
    recordedTwoParty.length === 0
      ? null
      : Math.round(
          (recordedTwoParty.filter((c) => c.media?.consentDisclosureAtUtc != null).length /
            recordedTwoParty.length) *
            100,
        );

  // 3. Escalation correctness — a canonical trigger routed to a destination.
  const escalations = scopeToLocation(fixture.escalations, session);
  const validTriggers = new Set<string>(ESCALATION_TRIGGERS);
  const escalationCorrectness =
    escalations.length === 0
      ? null
      : Math.round(
          (escalations.filter((e) => validTriggers.has(e.trigger) && (e.owner ?? '').trim() !== '').length /
            escalations.length) *
            100,
        );

  return { safetyPolicyCompliance, disclosureDelivery, escalationCorrectness };
}

/* ==================================================================================
 * Timeline / flag ordering helpers
 * ================================================================================== */

/** Reverse-chronological by detection date (§12.4). */
export function sortEventsNewestFirst(
  events: readonly OptimizationEvent[],
): readonly OptimizationEvent[] {
  return [...events].sort(
    (a, b) => new Date(b.detectedAtUtc).getTime() - new Date(a.detectedAtUtc).getTime(),
  );
}

export function filterEventsByStatus(
  events: readonly OptimizationEvent[],
  statuses: readonly OptimizationEventStatus[] | null,
): readonly OptimizationEvent[] {
  if (statuses === null) return events;
  const set = new Set<string>(statuses);
  return events.filter((e) => set.has(e.status));
}
