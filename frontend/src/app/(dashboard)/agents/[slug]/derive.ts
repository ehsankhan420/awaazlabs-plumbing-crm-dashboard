/**
 * §2.6 — generic KPI derivation for the registry-driven custom-agent route.
 *
 * "Every agent, standard or custom, renders from the same schema... a metrics contract
 *  (list of KPI definitions it emits)... Custom enterprise agents therefore get a dashboard
 *  page with zero frontend work."
 *
 * Nothing in this file references an agent id, slug, or name. Every derivation is keyed by
 * the KPI *key* declared in the metrics contract (which is data), so a brand-new custom
 * agent gets the same treatment for free — that is the property that makes the §2.6 claim
 * true rather than a slogan. Where a metric cannot be faithfully derived from the fixture's
 * interactions, the value is `null` and the caller renders an em dash: never a fabricated
 * number.
 */

import type { CallInteraction, KpiDefinition } from '@/mock/schema';
import {
  JOB_PRIORITIES,
  JOB_PRIORITY_LABELS,
  type CallDisposition,
  type JobPriority,
} from '@/shared/status-models';
import { PRIORITY_SERIES } from '@/components/charts/series-map';
import { formatCount, formatDuration, formatMs, formatPercent, formatUsd, ratio } from '@/lib/format';
import { daysSince } from '@/lib/metrics';

/** Dispositions where the agent never actually connected to a person. */
const UNREACHED_DISPOSITIONS: readonly CallDisposition[] = ['no_answer', 'voicemail', 'abandoned'];

function countByDisposition(calls: readonly CallInteraction[], disposition: CallDisposition): number {
  return calls.filter((c) => c.disposition === disposition).length;
}

/**
 * The generic engine. Keyed purely by KPI key, never by agent. Returns `null` when the
 * metric is not derivable from the interaction fields present on the fixture — including the
 * case where the agent has no interactions attributed to it at all, which is how a freshly
 * registered custom agent behaves before it emits telemetry.
 */
function deriveRawValue(key: string, calls: readonly CallInteraction[]): number | null {
  // No interactions attributed to this agent => nothing is emitted yet for any metric.
  // Returning null (rendered as "—") is honest; a zero would imply we measured and found none.
  if (calls.length === 0) return null;

  const reached = calls.filter((c) => !UNREACHED_DISPOSITIONS.includes(c.disposition));
  const jobsCreated = countByDisposition(calls, 'job_created');
  const graded = calls.filter((c) => c.grade !== null);

  switch (key) {
    case 'calls':
    case 'followups_placed':
      return calls.length;
    case 'reached':
      return reached.length;
    case 'jobs_created':
      return jobsCreated;
    case 'reach_rate':
    case 'reached_rate':
      return ratio(reached.length, calls.length);
    case 'job_creation_rate':
      return ratio(jobsCreated, calls.length);
    case 'issues_detected':
      return countByDisposition(calls, 'existing_job_updated') + countByDisposition(calls, 'human_transfer');
    case 'avg_qa':
      return graded.length > 0
        ? Math.round(graded.reduce((acc, c) => acc + (c.grade?.overall ?? 0), 0) / graded.length)
        : null;
    case 'avg_handle_time':
      return calls.reduce((acc, c) => acc + c.durationSeconds, 0) / calls.length;
    case 'response_latency':
      return calls.reduce((acc, c) => acc + c.firstAudioResponseMs, 0) / calls.length;
    default:
      // Depends on a source this route does not read (published reviews, dispatch records,
      // revenue configuration, …): not derivable here.
      return null;
  }
}

function formatValue(value: number, format: KpiDefinition['format']): string {
  switch (format) {
    case 'count':
      return formatCount(value);
    case 'percent':
      return formatPercent(value);
    case 'duration_ms':
      return formatMs(value);
    case 'duration_s':
      return formatDuration(value);
    case 'currency_usd':
      return formatUsd(value);
  }
}

export interface DerivedKpi {
  readonly key: string;
  readonly label: string;
  /** Formatted value, or `—` when the metric is not yet derivable. */
  readonly display: string;
  readonly derivable: boolean;
  readonly tooltip: string;
}

const NOT_EMITTED =
  'This metric is not yet emitted by this agent — it will populate once the agent reports it. Shown as a dash rather than a fabricated zero.';

/** Map a metrics contract onto derived, display-ready KPI values. */
export function deriveKpis(
  contract: readonly KpiDefinition[],
  calls: readonly CallInteraction[],
): readonly DerivedKpi[] {
  return contract.map((kpi) => {
    const raw = deriveRawValue(kpi.key, calls);
    if (raw === null) {
      return {
        key: kpi.key,
        label: kpi.label,
        display: '—',
        derivable: false,
        tooltip: kpi.description ? `${kpi.description}. ${NOT_EMITTED}` : NOT_EMITTED,
      };
    }
    return {
      key: kpi.key,
      label: kpi.label,
      display: formatValue(raw, kpi.format),
      derivable: true,
      tooltip: kpi.description ?? '',
    };
  });
}

export interface TimeSeries {
  readonly labels: readonly string[];
  readonly values: readonly number[];
}

/** §2.6 primary chart: interactions attributed to the agent, bucketed by trailing week. */
export function interactionsOverTime(calls: readonly CallInteraction[], weeks = 8): TimeSeries {
  const values = new Array<number>(weeks).fill(0);
  for (const c of calls) {
    const age = daysSince(c.atUtc);
    if (age < 0) continue;
    const bucket = Math.floor(age / 7);
    if (bucket >= weeks) continue;
    values[weeks - 1 - bucket] += 1;
  }
  const labels = values.map((_, i) => {
    const weeksAgo = weeks - 1 - i;
    return weeksAgo === 0 ? 'This week' : `${weeksAgo}w ago`;
  });
  return { labels, values };
}

export interface DistributionSegmentData {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly color: string;
}

export interface PriorityDistribution {
  readonly segments: readonly DistributionSegmentData[];
  readonly total: number;
}

/**
 * §2.6-style distribution component: the agent's interactions by job priority. Colors
 * come from the frozen `PRIORITY_SERIES` binding in series-map.ts — the entity→color
 * binding is never inlined.
 */
export function priorityDistribution(calls: readonly CallInteraction[]): PriorityDistribution {
  const segments = JOB_PRIORITIES.map((priority: JobPriority): DistributionSegmentData => ({
    key: priority,
    label: JOB_PRIORITY_LABELS[priority],
    value: calls.filter((c) => c.priority === priority).length,
    color: PRIORITY_SERIES[priority],
  }));
  return { segments, total: calls.length };
}
