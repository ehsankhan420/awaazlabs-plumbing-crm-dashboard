'use client';

/**
 * optimization-timeline.tsx — §12.4 optimization events, reverse-chronological.
 *
 * Each entry: date · agent affected · what was detected · what was changed · status · the
 * grade delta measured after deployment (signed, shown prominently once verified).
 *
 * §12.4 hard boundary: internal tuning mechanics — prompts, model configuration, reviewer
 * identity — are NEVER exposed. Only the controlled client-safe `whatWasDetected` /
 * `whatWasChanged` strings from the fixture are rendered; this component adds no such detail.
 */

import React from 'react';
import { TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { OptimizationStatusChip } from '@/components/ui/status-chip';
import { formatDate } from '@/lib/format';
import { AGENT_LABELS, type OptimizationEventStatus } from '@/shared/status-models';
import type { OptimizationEvent } from '@/mock/schema';

import { filterEventsByStatus, sortEventsNewestFirst } from './quality-metrics';

function GradeDelta({ delta }: { delta: number }): React.JSX.Element {
  const signed = `${delta > 0 ? '+' : ''}${delta}`;
  return (
    <div className="flex shrink-0 flex-col items-end">
      <span className="inline-flex items-center gap-1 text-2xl font-semibold tabular-nums text-foreground">
        <TrendingUp className="h-5 w-5" aria-hidden="true" />
        {signed}
      </span>
      <span className="text-xs text-muted-foreground">grade delta after deploy</span>
    </div>
  );
}

export function OptimizationTimeline({
  events,
  statusFilter,
  filterLabel,
  onClearFilter,
  timeZone,
}: {
  events: readonly OptimizationEvent[];
  statusFilter: readonly OptimizationEventStatus[] | null;
  filterLabel: string | null;
  onClearFilter: () => void;
  timeZone: string;
}): React.JSX.Element {
  const filtered = sortEventsNewestFirst(filterEventsByStatus(events, statusFilter));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Optimization events</CardTitle>
        {filterLabel ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Filtered to <span className="font-medium text-foreground">{filterLabel}</span>
            </span>
            <button
              type="button"
              onClick={onClearFilter}
              className="rounded-md border border-border px-2 py-0.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              Show all
            </button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <EmptyState
            title="No optimization events yet"
            description="When the system detects an improvement opportunity, the detection, tuning, deployment, and verification steps appear here as a running feed."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No events in this stage"
            description="No optimization events match the selected loop stage. Choose another stage or show all."
          />
        ) : (
          <ol className="flex flex-col gap-4">
            {filtered.map((event) => (
              <li
                key={event.id}
                className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <OptimizationStatusChip status={event.status} />
                    <span className="text-sm font-medium text-foreground">{AGENT_LABELS[event.agent]}</span>
                    <span className="text-xs text-muted-foreground">
                      Detected {formatDate(event.detectedAtUtc, timeZone)}
                      {event.deployedAtUtc ? ` · Deployed ${formatDate(event.deployedAtUtc, timeZone)}` : ''}
                      {event.verifiedAtUtc ? ` · Verified ${formatDate(event.verifiedAtUtc, timeZone)}` : ''}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-sm">
                    <p className="text-foreground">
                      <span className="font-medium text-muted-foreground">Detected: </span>
                      {event.whatWasDetected}
                    </p>
                    <p className="text-foreground">
                      <span className="font-medium text-muted-foreground">Changed: </span>
                      {event.whatWasChanged}
                    </p>
                  </div>
                </div>
                {event.gradeDelta !== null ? <GradeDelta delta={event.gradeDelta} /> : null}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
