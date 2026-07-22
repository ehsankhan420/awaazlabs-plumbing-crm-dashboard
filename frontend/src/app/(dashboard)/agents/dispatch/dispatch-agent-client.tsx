'use client';

/**
 * §5.7 PLUMBER DISPATCH AGENT — the dedicated profile page for the outbound assignment
 * agent. It explains assignment performance, plumber outreach outcomes, and dispatch
 * quality without replacing the Dispatch Queue workspace.
 *
 * Every number comes from the `dispatch_agent_stats` aggregate (via
 * `useLiveDispatchAgent`): the four §5.7 KPI cards, the dispatch performance chart
 * (outbound calls and accepted assignments over time), the outreach outcome distribution,
 * and the quality summary.
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
import { LineChart } from '@/components/charts/line-chart';
import { formatCount, formatPercent } from '@/lib/format';
import { useLiveDispatchAgent } from '@/hooks/use-dashboard-live';
import { OUTREACH_OUTCOME_LABELS, type OutreachOutcome } from '@/shared/status-models';

const DRILL_THROUGH = {
  href: '/dispatch-queue',
  label: 'Open Dispatch Queue',
} as const;

/**
 * Outreach outcome → categorical color, one fixed binding in §3.3 order. Accepted is the
 * success outcome; Failed carries the reserved destructive token.
 */
const OUTREACH_SERIES: Readonly<Record<OutreachOutcome, string>> = {
  accepted: 'var(--chart-1)',
  declined: 'var(--chart-2)',
  no_answer: 'var(--chart-3)',
  voicemail: 'var(--chart-4)',
  unavailable: 'var(--chart-5)',
  failed: 'hsl(var(--destructive))',
  canceled_before_contact: 'hsl(var(--muted-foreground))',
};

function pct(rate: number | null): string {
  return rate === null ? '—' : formatPercent(rate);
}

function SectionHeading({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h2 className="text-lg font-semibold tracking-tight text-foreground">{children}</h2>;
}

function dayLabelFromIso(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'numeric', day: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function DispatchAgentClient(): React.JSX.Element {
  const { data: stats, error: loadError, isLoading } = useLiveDispatchAgent();

  const [trendDays, setTrendDays] = useState<'7' | '30'>('30');

  const trend = useMemo(() => {
    const days = Number(trendDays);
    const dayKeys = stats ? stats.trend.days.slice(-days) : [];
    const calls = stats ? stats.trend.calls.slice(-days) : [];
    const accepted = stats ? stats.trend.outcomes.slice(-days) : [];
    return { labels: dayKeys.map(dayLabelFromIso), calls, accepted };
  }, [stats, trendDays]);

  if (isLoading && stats === null && !loadError) {
    return <TablePageSkeleton label="Loading Plumber Dispatch Agent analytics..." rows={4} />;
  }

  if (loadError) {
    return (
      <Banner variant="destructive" title="Plumber Dispatch Agent metrics are temporarily unavailable">
        {loadError}
      </Banner>
    );
  }

  const outboundCalls = stats?.outboundCallsHandled ?? 0;
  const assignments = stats?.assignmentsSecured ?? 0;
  const outcomes = stats?.outreachOutcomeDistribution ?? [];
  const windowDays = stats?.windowDays ?? 30;

  const isEmpty = outboundCalls === 0 && assignments === 0;

  // §5.7 header KPI cards, in the spec's order.
  const statCards = (
    <>
      <StatCard
        label="Outbound calls handled"
        value={formatCount(outboundCalls)}
        tooltip={`Outbound plumber outreach calls in the trailing ${windowDays} days.`}
      />
      <StatCard
        label="Assignments secured"
        value={formatCount(assignments)}
        tooltip="Dispatches that ended Accepted or Manually Assigned in the window."
      />
      <StatCard
        label="Assignment rate"
        value={pct(stats?.assignmentRate ?? null)}
        tooltip="Assigned dispatches divided by dispatches that entered the queue in the window."
      />
      <StatCard
        label="Average QA grade"
        value={stats?.avgQaGrade === null || stats?.avgQaGrade === undefined ? '—' : String(stats.avgQaGrade)}
        tooltip="Mean overall QA grade across graded outbound dispatch calls."
      />
    </>
  );

  // §5.7 dispatch performance chart: outbound calls and accepted assignments over time.
  const primaryChart = (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionHeading>Dispatch performance</SectionHeading>
        <Tabs value={trendDays} onValueChange={(v) => setTrendDays(v === '7' ? '7' : '30')}>
          <TabsList label="Dispatch performance trend window">
            <TabsTrigger value="7">7D</TabsTrigger>
            <TabsTrigger value="30">30D</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <LineChart
        title={`Outbound calls and accepted assignments — last ${trendDays} days`}
        description="Plumber outreach calls placed by the agent, and the assignments accepted, per day."
        xLabels={trend.labels}
        series={[
          { key: 'calls', label: 'Outbound calls', color: 'var(--chart-1)', values: [...trend.calls] },
          { key: 'accepted', label: 'Assignments accepted', color: 'var(--chart-2)', values: [...trend.accepted] },
        ]}
        formatValue={(v) => formatCount(v)}
        tableData={{
          columns: ['Day', 'Outbound calls', 'Assignments accepted'],
          rows: trend.labels.map((l, i) => [l, formatCount(trend.calls[i] ?? 0), formatCount(trend.accepted[i] ?? 0)]),
        }}
      />
    </div>
  );

  // §5.7 outreach outcome distribution across all seven §3.3 outcomes present in scope.
  const outcomeDonut = (
    <DonutChart
      title="Outreach outcome distribution"
      description="How individual plumber outreach attempts resolved. A declined attempt does not fail the job."
      centerLabel="attempts"
      slices={outcomes.map((o) => ({
        key: o.key,
        label: OUTREACH_OUTCOME_LABELS[o.key],
        value: o.count,
        color: OUTREACH_SERIES[o.key],
      }))}
      tableData={{
        columns: ['Outcome', 'Attempts'],
        rows: outcomes.map((o) => [OUTREACH_OUTCOME_LABELS[o.key], String(o.count)]),
      }}
    />
  );

  const extra = (
    <div className="flex flex-col gap-6">
      {/* §5.7 agent summary card: role, channel, service areas covered, supported languages. */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <SectionHeading>Agent summary</SectionHeading>
        <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Role</dt>
            <dd className="mt-1 text-sm text-foreground">
              Outbound assignment — contacts qualified plumbers one at a time until a job is accepted.
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Channel</dt>
            <dd className="mt-1 text-sm text-foreground">Voice, outbound</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Service areas covered</dt>
            <dd className="mt-1 text-sm text-foreground">
              {formatCount(stats?.serviceAreasCovered ?? 0)} configured service areas
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Supported languages</dt>
            <dd className="mt-1 text-sm text-foreground">English, Spanish</dd>
          </div>
        </dl>
      </div>

      {/* §5.7 quality summary + linked records entry points. */}
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
          <Link
            href="/conversations/calls?agent=dispatch"
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
          >
            Open Conversations — plumber outreach calls
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
      agentName="Plumber Dispatch Agent"
      description="Monitor, review, and optimize the outbound voice agent that contacts plumbers and secures job acceptance."
      specRef="§5.7"
      stats={statCards}
      primaryChart={primaryChart}
      distribution={outcomeDonut}
      extra={extra}
      drillThrough={DRILL_THROUGH}
      isEmpty={isEmpty}
      emptyState={
        <EmptyState
          title="No dispatch-agent activity yet"
          description="Completed outbound plumber calls handled by this agent will appear here."
        />
      }
    />
  );
}
