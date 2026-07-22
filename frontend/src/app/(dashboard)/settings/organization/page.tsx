import type { Metadata } from 'next';

import { OrganizationClient } from './organization-client';

export const metadata: Metadata = { title: 'Organization and Locations' };

/** Spec §16.5. Milestone 2. */
export default function Page() {
  return <OrganizationClient />;
}
