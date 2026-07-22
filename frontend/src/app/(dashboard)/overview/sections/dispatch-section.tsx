'use client';

/**
 * §5.1 Dispatch section. Four KPI cards + the compact assignment-status distribution.
 *
 * Cards: In Dispatch (Unassigned + Matching + Contacting + Awaiting Response) · Assigned
 * Today (Accepted + Manually Assigned) · Assignment Rate · Needs Attention (destructive
 * accent). The distribution shows Unassigned, Matching, Contacting, Awaiting Response,
 * Accepted, and Exhausted.
 */

import React from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { StatGridSkeleton } from '@/components/ui/skeleton';
import { DistributionBar } from '@/components/charts/distribution-bar';
import { ASSIGNMENT_STATUS_SERIES, DISPATCH_DISTRIBUTION_STATUSES } from '@/components/charts/series-map';
import { ASSIGNMENT_STATUS_LABELS } from '@/shared/status-models';
import { formatCount, formatPercent } from '@/lib/format';
import type { DispatchCounts } from '@/lib/metrics';

export function DispatchSection({
  counts,
  loading = false,
}: {
  counts: DispatchCounts;
  loading?: boolean;
}): React.JSX.Element {
  const segments = DISPATCH_DISTRIBUTION_STATUSES.map((status) => ({
    key: status,
    label: ASSIGNMENT_STATUS_LABELS[status],
    value: counts.byStatus[status],
    color: ASSIGNMENT_STATUS_SERIES[status],
  }));

  const assignmentRate = counts.assignmentRate === null ? '—' : formatPercent(counts.assignmentRate);

  return (
    <section aria-labelledby="overview-dispatch">
      <h2 id="overview-dispatch" className="pb-3 text-lg font-semibold tracking-tight text-foreground">
        Dispatch
      </h2>

      {loading ? (
        <StatGridSkeleton cards={4} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="In dispatch"
            value={counts.inDispatch}
            format="number"
            href="/dispatch-queue"
            subStats={[
              { label: ASSIGNMENT_STATUS_LABELS.unassigned, value: formatCount(counts.byStatus.unassigned) },
              { label: ASSIGNMENT_STATUS_LABELS.matching, value: formatCount(counts.byStatus.matching) },
              { label: ASSIGNMENT_STATUS_LABELS.contacting, value: formatCount(counts.byStatus.contacting) },
              { label: ASSIGNMENT_STATUS_LABELS.awaiting_response, value: formatCount(counts.byStatus.awaiting_response) },
            ]}
          />

          <StatCard
            label="Assigned today"
            value={counts.assignedToday}
            format="number"
            href="/dispatch-queue"
            tooltip="Accepted and Manually Assigned dispatches with an acceptance today."
          />

          <StatCard
            label="Assignment rate"
            value={assignmentRate}
            format="text"
            href="/dispatch-queue"
            tooltip="Assigned jobs divided by jobs that entered dispatch, trailing 30 days."
          />

          <StatCard
            label="Needs attention"
            value={counts.needsAttention}
            format="number"
            accent="destructive"
            href="/dispatch-queue?filter=needs-attention"
            linkLabel="View dispatch records needing attention"
            tooltip="Exhausted dispatches plus urgent or emergency jobs beyond their assignment threshold."
          />
        </div>
      )}

      <div className="mt-4">
        <DistributionBar
          title="Dispatch status distribution"
          description="Dispatch records in scope, by assignment status"
          compact
          segments={segments}
          formatValue={(v) => formatCount(v)}
          tableData={{
            columns: ['Status', 'Count'],
            rows: segments.map((s) => [s.label, formatCount(s.value)]),
          }}
        />
      </div>
    </section>
  );
}
