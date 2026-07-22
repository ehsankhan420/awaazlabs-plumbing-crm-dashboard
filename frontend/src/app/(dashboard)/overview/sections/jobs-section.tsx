'use client';

/**
 * §5.1 Jobs section. Four KPI cards + the jobs-created-over-time chart.
 *
 * Cards: Created Today (delta vs same weekday last week) · Created This Week (with job
 * creation rate) · Scheduled Next 7 Days (opens Jobs filtered to Scheduled) · Completed
 * and Canceled This Week (with completion rate). The chart is stacked by the five intake
 * channels with a 7D/30D toggle; its data and its honest `tableData` come from the same
 * buckets.
 */

import React, { useState } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { StatGridSkeleton } from '@/components/ui/skeleton';
import { BarChart } from '@/components/charts/bar-chart';
import { INTAKE_CHANNEL_SERIES } from '@/components/charts/series-map';
import { INTAKE_CHANNELS, INTAKE_CHANNEL_LABELS } from '@/shared/status-models';
import { formatCount, formatPercent } from '@/lib/format';
import type { JobStats } from '@/lib/metrics';
import type { OverviewJobPoint } from '../lib';
import { jobsByChannel, trailingDayLabels } from '../lib';
import { RangeTabs, type RangeDays } from '../range-tabs';

function pct(value: number | null): string {
  return value === null ? '—' : formatPercent(value);
}

export function JobsSection({
  stats,
  jobs,
  loading = false,
}: {
  stats: JobStats;
  jobs: readonly OverviewJobPoint[];
  loading?: boolean;
}): React.JSX.Element {
  const [days, setDays] = useState<RangeDays>(7);

  const todayDelta = stats.createdToday - stats.createdSameWeekdayLastWeek;

  const xLabels = trailingDayLabels(days);
  const byChannel = jobsByChannel(jobs, days);
  const series = INTAKE_CHANNELS.map((channel) => ({
    key: channel,
    label: INTAKE_CHANNEL_LABELS[channel],
    color: INTAKE_CHANNEL_SERIES[channel],
    values: byChannel.find((s) => s.channel === channel)?.values ?? [],
  }));

  const tableRows = xLabels.map((label, i) => {
    const perChannel = series.map((s) => s.values[i] ?? 0);
    const total = perChannel.reduce((a, b) => a + b, 0);
    return [label, ...perChannel.map((v) => formatCount(v)), formatCount(total)];
  });

  return (
    <section aria-labelledby="overview-jobs">
      <h2 id="overview-jobs" className="pb-3 text-lg font-semibold tracking-tight text-foreground">
        Jobs
      </h2>

      {loading ? (
        <StatGridSkeleton cards={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Created today"
            value={stats.createdToday}
            format="number"
            href="/jobs"
            delta={{
              value: todayDelta,
              direction: todayDelta >= 0 ? 'up' : 'down',
              caption: 'vs same weekday last week',
            }}
            deltaIsGood={todayDelta >= 0}
          />

          <StatCard
            label="Created this week"
            value={stats.createdThisWeek}
            format="number"
            href="/jobs"
            subStats={[{ label: 'Job creation rate', value: pct(stats.jobCreationRateThisWeek) }]}
            tooltip="Job creation rate: jobs created divided by completed inbound service-intent conversations this week."
          />

          <StatCard
            label="Scheduled next 7 days"
            value={stats.scheduledNext7Days}
            format="number"
            href="/jobs?status=scheduled"
            linkLabel="View jobs scheduled in the next 7 days"
          />

          <StatCard
            label="Completed & canceled this week"
            value={`${formatCount(stats.completedThisWeek)} / ${formatCount(stats.canceledThisWeek)}`}
            format="text"
            href="/jobs"
            subStats={[{ label: 'Completion rate', value: pct(stats.completionRateThisWeek) }]}
            tooltip="Completed and canceled jobs created this week. Completion rate excludes canceled jobs from the denominator."
          />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex justify-end">
          <RangeTabs value={days} onChange={setDays} label="Jobs time range" />
        </div>
        <BarChart
          title="Jobs created over time"
          description={`Trailing ${days} days, stacked by intake channel`}
          variant="stacked"
          xLabels={xLabels}
          series={series}
          formatValue={(v) => formatCount(v)}
          showStackTotals={days === 7}
          tableData={{
            columns: ['Day', ...series.map((s) => s.label), 'Total'],
            rows: tableRows,
          }}
        />
      </div>
    </section>
  );
}
