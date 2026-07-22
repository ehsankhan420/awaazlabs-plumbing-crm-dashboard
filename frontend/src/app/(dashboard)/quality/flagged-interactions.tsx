'use client';

/**
 * flagged-interactions.tsx — §12.5. Client-submitted flags land here as priority items with
 * status submitted / under review / resolved, plus a resolution note, each linked to its
 * source interaction. This closes the loop publicly: the business flags, the operations team reviews, the fix
 * appears in the optimization timeline.
 *
 * restricted-access (§ degraded states): the flag still renders, but the link to the customer
 * interaction is withheld — there is no customer-identifying surface to route to.
 */

import React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FlagStatusChip } from '@/components/ui/status-chip';
import { formatDate } from '@/lib/format';
import type { FlaggedInteraction } from '@/mock/schema';

export interface FlagView {
  readonly flag: FlaggedInteraction;
  /** Route to the source interaction, or null when it must be withheld (restricted-access). */
  readonly href: string | null;
}

const STATUS_RANK: Readonly<Record<FlaggedInteraction['status'], number>> = {
  submitted: 0,
  under_review: 1,
  resolved: 2,
};

export function FlaggedInteractions({
  flags,
  timeZone,
}: {
  flags: readonly FlagView[];
  timeZone: string;
}): React.JSX.Element {
  // Priority order: submitted first, then under review, then resolved; newest first within each.
  const ordered = [...flags].sort((a, b) => {
    const byStatus = STATUS_RANK[a.flag.status] - STATUS_RANK[b.flag.status];
    if (byStatus !== 0) return byStatus;
    return new Date(b.flag.submittedAtUtc).getTime() - new Date(a.flag.submittedAtUtc).getTime();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flagged interactions</CardTitle>
      </CardHeader>
      <CardContent>
        {ordered.length === 0 ? (
          <EmptyState
            title="No flagged interactions"
            description="When staff flag an interaction from Jobs, Conversations, or the Dispatch Queue, it arrives here for review."
          />
        ) : (
          <ol className="flex flex-col gap-4">
            {ordered.map(({ flag, href }) => (
              <li key={flag.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <FlagStatusChip status={flag.status} />
                  <span className="text-xs text-muted-foreground">
                    Submitted {formatDate(flag.submittedAtUtc, timeZone)} by {flag.submittedBy}
                  </span>
                </div>
                <p className="text-sm text-foreground">{flag.reason}</p>
                {flag.resolutionNote ? (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Resolution: </span>
                    {flag.resolutionNote}
                  </p>
                ) : null}
                {href ? (
                  <Link
                    href={href}
                    className="inline-flex w-fit items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    View source interaction
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Source interaction hidden in restricted mode.
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
