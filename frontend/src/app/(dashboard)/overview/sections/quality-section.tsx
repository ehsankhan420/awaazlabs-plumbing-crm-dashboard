'use client';

/**
 * §4.4 Section D — Quality pulse. One row that puts the Quality moat on the first screen.
 *
 * The aggregate grade is `aggregateQualityScore` and the sparkline is `qualityTrend(…, 30)`
 * — the SAME functions the Quality tab (§12.2) reads, so the numbers cannot drift. The
 * sparkline is passed into StatCard's `chart` slot; optimization events this month sit as a
 * sub-stat. The whole card click-throughs to Quality and Optimization.
 */

import React from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Sparkline } from '@/components/charts/sparkline';
import { formatCount } from '@/lib/format';

export function QualitySection({
  score,
  trend30d,
  optimizationEvents,
}: {
  score: number | null;
  trend30d: readonly number[];
  optimizationEvents: number;
}): React.JSX.Element {
  return (
    <section aria-labelledby="overview-quality">
      <h2 id="overview-quality" className="pb-3 text-lg font-semibold tracking-tight text-foreground">
        Quality pulse
      </h2>

      <div className="grid grid-cols-1 sm:max-w-md">
        <StatCard
          label="Aggregate call quality grade"
          value={score === null ? '—' : `${score}/100`}
          format="text"
          href="/quality"
          linkLabel="Open Quality and Optimization"
          subStats={[{ label: 'Optimization events this month', value: formatCount(optimizationEvents) }]}
          chart={
            <Sparkline
              values={[...trend30d]}
              ariaLabel={`30-day quality trend, ending at ${score === null ? 'no graded calls' : `${score} out of 100`}`}
            />
          }
        />
      </div>
    </section>
  );
}
