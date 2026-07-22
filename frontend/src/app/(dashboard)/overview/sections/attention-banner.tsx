'use client';

/**
 * §4.6 Section F — attention banner. Renders ABOVE Section A.
 *
 * Dismissible, `variant="destructive"`. Conditional on exactly the four triggers computed
 * by `attentionConditions` in metrics.ts (unacknowledged escalation aging, Dispatch aging past
 * 48h, line health failure, usage >= 90% of plan). Each condition deep-links to its owning
 * surface via the `href` the metric returns. When there are no conditions, nothing renders.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { Banner } from '@/components/ui/banner';
import type { AttentionCondition } from '@/lib/metrics';

export function AttentionBanner({ conditions }: { conditions: readonly AttentionCondition[] }): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);

  if (conditions.length === 0 || dismissed) return null;

  return (
    <Banner
      variant="destructive"
      title="Needs your attention"
      onDismiss={() => setDismissed(true)}
    >
      <ul className="flex flex-col gap-1">
        {conditions.map((c) => (
          <li key={c.key}>
            <Link href={c.href} className="underline underline-offset-2 hover:no-underline">
              {c.message}
            </Link>
          </li>
        ))}
      </ul>
    </Banner>
  );
}
