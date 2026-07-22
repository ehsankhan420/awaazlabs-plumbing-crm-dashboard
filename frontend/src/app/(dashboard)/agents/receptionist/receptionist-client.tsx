'use client';

/**
 * §5.6 AI RECEPTIONIST — the dedicated profile page for the inbound plumbing intake agent.
 *
 * It explains the agent's role, performance, intake outcomes, and quality trends without
 * duplicating the full Conversations or Jobs workspaces. Every number comes from the
 * `receptionist_stats` aggregate (via `useLiveReceptionist`): the four §5.6 KPI cards, the
 * intake performance chart (handled calls and jobs created over time), the outcome
 * distribution, and the quality summary.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { AgentAnalyticsPage } from '@/components/agent-template/agent-analytics-page';
import { Banner } from '@/components/ui/banner';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { TablePageSkeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DonutChart } from '@/components/charts/donut-chart';
import { DistributionBar } from '@/components/charts/distribution-bar';
import { LineChart } from '@/components/charts/line-chart';
import { formatCount, formatPercent } from '@/lib/format';
import { useLiveReceptionist } from '@/hooks/use-dashboard-live';
import { CALL_DISPOSITION_LABELS, LANGUAGE_LABELS } from '@/shared/status-models';

import {
  LANGUAGE_SERIES,
  RECEPTIONIST_OUTCOMES,
  RECEPTIONIST_OUTCOME_SERIES,
  type ReceptionistOutcome,
} from './receptionist-analytics';

const DRILL_THROUGH = {
  href: '/conversations/calls?agent=receptionist',
  label: 'Open Conversations — AI Receptionist calls',
} as const;

function pct(rate: number | null): string {
  return rate === null ? '—' : formatPercent(rate);
}

function SectionHeading({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h2 className="text-lg font-semibold tracking-tight text-foreground">{children}</h2>;
}

/** "7/5" label from a YYYY-MM-DD bucket key (rendered date-only, no tz shift). */
function dayLabelFromIso(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'numeric', day: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function ReceptionistClient(): React.JSX.Element {
  const { data: stats, error: loadError, isLoading } = useLiveReceptionist();

  const [trendDays, setTrendDays] = useState<'7' | '30'>('30');

  // Slice the trailing `trendDays` out of the 30-day window; the adapter owns the buckets,
  // so labels and values stay aligned.
  const trend = useMemo(() => {
    const days = Number(trendDays);
    const dayKeys = stats ? stats.trend.days.slice(-days) : [];
    const calls = stats ? stats.trend.calls.slice(-days) : [];
    const jobs = stats ? stats.trend.outcomes.slice(-days) : [];
    return { labels: dayKeys.map(dayLabelFromIso), calls, jobs };
  }, [stats, trendDays]);

  if (isLoading && stats === null && !loadError) {
    return <TablePageSkeleton label="Loading AI Receptionist analytics..." rows={4} />;
  }

  if (loadError) {
    return (
      <Banner variant="destructive" title="AI Receptionist metrics are temporarily unavailable">
        {loadError}
      </Banner>
    );
  }

  const inboundCallsHandled = stats?.inboundCallsHandled ?? 0;
  const jobsCreated = stats?.jobsCreated ?? 0;
  const windowDays = stats?.windowDays ?? 30;
  const outcomes = stats?.outcomeDistribution ?? [];
  const language = stats?.languageDistribution ?? [];

  const isEmpty = inboundCallsHandled === 0 && jobsCreated === 0;

  // §5.6 header KPI cards, in the spec's order.
  const statCards = (
    <>
      <StatCard
        label="Inbound calls handled"
        value={formatCount(inboundCallsHandled)}
        tooltip={`Completed inbound calls handled by the AI Receptionist in the trailing ${windowDays} days.`}
      />
      <StatCard
        label="Jobs created"
        value={formatCount(jobsCreated)}
        tooltip="Inbound calls that ended with a job created."
      />
      <StatCard
        label="Job creation rate"
        value={pct(stats?.jobCreationRate ?? null)}
        tooltip="Jobs created divided by completed inbound service-intent conversations."
      />
      <StatCard
        label="Average QA grade"
        value={stats?.avgQaGrade === null || stats?.avgQaGrade === undefined ? '—' : String(stats.avgQaGrade)}
        tooltip="Mean overall QA grade across graded AI Receptionist calls in the window."
      />
    </>
  );

  // §5.6 intake performance chart: handled calls and jobs created over time.
  const primaryChart = (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading>Intake performance</SectionHeading>
        <Tabs value={trendDays} onValueChange={(v) => setTrendDays(v === '7' ? '7' : '30')}>
          <TabsList label="Intake performance trend window">
            <TabsTrigger value="7">7D</TabsTrigger>
            <TabsTrigger value="30">30D</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <LineChart
        title={`Handled calls and jobs created — last ${trendDays} days`}
        description="Completed inbound calls handled by the agent, and the jobs created from them, per day."
        xLabels={trend.labels}
        series={[
          { key: 'calls', label: 'Calls handled', color: 'var(--chart-1)', values: [...trend.calls] },
          { key: 'jobs', label: 'Jobs created', color: 'var(--chart-2)', values: [...trend.jobs] },
        ]}
        formatValue={(v) => formatCount(v)}
        tableData={{
          columns: ['Day', 'Calls handled', 'Jobs created'],
          rows: trend.labels.map((l, i) => [l, formatCount(trend.calls[i] ?? 0), formatCount(trend.jobs[i] ?? 0)]),
        }}
      />
    </div>
  );

  // §5.6 outcome distribution for the five spec outcomes.
  const outcomeCountFor = (key: ReceptionistOutcome): number =>
    outcomes.find((o) => o.key === key)?.count ?? 0;

  const outcomeDonut = (
    <DonutChart
      title="Outcome distribution"
      description="How completed AI Receptionist calls resolved."
      centerLabel="calls"
      slices={RECEPTIONIST_OUTCOMES.map((key) => ({
        key,
        label: CALL_DISPOSITION_LABELS[key],
        value: outcomeCountFor(key),
        color: RECEPTIONIST_OUTCOME_SERIES[key],
      })).filter((s) => s.value > 0)}
      tableData={{
        columns: ['Outcome', 'Calls'],
        rows: RECEPTIONIST_OUTCOMES.map((key) => [CALL_DISPOSITION_LABELS[key], String(outcomeCountFor(key))]),
      }}
    />
  );

  const extra = (
    <div className="flex flex-col gap-6">
      {/* §5.6 agent summary card: role, channel, operating hours, supported languages. */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <SectionHeading>Agent summary</SectionHeading>
        <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Role</dt>
            <dd className="mt-1 text-sm text-foreground">
              Inbound intake — captures the service need, address, urgency, and preferred window, then creates the job.
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Channel</dt>
            <dd className="mt-1 text-sm text-foreground">Voice, 24/7</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Operating hours</dt>
            <dd className="mt-1 text-sm text-foreground">
              Always on. After hours: emergency intake only; routine requests schedule next business day.
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Supported languages</dt>
            <dd className="mt-1 text-sm text-foreground">English, Spanish</dd>
          </div>
        </dl>
      </div>

      <DistributionBar
        title="Language mix"
        description="Language of jobs created in the window (English, Spanish, other)."
        segments={language.map((l) => ({
          key: l.key,
          label: LANGUAGE_LABELS[l.key],
          value: l.count,
          color: LANGUAGE_SERIES[l.key],
        }))}
        formatValue={(v) => formatCount(v)}
        tableData={{
          columns: ['Language', 'Jobs'],
          rows: language.map((l) => [LANGUAGE_LABELS[l.key], String(l.count)]),
        }}
      />

      {/* §5.6 quality summary + linked records entry points. */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <SectionHeading>Quality and linked records</SectionHeading>
        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Open quality flags</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{formatCount(stats?.openFlags ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Optimization events</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {formatCount(stats?.recentOptimizations ?? 0)}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link href="/jobs" className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline">
            Open Jobs
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </Link>
          <Link href="/quality" className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline">
            Open Quality and Optimization
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </Link>
          <Link href="/knowledge" className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline">
            Open Agent Knowledge
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <AgentAnalyticsPage
      agentName="AI Receptionist"
      description="Monitor, review, and optimize the inbound voice agent that captures new plumbing jobs."
      specRef="§5.6"
      stats={statCards}
      primaryChart={primaryChart}
      distribution={outcomeDonut}
      extra={extra}
      drillThrough={DRILL_THROUGH}
      isEmpty={isEmpty}
      emptyState={
        <EmptyState
          title="No receptionist activity yet"
          description="Completed inbound calls handled by this agent will appear here."
        />
      }
    />
  );
}
