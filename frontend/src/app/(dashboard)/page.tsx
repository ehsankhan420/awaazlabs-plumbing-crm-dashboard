import type { Metadata } from 'next';
import { OverviewClient } from './overview-client';

/**
 * §4 Overview route. Server component per the repo pattern (see session-context.tsx): the
 * page stays a Server Component and delegates all switchable, session-dependent rendering to
 * its client child.
 */
export const metadata: Metadata = {
  title: 'Overview',
};

export default function OverviewPage() {
  return <OverviewClient />;
}
