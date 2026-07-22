'use client';

/**
 * §14.1 REENGAGEMENT AGENT TAB.
 *
 * Renders through the standard §2.6 agent template (`AgentAnalyticsPage`): stat cards, one
 * primary chart (the six-stage funnel), one distribution component (the best-contact-window
 * heatmap), and a drill-through to the reengagement calls.
 *
 * Aggregate by nature — funnel counts and heatmap reach rates read non-identifying campaign and call
 * fields — so it survives restricted mode unchanged (no customer-level rows live here).
 *
 * CROSS-TAB WIRING: the revenue card reads the reengagement job count and `avgJobValueUsd`
 * from `revenueInfluencedEstimate` (the same function the Overview revenue card consumes),
 * so this tab cannot drift from Overview. It is NOT re-derived here.
 */

import React, { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';

import { AgentAnalyticsPage } from '@/components/agent-template/agent-analytics-page';
import { Funnel } from '@/components/charts/funnel';
import { Heatmap } from '@/components/charts/heatmap';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { formatCount, formatPercent, formatUsd, timezoneFor } from '@/lib/format';
import { revenueInfluencedEstimate } from '@/lib/metrics';
import { getFixture } from '@/mock/fixtures';
import { useSession } from '@/shared/session-context';

import {
  HEATMAP_DAY_LABELS,
  funnelTableData,
  reachRateHeatmap,
  reengagementContacts,
  reengagementFunnel,
  reengagementStats,
} from './reengagement-analytics';

function pct(rate: number | null): string {
  return rate === null ? '—' : formatPercent(rate);
}

export function ReengagementClient(): React.JSX.Element {
  const { session, org } = useSession();
  const fixture = getFixture(org.id);

  const contacts = useMemo(() => reengagementContacts(fixture, session), [fixture, session]);
  const funnel = useMemo(() => reengagementFunnel(contacts), [contacts]);
  const stats = useMemo(() => reengagementStats(contacts), [contacts]);

  const heatmap = useMemo(
    () => reachRateHeatmap(fixture, session, (locationId) => timezoneFor(org.id, locationId)),
    [fixture, session, org.id],
  );

  // Reads the SHARED estimate — the same function the Overview revenue card consumes, so
  // the two cannot drift. Null when the org has no configured Average Job Value, in which
  // case the card hides.
  const revenue = useMemo(() => revenueInfluencedEstimate(fixture, org, session), [fixture, org, session]);

  const isEmpty = contacts.length === 0 && heatmap.totalCalls === 0;

  const stats_node = (
    <>
      <StatCard label="Contacts attempted" value={formatCount(stats.contactsAttempted)} />
      <StatCard label="Reached" value={formatCount(stats.reached)} />
      <StatCard
        label="Reach rate"
        value={pct(stats.reachRate)}
        tooltip="Contacts reached divided by contacts attempted."
      />
      <StatCard label="Conversations completed" value={formatCount(stats.conversationsCompleted)} />
      <StatCard
        label="Jobs created"
        value={formatCount(stats.bookings)}
        subStats={[{ label: 'Conversion from reached', value: pct(stats.bookingConversionFromReached) }]}
      />
      {revenue !== null ? (
        <StatCard
          label="Revenue estimate"
          value={formatUsd(stats.bookings * revenue.avgJobValueUsd)}
          tooltip={`${formatCount(stats.bookings)} reengagement jobs × ${formatUsd(
            revenue.avgJobValueUsd,
          )} configured Average Job Value. An estimate, using the same configured value as the Overview card.`}
        />
      ) : null}
      <StatCard
        label="Opt-outs generated"
        value={formatCount(stats.optOuts)}
        tooltip="Opt-outs auto-write to the organization's suppression list; those numbers are checked before every dial."
      />
      <StatCard
        label="Avg attempts per booking"
        value={stats.avgAttemptsPerBooking === null ? '—' : stats.avgAttemptsPerBooking.toFixed(1)}
        tooltip="Mean number of call attempts across contacts that booked."
      />
    </>
  );

  const funnelNode = (
    <Funnel
      title="Reengagement funnel"
      description="Audience through to booked, across reengagement campaigns in scope. Single hue; order is carried by position and width."
      stages={funnel.stages}
      formatCount={formatCount}
      tableData={funnelTableData(funnel.stages)}
      footnote="Audience is the set of contacts entered into the reengagement pipeline."
    />
  );

  const heatmapNode = (
    <Heatmap
      title="Best contact window"
      description="Reach rate by hour-of-day and day-of-week, from reengagement calls. Times are in each location's timezone."
      xLabels={heatmap.hourLabels}
      yLabels={HEATMAP_DAY_LABELS}
      values={heatmap.values}
      formatValue={(v) => `${v}%`}
      tableData={{
        columns: ['Day', ...heatmap.hourLabels],
        rows: HEATMAP_DAY_LABELS.map((day, r) => [
          day,
          ...heatmap.hourLabels.map((_, c) => {
            const v = heatmap.values[r]?.[c] ?? null;
            return v === null ? '—' : `${v}%`;
          }),
        ]),
      }}
      footnote="A cell is blank when no reengagement calls were placed in that window."
    />
  );

  return (
    <AgentAnalyticsPage
      agentName="Reengagement"
      description="Outbound follow-up with past customers and unconverted leads: performance from audience to job created, plus the revenue those jobs influence."
      specRef="§4.14"
      stats={stats_node}
      primaryChart={funnelNode}
      distribution={heatmapNode}
      drillThrough={{
        href: '/conversations/calls?agent=reengagement',
        label: 'View reengagement calls',
      }}
      isEmpty={isEmpty}
      emptyState={
        <EmptyState
          icon={<RefreshCw className="h-8 w-8" />}
          title="No reengagement activity yet"
          description="This business has no reengagement campaigns or outbound reengagement calls in the selected scope."
        />
      }
    />
  );
}
