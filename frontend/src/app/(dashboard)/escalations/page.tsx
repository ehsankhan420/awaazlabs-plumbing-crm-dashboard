import { Suspense } from 'react';
import type { Metadata } from 'next';

import { EscalationsClient } from './escalations-client';
import { TablePageSkeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Escalations' };

/** Spec §11. The route page is a server component that delegates to the client tab. */
export default function Page() {
  return (
    <Suspense fallback={<TablePageSkeleton label="Loading escalations..." />}>
      <EscalationsClient />
    </Suspense>
  );
}
