import type { Metadata } from 'next';

import { ReengagementClient } from './reengagement-client';

export const metadata: Metadata = { title: 'Reengagement' };

/** Spec §14.1 — renders through the standard §2.6 agent analytics template. */
export default function Page() {
  return <ReengagementClient />;
}
