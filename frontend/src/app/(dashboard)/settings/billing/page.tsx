import type { Metadata } from 'next';

import { RouteGuard } from '@/components/route-guard';

import { BillingClient } from './billing-client';

export const metadata: Metadata = { title: 'Usage and Billing' };

/**
 * Spec §16.4. Milestone 2.
 *
 * Role-gated. The nav hides this item, but hiding a link is not access control — a user
 * can type the URL. `RouteGuard` independently rejects, per §2.2.
 */
export default function Page() {
  return (
    <RouteGuard capability="billing" surface="Usage and Billing">
      <BillingClient />
    </RouteGuard>
  );
}
