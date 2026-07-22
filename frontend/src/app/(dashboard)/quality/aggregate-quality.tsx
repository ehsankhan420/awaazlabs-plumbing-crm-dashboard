'use client';

/**
 * aggregate-quality.tsx — §12.2 aggregate quality + §12.3 grading dimensions (aggregate).
 *
 *  - Current quality score (§12.2) — `aggregateQualityScore`, the SAME function the Overview
 *    §4.4 pulse reads, so the two screens always show the same number.
 *  - 30-day AND 90-day trend line (§12.2) with optimization events plotted as markers, so the
 *    grade lift following each deployment is visible on the line.
 *  - Grade distribution histogram (§12.2).
 *  - Per-agent quality table (§12.2): agent, calls graded, average grade, trend arrow, open
 *    optimization items.
 *  - The aggregate five-dimension breakdown (§12.3), rendered through the shared component.
 */

import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Histogram } from '@/components/charts/histogram';
import { LineChart } from '@/components/charts/line-chart';
import { aggregateQualityScore, qualityTrend } from '@/lib/metrics';
import { formatCount } from '@/lib/format';
import type { CallInteraction, OptimizationEvent } from '@/mock/schema';
import { AGENT_LABELS } from '@/shared/status-models';

import { GradeBreakdown } from '@/components/quality/grade-breakdown';
import {
  aggregateBreakdown,
  gradeDistribution,
  optimizationMarkers,
  perAgentQuality,
  trendDayLabels,
  type QualityTrend,
} from './quality-metrics';

const TREND_WINDOWS = [30, 90] as const;
type TrendWindow = (typeof TREND_WINDOWS)[number];

function TrendArrow({ trend }: { trend: QualityTrend }): React.JSX.Element {
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-foreground">
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Improving</span>
        Up
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <ArrowDown className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Declining</span>
        Down
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">Steady</span>
      Steady
    </span>
  );
}

function TrendChart({
  window,
  calls,
  events,
  timeZone,
}: {
  window: TrendWindow;
  calls: readonly CallInteraction[];
  events: readonly OptimizationEvent[];
  timeZone: string;
}): React.JSX.Element {
  const raw = qualityTrend(calls, window);
  // `qualityTrend` seeds days before the first graded call with 0. A grade is never 0, so a 0
  // means "no data yet": show it as a gap rather than a misleading dive to the axis.
  const values = raw.map((v) => (v === 0 ? null : v));
  const labels = trendDayLabels(window, timeZone);
  const markers = optimizationMarkers(events, window);

  const tableRows = raw.flatMap((v, i) => (v === 0 ? [] : [[labels[i], v.toFixed(1)]]));

  return (
    <LineChart
      title={`Quality trend — last ${window} days`}
      description="Average call grade over time. Ringed points mark optimization deployments; grades typically rise after each one."
      xLabels={labels}
      series={[{ key: 'grade', label: 'Average grade', color: 'var(--chart-1)', values }]}
      markers={markers}
      formatValue={(v) => v.toFixed(0)}
      footnote={
        markers.length > 0
          ? 'Each ring is a deployed optimization; hover a ring for what changed.'
          : 'No optimization deployments fall inside this window.'
      }
      tableData={{
        columns: ['Day', 'Average grade'],
        rows: tableRows,
      }}
    />
  );
}

export function AggregateQuality({
  calls,
  events,
  timeZone,
}: {
  calls: readonly CallInteraction[];
  events: readonly OptimizationEvent[];
  timeZone: string;
}): React.JSX.Element {
  const [window, setWindow] = useState<string>(String(TREND_WINDOWS[0]));

  const score = aggregateQualityScore(calls);
  const distribution = useMemo(() => gradeDistribution(calls), [calls]);
  const agentRows = useMemo(() => perAgentQuality(calls, events), [calls, events]);
  const aggregateGrade = useMemo(
    () => (score === null ? null : aggregateBreakdown(calls, score)),
    [calls, score],
  );

  if (score === null || aggregateGrade === null) {
    return (
      <EmptyState
        title="No graded calls yet"
        description="Once interactions are analyzed and graded, the aggregate score, trend, and per-agent breakdown appear here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        {/* Current quality score + aggregate dimensions (§12.2 headline, §12.3 aggregate) */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Current quality score</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-semibold tabular-nums text-foreground">{score}</span>
                <span className="text-2xl font-medium text-muted-foreground">/100</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Weighted aggregate across the five grading dimensions, over all graded interactions in scope.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Grading dimensions (aggregate)</CardTitle>
            </CardHeader>
            <CardContent>
              <GradeBreakdown grade={aggregateGrade} />
            </CardContent>
          </Card>
        </div>

        {/* Trend with 30D / 90D toggle and event markers */}
        <div className="flex flex-col gap-3">
          <Tabs value={window} onValueChange={setWindow}>
            <TabsList label="Trend window">
              {TREND_WINDOWS.map((w) => (
                <TabsTrigger key={w} value={String(w)}>
                  {w}-day
                </TabsTrigger>
              ))}
            </TabsList>
            {TREND_WINDOWS.map((w) => (
              <TabsContent key={w} value={String(w)} className="mt-3">
                <TrendChart window={w} calls={calls} events={events} timeZone={timeZone} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>

      <Histogram
        title="Grade distribution"
        description="Share of graded calls in each grade band."
        bins={distribution}
        formatCount={formatCount}
        tableData={{
          columns: ['Grade band', 'Calls'],
          rows: distribution.map((b) => [b.label, formatCount(b.count)]),
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Per-agent quality</CardTitle>
        </CardHeader>
        <CardContent>
          <Table caption="Per-agent quality: calls graded, average grade, trend, and open optimization items">
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">Calls graded</TableHead>
                <TableHead className="text-right">Average grade</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead className="text-right">Open optimization items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentRows.map((row) => (
                <TableRow key={row.agent}>
                  <TableCell className="font-medium">{AGENT_LABELS[row.agent]}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(row.gradedCount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.avgGrade}</TableCell>
                  <TableCell>
                    <TrendArrow trend={row.trend} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.openOptimizationItems}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
