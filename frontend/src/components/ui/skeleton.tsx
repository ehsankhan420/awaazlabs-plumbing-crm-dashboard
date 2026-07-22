import React from 'react';

import { cn } from '@/lib/utils';

/**
 * Loading placeholder.
 *
 * Used as the `<Suspense>` fallback for routes that read `useSearchParams()` — Next.js
 * defers those to the client, so the server sends no content for them. A `fallback={null}`
 * renders a blank page for that window, which reads as broken. This renders the shape of
 * what is coming instead.
 *
 * `aria-hidden` plus a live-region status message: a screen reader should hear
 * "Loading…", not have twenty empty grey boxes described to it.
 */
export function Skeleton({ className }: { className?: string }): React.JSX.Element {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

/** A page-level skeleton for the dense worklist and table routes. */
export function TablePageSkeleton({ rows = 8, label }: { rows?: number; label: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        {label}
      </span>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <Skeleton className="mb-4 h-9 w-full" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function StatCardSkeleton(): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-4 w-36" />
      </div>
    </div>
  );
}

export function StatGridSkeleton({ cards = 4 }: { cards?: number }): React.JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {Array.from({ length: cards }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DataTableSkeleton({ rows = 8 }: { rows?: number }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <Skeleton className="mb-4 h-9 w-full" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
