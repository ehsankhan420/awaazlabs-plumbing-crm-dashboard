'use client';

/**
 * §5.1 Revenue Influenced section. A single card.
 *
 * "Estimated Revenue Influenced This Month" = completed AI-created jobs × configured
 * Average Job Value. The estimate returns null when the org has no configured Average
 * Job Value, in which case the whole section hides — never a misleading $0. The value is
 * labeled an estimate; the tooltip states the calculation, and the contributing completed
 * jobs and configured Average Job Value render as sub-statistics.
 */

import React from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { formatCount, formatUsd } from '@/lib/format';
import type { RevenueEstimate } from '@/lib/metrics';

export function RevenueSection({ estimate }: { estimate: RevenueEstimate | null }): React.JSX.Element | null {
  if (estimate === null) return null;

  const tooltip = `Estimate = completed AI-created jobs this month × configured Average Job Value. Inputs: ${formatCount(estimate.contributingCompletedJobs)} completed AI-created jobs × ${formatUsd(estimate.avgJobValueUsd)}.`;

  return (
    <section aria-labelledby="overview-revenue">
      <h2 id="overview-revenue" className="pb-3 text-lg font-semibold tracking-tight text-foreground">
        Revenue influenced (estimate)
      </h2>

      <div className="grid grid-cols-1 sm:max-w-md">
        <StatCard
          label="Estimated revenue influenced this month"
          value={formatUsd(estimate.totalUsd)}
          format="text"
          tooltip={tooltip}
          href="/settings/organization"
          linkLabel="Configure Average Job Value in Organization settings"
          subStats={[
            { label: 'Contributing completed jobs', value: formatCount(estimate.contributingCompletedJobs) },
            { label: 'Average Job Value', value: formatUsd(estimate.avgJobValueUsd) },
          ]}
        />
      </div>
    </section>
  );
}
