'use client';

/**
 * STANDARD AGENT ANALYTICS PAGE TEMPLATE — spec §2.6.
 *
 * "Every agent, standard or custom, renders from the same schema: an agent registry entry
 *  (name, type, channel, icon), a metrics contract (list of KPI definitions it emits), and a
 *  standard analytics page template (stat cards, one primary chart, one distribution
 *  component, drill-through to interaction rows). Custom enterprise agents therefore get a
 *  dashboard page with zero frontend work. This is an explicit demo point for the enterprise
 *  conversation."
 *
 * That claim is only true if every agent tab actually composes this. §6 (Receptionist),
 * §7 (Dispatch Agent), §9 (Chat Agents), §13.1 (Review Taker), §14.1 (Reengagement) and the
 * registry-driven `/agents/[slug]` route all render through here.
 *
 * The template takes **nodes**, not data. Each tab owns its own derivations and passes
 * finished stat cards and charts. Trying to make one component understand five different
 * metrics contracts would produce a component that understands none of them.
 */

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';

export interface AgentDrillThrough {
  /** §6.3 / §9.3: "Every card and chart segment filters into Conversations…" */
  readonly href: string;
  readonly label: string;
}

export interface AgentAnalyticsPageProps {
  /** From the agent registry entry (§2.6). Never translated — it is data, not chrome. */
  readonly agentName: string;
  readonly description: string;
  /** The spec subsection this surface implements, e.g. "§6". Rendered for traceability. */
  readonly specRef: string;

  /** Stat cards. Compose them from `<StatCard />`; the template only lays them out. */
  readonly stats: React.ReactNode;
  /** §2.6 "one primary chart". */
  readonly primaryChart: React.ReactNode;
  /** §2.6 "one distribution component". */
  readonly distribution: React.ReactNode;
  /** §2.6 "drill-through to interaction rows". */
  readonly drillThrough: AgentDrillThrough;

  /**
   * Anything a specific agent needs beyond the standard four slots — e.g. the Review Taker's
   * compliance note and private-feedback list. Kept as an explicit escape hatch so a tab never
   * has to fork the template to add one section.
   */
  readonly extra?: React.ReactNode;

  /** Period selector, filters — anything belonging in the header's right slot. */
  readonly headerActions?: React.ReactNode;

  /** Rendered instead of the body when the agent has no interactions in scope. */
  readonly emptyState?: React.ReactNode;
  readonly isEmpty?: boolean;
}

export function AgentAnalyticsPage({
  agentName,
  description,
  specRef,
  stats,
  primaryChart,
  distribution,
  drillThrough,
  extra,
  headerActions,
  emptyState,
  isEmpty = false,
}: AgentAnalyticsPageProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={agentName} description={description} actions={headerActions} />

      {isEmpty && emptyState ? (
        emptyState
      ) : (
        <>
          {/* §2.6 slot 1 — stat cards */}
          <section aria-label={`${agentName} key metrics`} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats}
          </section>

          {/* §2.6 slots 2 and 3 — one primary chart, one distribution */}
          <section aria-label={`${agentName} trends`} className="grid gap-6 xl:grid-cols-2">
            {primaryChart}
            {distribution}
          </section>

          {extra}

          {/* §2.6 slot 4 — drill-through to interaction rows */}
          <DrillThroughLink drillThrough={drillThrough} agentName={agentName} />
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Rendered from the standard agent template ({specRef} · §2.6). Custom agents use the same schema.
      </p>
    </div>
  );
}

function DrillThroughLink({
  drillThrough,
  agentName,
}: {
  drillThrough: AgentDrillThrough;
  agentName: string;
}): React.JSX.Element {
  return (
    <Link
      href={drillThrough.href}
      aria-label={`${drillThrough.label}, scoped to ${agentName}`}
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium',
        'text-foreground transition-colors hover:bg-accent',
      )}
    >
      {drillThrough.label}
      <ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
