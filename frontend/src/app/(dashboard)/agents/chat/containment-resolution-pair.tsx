'use client';

/**
 * §9.1 THE PAIRED READING RULE, RENDERED IN THE UI.
 *
 * "High containment with low resolution is false containment; the two cards sit adjacent
 * with a shared caption." This is non-negotiable, so containment and resolution are never
 * two unrelated cells in the 4-column stat grid: they render as an adjacent pair inside a
 * single `<figure>` that spans two grid columns and carries one shared `<figcaption>`
 * explaining the rule.
 */

import React from 'react';

import { StatCard } from '@/components/ui/stat-card';

export function ContainmentResolutionPair({
  containment,
  resolution,
}: {
  containment: string;
  resolution: string;
}): React.JSX.Element {
  return (
    <figure className="flex flex-col gap-2 sm:col-span-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Containment rate"
          value={containment}
          tooltip="Share of sessions fully handled by the agent without a human handoff."
        />
        <StatCard
          label="Resolution rate"
          value={resolution}
          tooltip="Share of sessions where the customer's goal was actually met (job created or resolved)."
        />
      </div>
      <figcaption className="px-1 text-xs text-muted-foreground">
        Read these two together. High containment with low resolution is{' '}
        <span className="font-medium text-foreground">false containment</span> — the agent held the
        conversation but did not meet the customer&apos;s goal.
      </figcaption>
    </figure>
  );
}
