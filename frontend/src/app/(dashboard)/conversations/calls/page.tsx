import type { Metadata } from 'next';
import React, { Suspense } from 'react';

import { CallsClient } from './calls-client';
import { TablePageSkeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Conversations · Calls' };

/**
 * §10.1 Calls sub-view. Server wrapper: the body is a client component (gating state lives
 * in the session context, and the deep-link reads `useSearchParams`). `useSearchParams`
 * requires a Suspense boundary in the App Router, so it is provided here.
 */
export default function ConversationsCallsPage(): React.JSX.Element {
  return (
    <Suspense fallback={<TablePageSkeleton label="Loading calls…" />}>
      <CallsClient />
    </Suspense>
  );
}
