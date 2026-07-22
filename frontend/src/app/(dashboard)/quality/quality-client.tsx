'use client';

/**
 * quality-client.tsx — §12 Quality and Optimization (the Quality loop). The centerpiece.
 *
 * Composition, top to bottom, matches §12.1 → §12.6:
 *   §12.1 loop header (four click-through stages)
 *   §12.2 aggregate quality (score, 30/90-day trend with event markers, distribution, per-agent)
 *   §12.3 grading dimensions (aggregate breakdown, inside §12.2 block via the shared component)
 *   §12.4 optimization events timeline
 *   §12.5 flagged interactions
 *   §12.6 compliance sub-panel (three rates)
 *
 * All cross-tab numbers come from `@/lib/metrics`; nothing here re-derives the aggregate
 * score, trend, or loop counts.
 */

import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';

import { PageHeader } from '@/components/ui/page-header';
import { useSession } from '@/shared/session-context';
import { getFixture } from '@/mock/fixtures';
import { type Session } from '@/mock/data-access';
import { getFlagsServerSnapshot, getRuntimeFlags, subscribeToFlags } from '@/shared/flag-store';
import { loopCounts, scopeToLocation } from '@/lib/metrics';
import {
  OPTIMIZATION_APPLIED_STATUSES,
  OPTIMIZATION_FLAGGED_STATUSES,
  type OptimizationEventStatus,
} from '@/shared/status-models';
import type { MockOrganization, OrgFixture } from '@/mock/schema';

import { LoopHeader, type LoopStageKey } from './loop-header';
import { AggregateQuality } from './aggregate-quality';
import { OptimizationTimeline } from './optimization-timeline';
import { FlaggedInteractions, type FlagView } from './flagged-interactions';
import { CompliancePanel } from './compliance-panel';
import { complianceRates } from './quality-metrics';

const AGGREGATE_ANCHOR = 'quality-aggregate';
const TIMELINE_ANCHOR = 'quality-timeline';

const STAGE_FILTER: Readonly<
  Record<LoopStageKey, { statuses: readonly OptimizationEventStatus[] | null; label: string | null }>
> = {
  callsCompleted: { statuses: null, label: null },
  analyzedAndGraded: { statuses: null, label: null },
  flaggedForOptimization: { statuses: OPTIMIZATION_FLAGGED_STATUSES, label: 'Flagged for optimization' },
  optimizationsApplied: { statuses: OPTIMIZATION_APPLIED_STATUSES, label: 'Optimizations applied' },
};

function resolveTimeZone(org: MockOrganization, session: Session): string {
  if (session.locationId) {
    const loc = org.locations.find((l) => l.id === session.locationId);
    if (loc) return loc.timezone;
  }
  return org.locations[0]?.timezone ?? 'UTC';
}

/** Map every interaction id to its location and the route that reaches it (§12.5 links). */
function buildInteractionIndex(
  fixture: OrgFixture,
): ReadonlyMap<string, { locationId: string; href: string }> {
  const index = new Map<string, { locationId: string; href: string }>();
  for (const call of fixture.calls) {
    index.set(call.id, {
      locationId: call.locationId,
      href: `/conversations/calls?interaction=${call.id}`,
    });
  }
  for (const chat of fixture.chats) {
    index.set(chat.id, {
      locationId: chat.locationId,
      href: `/conversations/chats?interaction=${chat.id}`,
    });
  }
  return index;
}

export function QualityClient(): React.JSX.Element {
  const { session, org } = useSession();
  const fixture = getFixture(session.orgId);

  const [selectedStage, setSelectedStage] = useState<LoopStageKey | null>(null);

  const timeZone = resolveTimeZone(org, session);
  const scopedCalls = useMemo(() => scopeToLocation(fixture.calls, session), [fixture.calls, session]);
  const counts = useMemo(() => loopCounts(fixture, session), [fixture, session]);
  const rates = useMemo(
    () => complianceRates(fixture, org, session, scopedCalls),
    [fixture, org, session, scopedCalls],
  );

  /**
   * §12.5: "All client-submitted flags (from the Flag this interaction button across
   * Jobs, Conversations, Dispatch Queue) land here."
   *
   * Guide Part A Rule 7 forbids faking this tab with its own static fixture. So the inbox
   * reads seeded history (`fixture.flags`) merged with every flag raised during this
   * session (`flag-store`), and a flag raised on another tab appears here immediately.
   */
  const runtimeFlags = useSyncExternalStore(
    subscribeToFlags,
    () => getRuntimeFlags(session.orgId),
    getFlagsServerSnapshot,
  );

  const flagViews = useMemo<readonly FlagView[]>(() => {
    const index = buildInteractionIndex(fixture);
    const canLink = true;
    // Session-submitted flags first — they are newest, and they are what the user just did.
    return [...runtimeFlags, ...fixture.flags].flatMap((flag) => {
      const source = index.get(flag.interactionId);
      // Scope to the location filter via the source interaction; keep flags whose source is
      // unknown so nothing silently disappears.
      if (source && session.locationId !== null && source.locationId !== session.locationId) {
        return [];
      }
      const href = canLink && source ? source.href : null;
      return [{ flag, href }];
    });
  }, [fixture, session, runtimeFlags]);

  const stageFilter = selectedStage ? STAGE_FILTER[selectedStage] : null;
  const timelineStatuses = stageFilter?.statuses ?? null;
  const timelineFilterLabel = stageFilter?.label ?? null;

  const handleStageClick = useCallback((stage: LoopStageKey) => {
    const filter = STAGE_FILTER[stage];
    if (filter.statuses === null) {
      // Stages that describe the call population point back at the analytics block.
      setSelectedStage(null);
      document.getElementById(AGGREGATE_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setSelectedStage(stage);
      document.getElementById(TIMELINE_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const clearFilter = useCallback(() => setSelectedStage(null), []);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Quality and Optimization"
        description="Every completed interaction is analyzed and graded; grades drive optimization; optimizations are applied and verified. This is the self-improving loop, under continuous supervision."
      />

      <LoopHeader counts={counts} onStageClick={handleStageClick} />

      <section id={AGGREGATE_ANCHOR} aria-label="Aggregate quality" className="scroll-mt-6">
        <AggregateQuality calls={scopedCalls} events={fixture.optimizationEvents} timeZone={timeZone} />
      </section>

      <section id={TIMELINE_ANCHOR} aria-label="Optimization events" className="scroll-mt-6">
        <OptimizationTimeline
          events={fixture.optimizationEvents}
          statusFilter={timelineStatuses}
          filterLabel={timelineFilterLabel}
          onClearFilter={clearFilter}
          timeZone={timeZone}
        />
      </section>

      <FlaggedInteractions flags={flagViews} timeZone={timeZone} />

      <CompliancePanel rates={rates} />
    </div>
  );
}
