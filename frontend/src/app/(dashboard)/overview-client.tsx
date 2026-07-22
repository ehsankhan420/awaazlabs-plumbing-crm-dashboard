'use client';

/**
 * §5.1 Overview — the daily-glance page for owners, managers, and dispatchers.
 *
 * Content order is the spec's product decision: page header, Needs Your Attention banner,
 * Live Calls Now panel, Jobs, Dispatch, Revenue Influenced, Quality Pulse, Operational
 * Telemetry. Business outcomes render before technical telemetry, and every card links to
 * the page that owns the underlying records.
 */

import React, { useMemo } from 'react';

import { PageHeader } from '@/components/ui/page-header';
import { LiveCallsPanel } from '@/components/live/live-calls-panel';
import {
  useLiveCalls,
  useLiveDispatchQueue,
  useLiveJobs,
  useLiveQuality,
  useLiveRevenue,
  useLiveTelemetry,
} from '@/hooks/use-dashboard-live';
import { formatDateTime, displayTimezone } from '@/lib/format';
import { attentionConditions, type DispatchCounts, type JobStats, type RevenueEstimate } from '@/lib/metrics';
import { listCalls, type CallInteractionView, type GatedRows } from '@/mock/data-access';
import { getFixture } from '@/mock/fixtures';
import { useSession } from '@/shared/session-context';

import { AttentionBanner } from './overview/sections/attention-banner';
import { JobsSection } from './overview/sections/jobs-section';
import { DispatchSection } from './overview/sections/dispatch-section';
import { RevenueSection } from './overview/sections/revenue-section';
import { QualitySection } from './overview/sections/quality-section';
import { TelemetrySection } from './overview/sections/telemetry-section';

const EMPTY_DISPATCH_COUNTS: DispatchCounts = {
  inDispatch: 0,
  byStatus: {
    unassigned: 0,
    matching: 0,
    contacting: 0,
    awaiting_response: 0,
    accepted: 0,
    manually_assigned: 0,
    exhausted: 0,
  },
  assignedToday: 0,
  assignmentRate: null,
  needsAttention: 0,
  awaitingResponse: 0,
  unassigned: 0,
};

const EMPTY_JOB_STATS: JobStats = {
  createdToday: 0,
  createdSameWeekdayLastWeek: 0,
  createdThisWeek: 0,
  jobCreationRateThisWeek: null,
  scheduledNext7Days: 0,
  completedThisWeek: 0,
  canceledThisWeek: 0,
  completionRateThisWeek: null,
  completionRate30d: null,
  assignmentRate: null,
  nextScheduledJob: null,
};

/** Fills gap days (null) in the quality trend by carrying the last graded value forward. */
function forwardFillTrend(values: readonly (number | null)[]): number[] {
  const firstKnown = values.find((v): v is number => v !== null);
  if (firstKnown === undefined) return [];
  let last = firstKnown;
  return values.map((v) => {
    if (v !== null) last = v;
    return last;
  });
}

function liveCallsHref(snapshot: GatedRows<CallInteractionView>): string {
  if (snapshot.kind !== 'rows') return '/conversations/calls';
  const active = [...snapshot.rows]
    .filter((call) => call.disposition === 'in_progress')
    .sort((a, b) => new Date(b.atUtc).getTime() - new Date(a.atUtc).getTime())[0];
  return active ? `/conversations/calls?interaction=${active.id}` : '/conversations/calls';
}

export function OverviewClient(): React.JSX.Element {
  const { session, org } = useSession();
  const fixture = getFixture(session.orgId);

  const { data: liveJobs, isLoading: liveJobsLoading } = useLiveJobs();
  const jobStats = liveJobs?.stats ?? EMPTY_JOB_STATS;
  const chartJobs = useMemo(
    () =>
      liveJobs?.gated.kind === 'rows'
        ? liveJobs.gated.rows.map((row) => ({ createdAtUtc: row.createdAtUtc, intakeChannel: row.intakeChannel }))
        : [],
    [liveJobs],
  );

  const { data: liveCallsSnapshot } = useLiveCalls();
  const fixtureCalls = useMemo(() => listCalls(fixture, session), [fixture, session]);
  const liveCalls = liveCallsSnapshot?.gated ?? fixtureCalls;

  const { data: liveDispatch, isLoading: liveDispatchLoading } = useLiveDispatchQueue();
  const dispatchCounts = liveDispatch?.stats ?? EMPTY_DISPATCH_COUNTS;

  const { data: liveTelemetry, isLoading: liveTelemetryLoading } = useLiveTelemetry();
  const { data: liveRevenue } = useLiveRevenue();
  const { data: liveQuality } = useLiveQuality();

  // §5.1 Revenue Influenced. Hidden (null) when Average Job Value is unconfigured.
  const revenue: RevenueEstimate | null = liveRevenue?.estimate ?? null;

  const qualityScore = liveQuality?.score ?? null;
  const optEvents = liveQuality?.optimizationEvents ?? 0;
  // Sparkline needs a gap-free number[]; carry the last graded day across empty days.
  const trend30d = useMemo(() => forwardFillTrend(liveQuality?.trend30d ?? []), [liveQuality]);

  // §5.1 Needs Your Attention banner — the spec's five conditions, each a deep link.
  const attention = useMemo(() => attentionConditions(fixture, org, session), [fixture, org, session]);

  const tz = displayTimezone(session, org);
  const refreshedAtLabel = formatDateTime(new Date().toISOString(), tz);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Overview"
        description="Daily view of jobs, dispatch performance, customer conversations, agent quality, and operational attention items."
      />

      <AttentionBanner conditions={attention} />

      <LiveCallsPanel
        snapshot={liveCalls}
        session={session}
        title="Live calls now"
        refreshedAtLabel={refreshedAtLabel}
        cardHref={liveCallsHref(liveCalls)}
      />

      <JobsSection stats={jobStats} jobs={chartJobs} loading={liveJobsLoading && liveJobs === null} />

      <DispatchSection counts={dispatchCounts} loading={liveDispatchLoading && liveDispatch === null} />

      <RevenueSection estimate={revenue} />

      <QualitySection score={qualityScore} trend30d={trend30d} optimizationEvents={optEvents} />

      <TelemetrySection
        telemetry={liveTelemetry}
        refreshedAtLabel={refreshedAtLabel}
        session={session}
        liveCalls={liveCalls}
        loading={liveTelemetryLoading && liveTelemetry === null}
      />
    </div>
  );
}
