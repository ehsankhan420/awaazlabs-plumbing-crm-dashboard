import { Suspense } from 'react';
import type { Metadata } from 'next';

import { DispatchQueueClient } from './dispatch-queue-client';
import { TablePageSkeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Dispatch Queue' };

/** Spec §5.5. Suspense boundary is required for `useSearchParams` (deep-link). */
export default function DispatchQueuePage() {
  return (
    <Suspense fallback={<TablePageSkeleton label="Loading the dispatch queue…" />}>
      <DispatchQueueClient />
    </Suspense>
  );
}
