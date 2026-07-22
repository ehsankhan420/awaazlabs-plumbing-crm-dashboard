'use client';

/**
 * §13.1 REVIEW TAKER agent tab.
 *
 * Renders through the standard agent analytics template (§2.6) — the same schema every
 * agent uses — so it composes finished stat cards, one primary chart (the eight-stage
 * eligibility funnel), one distribution component (outcome split) and a drill-through to the
 * scoped Conversations > Calls view. The compliance note and the private-feedback list ride
 * in the template's `extra` slot.
 *
 * Aggregate by nature (review-request counts, no customer identity), so the funnel and stats
 * survive restricted mode; only the private-feedback list withholds customer-level rows there.
 */

import React from 'react';

import { AgentAnalyticsPage } from '@/components/agent-template/agent-analytics-page';
import { Banner } from '@/components/ui/banner';
import { EmptyState } from '@/components/ui/empty-state';
import { StatCard } from '@/components/ui/stat-card';
import { DistributionBar } from '@/components/charts/distribution-bar';
import { Funnel } from '@/components/charts/funnel';
import { formatCount, formatDuration, formatPercent } from '@/lib/format';
import { getFixture } from '@/mock/fixtures';
import { useSession } from '@/shared/session-context';
import { Star } from 'lucide-react';

import { PrivateFeedbackList } from '../../reviews/private-feedback-list';
import {
  hasReviewActivity,
  outcomeCounts,
  reviewFunnel,
  reviewStats,
} from './review-analytics';

function pct(rate: number | null): string {
  return rate === null ? '—' : formatPercent(rate);
}

/**
 * The compliance statement a reputation buyer looks for. Rendered as a prominent, visible
 * note — never a tooltip, never a comment. Verbatim from spec §13.1. It documents that the
 * architecture applies NO sentiment pre-filtering before the ask (review gating would
 * violate Google policy); negative experiences are routed to private feedback AFTER the ask.
 */
function ComplianceNote(): React.JSX.Element {
  return (
    <Banner title="Compliance note (rendered in the UI and enforced in the pipeline)">
      Every eligible customer receives the ask; no sentiment pre-filtering before the ask (review gating
      violates Google policy). Customers expressing a negative experience are routed to a private feedback
      capture after the ask, not instead of it.
    </Banner>
  );
}

export function ReviewTakerClient(): React.JSX.Element {
  const { session } = useSession();
  const fixture = getFixture(session.orgId);

  const funnel = reviewFunnel(fixture, session);
  const stats = reviewStats(fixture, session);
  const outcomes = outcomeCounts(fixture, session);
  const isEmpty = !hasReviewActivity(fixture, session);

  const statCards = (
    <>
      <StatCard label="Review calls placed" value={formatCount(stats.callsPlaced)} />
      <StatCard label="Customers reached" value={formatCount(stats.reached)} />
      <StatCard
        label="Reach rate"
        value={pct(stats.reachRate)}
        tooltip="Customers reached ÷ review calls placed."
      />
      <StatCard
        label="Asks delivered"
        value={formatCount(stats.asksDelivered)}
        tooltip="Review asks delivered to reached customers."
      />
      <StatCard
        label="Link-send rate"
        value={pct(stats.linkSendRate)}
        tooltip="Review links sent (SMS) ÷ review asks delivered."
      />
      <StatCard
        label="Link-click rate"
        value={pct(stats.linkClickRate)}
        tooltip="Links clicked ÷ links sent."
      />
      <StatCard
        label="Reviews posted (attributed)"
        value={formatCount(stats.posted)}
        tooltip="Attributed via a tracked review link, or a Google Business Profile rating delta within the attribution window."
      />
      <StatCard
        label="Average rating (attributed)"
        value={stats.avgRating === null ? '—' : stats.avgRating.toFixed(1)}
        tooltip="Mean star rating of reviews attributed to the agent."
      />
      <StatCard
        label="Opt-outs generated"
        value={formatCount(stats.optOuts)}
        tooltip="Each opt-out is written to the organization's suppression list automatically, so the customer is not contacted again."
      />
      <StatCard
        label="Average call duration"
        value={stats.avgCallDurationSeconds === null ? '—' : formatDuration(stats.avgCallDurationSeconds)}
      />
    </>
  );

  const primaryChart = (
    <Funnel
      title="Review eligibility pipeline"
      description="Seven stages from completed job to an attributed review. Single hue — order is carried by position, shrinking width and stage-to-stage conversion, not color."
      stages={funnel}
      formatCount={(v) => formatCount(v)}
      tableData={{
        columns: ['Stage', 'Count'],
        rows: funnel.map((s) => [s.label, formatCount(s.count)]),
      }}
    />
  );

  const distribution = (
    <DistributionBar
      title="Review request outcomes"
      description="Where every scoped review request finished. The relief table carries the exact counts."
      segments={[
        { key: 'posted', label: 'Posted (attributed)', value: outcomes.posted, color: 'var(--chart-1)' },
        { key: 'in_pipeline', label: 'In pipeline', value: outcomes.inPipeline, color: 'var(--chart-3)' },
        { key: 'declined', label: 'Declined', value: outcomes.declined, color: 'hsl(var(--muted-foreground))' },
        { key: 'opt_out', label: 'Opt-out', value: outcomes.optOut, color: 'var(--chart-6)' },
      ]}
      formatValue={(v) => formatCount(v)}
      tableData={{
        columns: ['Outcome', 'Count'],
        rows: [
          ['Posted (attributed)', formatCount(outcomes.posted)],
          ['In pipeline', formatCount(outcomes.inPipeline)],
          ['Declined', formatCount(outcomes.declined)],
          ['Opt-out', formatCount(outcomes.optOut)],
        ],
      }}
    />
  );

  const extra = (
    <div className="flex flex-col gap-6">
      <ComplianceNote />
      <PrivateFeedbackList session={session} />
    </div>
  );

  return (
    <AgentAnalyticsPage
      agentName="Review Taker"
      description="Performance of the outbound post-service review agent."
      specRef="§4.14"
      stats={statCards}
      primaryChart={primaryChart}
      distribution={distribution}
      extra={extra}
      drillThrough={{ href: '/conversations/calls?agent=review_taker', label: 'View review calls in Conversations' }}
      isEmpty={isEmpty}
      emptyState={
        <EmptyState
          icon={<Star className="h-8 w-8" />}
          title="No review activity yet"
          description="This business has no completed jobs or review requests in scope, so the eligibility funnel has nothing to show."
        />
      }
    />
  );
}
