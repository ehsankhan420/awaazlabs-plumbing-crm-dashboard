'use client';

/**
 * §2.6 CUSTOM AGENT ROUTE — `/agents/[slug]`.
 *
 * The registry-driven page that makes the §2.6 claim true: "Every agent, standard or
 * custom, renders from the same schema... Custom enterprise agents therefore get a
 * dashboard page with zero frontend work."
 *
 * This component contains ZERO per-agent special-casing. It resolves whatever agent the
 * slug names, then drives every stat card from that agent's `metricsContract` and every
 * chart from the interactions attributed to it. Adding a new custom agent to the registry
 * gives it a full analytics page with no code change here.
 *
 * Aggregate-by-nature (reads only non-identifying interaction fields — disposition, priority,
 * duration, latency), so it renders identically in restricted mode: no customer name, phone,
 * recording, or transcript is ever read here.
 */

import React from 'react';
import { notFound } from 'next/navigation';

import { AgentAnalyticsPage } from '@/components/agent-template/agent-analytics-page';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { DistributionBar } from '@/components/charts/distribution-bar';
import { LineChart } from '@/components/charts/line-chart';
import { formatCount } from '@/lib/format';
import { scopeToLocation } from '@/lib/metrics';
import { getFixture } from '@/mock/fixtures';
import { AGENT_TYPES, type AgentRegistryEntry, type AgentType } from '@/mock/schema';
import { useSession } from '@/shared/session-context';

import { deriveKpis, interactionsOverTime, priorityDistribution } from './derive';

const TYPE_LABELS: Readonly<Record<AgentType, string>> = {
  inbound: 'Inbound',
  outbound: 'Outbound',
};

function agentDescription(agent: AgentRegistryEntry): string {
  const type = (AGENT_TYPES as readonly string[]).includes(agent.type) ? TYPE_LABELS[agent.type] : agent.type;
  return `${type} ${agent.channel} agent · this analytics page is generated entirely from the agent's registry metrics contract, with no bespoke frontend code (§2.6).`;
}

export function CustomAgentClient({ slug }: { slug: string }): React.JSX.Element {
  const { session } = useSession();
  const fixture = getFixture(session.orgId);

  // Resolve by slug via a lookup map (never a hardcoded comparison). A slug with no matching
  // registry entry — e.g. a custom agent that does not exist on this org — is a real 404.
  const agent = new Map(fixture.agents.map((a) => [a.slug, a])).get(slug);
  if (!agent) {
    notFound();
  }

  // §2.6 "interactions attributed to that agent". Attribution is generic: the interaction's
  // agent id equals the registry entry's id. Scoped to the active §2.4 location filter.
  const attributedCalls = scopeToLocation(
    fixture.calls.filter((c) => c.agent === agent.id),
    session,
  );
  const hasInteractions = attributedCalls.length > 0;

  const kpis = deriveKpis(agent.metricsContract, attributedCalls);
  const series = interactionsOverTime(attributedCalls);
  const priority = priorityDistribution(attributedCalls);

  const stats = kpis.map((kpi) => (
    <StatCard key={kpi.key} label={kpi.label} value={kpi.display} tooltip={kpi.tooltip || undefined} />
  ));

  const primaryChart = hasInteractions ? (
    <LineChart
      title="Interactions over time"
      description={`${agent.name} interactions per week, trailing ${series.labels.length} weeks.`}
      xLabels={series.labels}
      series={[
        { key: 'interactions', label: 'Interactions', color: 'var(--chart-1)', values: [...series.values] },
      ]}
      formatValue={(v) => formatCount(v)}
      tableData={{
        columns: ['Week', 'Interactions'],
        rows: series.labels.map((label, i) => [label, String(series.values[i])]),
      }}
    />
  ) : (
    <EmptyState
      title="No interactions to chart yet"
      description="This agent has recorded no interactions in the current scope. The whole page is generated from the registry entry — the trend will populate once the agent starts emitting."
    />
  );

  const distribution = hasInteractions ? (
    <DistributionBar
      title="Priority distribution"
      description="Share of this agent's interactions by job priority. The data table carries the exact counts."
      segments={priority.segments}
      formatValue={(v) => formatCount(v)}
      tableData={{
        columns: ['Priority', 'Count'],
        rows: priority.segments.map((s) => [s.label, String(s.value)]),
      }}
    />
  ) : (
    <EmptyState
      title="No distribution yet"
      description="A priority distribution will appear here once this agent records interactions."
    />
  );

  const extra = (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">
          {hasInteractions
            ? 'Every card above is derived generically from this agent’s metrics contract and its attributed interactions.'
            : 'Each card above is rendered from the agent’s metrics contract. Metrics that the fixture does not yet emit for this agent show “—”, never a fabricated number — they populate automatically once the agent reports them.'}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <AgentAnalyticsPage
      agentName={agent.name}
      description={agentDescription(agent)}
      specRef="§2.6"
      stats={stats}
      primaryChart={primaryChart}
      distribution={distribution}
      drillThrough={{
        href: `/conversations/calls?agent=${agent.slug}`,
        label: 'View interactions in Conversations',
      }}
      extra={extra}
    />
  );
}
