'use client';

/**
 * §5.4 KPI cards: Open Escalations · Overdue Escalations · Acknowledgement Rate ·
 * Median Time to Acknowledge, plus the trigger distribution (count and share for all
 * seven triggers).
 *
 * The four are `StatCard`s; the trigger breakdown is a `DistributionBar` (100% stacked),
 * which renders through `ChartFrame` and therefore carries a legend + a screen-reader
 * `tableData` built from the very same counts it plots.
 */

import React from 'react';

import { StatCard } from '@/components/ui/stat-card';
import { DistributionBar, type DistributionSegment } from '@/components/charts/distribution-bar';
import type { ChartTableData } from '@/components/charts/chart-frame';
import { formatCount, formatDuration, formatPercent } from '@/lib/format';
import { ESCALATION_TRIGGERS, ESCALATION_TRIGGER_LABELS } from '@/shared/status-models';

import type { EscalationStats } from './escalation-metrics';
import { TRIGGER_SERIES } from './types';

export function EscalationsStatStrip({ stats }: { stats: EscalationStats }): React.JSX.Element {
  const segments: DistributionSegment[] = ESCALATION_TRIGGERS.map((t) => ({
    key: t,
    label: ESCALATION_TRIGGER_LABELS[t],
    value: stats.triggerCounts[t],
    color: TRIGGER_SERIES[t],
  }));

  // Relief channel: the same numbers the bar plots, as a real table.
  const tableData: ChartTableData = {
    columns: ['Trigger', 'Escalations', 'Share'],
    rows: ESCALATION_TRIGGERS.map((t) => {
      const count = stats.triggerCounts[t];
      const share = stats.total > 0 ? formatPercent(count / stats.total) : '0%';
      return [ESCALATION_TRIGGER_LABELS[t], formatCount(count), share];
    }),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open escalations" value={formatCount(stats.open)} />
        <StatCard
          label="Overdue escalations"
          value={formatCount(stats.overdue)}
          accent={stats.overdue > 0 ? 'destructive' : 'default'}
          tooltip="Open escalations past their severity's acknowledgement threshold: 15 minutes for Critical, 30 minutes for Urgent, 4 hours for Attention."
        />
        <StatCard
          label="Acknowledgement rate"
          value={stats.ackRate === null ? '—' : formatPercent(stats.ackRate)}
          tooltip="Share of escalations that have been acknowledged out of all escalations in the current scope."
        />
        <StatCard
          label="Median time to acknowledge"
          value={stats.medianTimeToAckSeconds === null ? '—' : formatDuration(stats.medianTimeToAckSeconds)}
          tooltip="Median elapsed time between an escalation arriving and being acknowledged, across acknowledged escalations in the current scope."
        />
      </div>

      <DistributionBar
        title="Breakdown by trigger"
        description="Count and share of escalations by what required human ownership."
        compact
        segments={segments}
        tableData={tableData}
        formatValue={(v) => formatCount(v)}
        footnote={`${formatCount(stats.total)} escalation${stats.total === 1 ? '' : 's'} in the current scope.`}
      />
    </div>
  );
}
