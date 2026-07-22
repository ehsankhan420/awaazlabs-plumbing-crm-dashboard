import type { Metadata } from 'next';

import { RouteGuard } from '@/components/route-guard';

import { MembersClient } from './members-client';

export const metadata: Metadata = { title: 'Members' };

/**
 * Spec §16.3. Milestone 2.
 *
 * Role-gated. The nav hides this item, but hiding a link is not access control — a user
 * can type the URL. `RouteGuard` independently rejects, per §2.2.
 */
export default function Page() {
  return (
    <RouteGuard capability="members" surface="Members">
      <MembersClient />
    </RouteGuard>
  );
}
