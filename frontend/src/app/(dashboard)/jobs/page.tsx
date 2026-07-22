import { Suspense } from 'react';
import type { Metadata } from 'next';

import { JobsClient } from './jobs-client';
import { TablePageSkeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Jobs' };

/**
 * Spec §5.2. Server component wrapper: role/location are switchable client state held by
 * the session context, so the tab's body is a client component (see session-context.tsx).
 */
export default function JobsPage() {
  return (
    <Suspense fallback={<TablePageSkeleton label="Loading jobs..." />}>
      <JobsClient />
    </Suspense>
  );
}
