import type { Metadata } from 'next';

import { RouteGuard } from '@/components/route-guard';

import { ReportsClient } from './reports-client';

export const metadata: Metadata = { title: 'Reports and Exports' };

/**
 * Spec §16.1. Server component wrapper: mode/role/location are switchable client state held
 * by the session context, so the tab's body is a client component.
 *
 * Role-gated (Viewer cannot export, per §2.2). The nav hides this item, but hiding a link is
 * not access control — a user can type the URL. `RouteGuard` independently rejects, mirroring
 * `data-access.ts`'s `canExport`.
 */
export default function ReportsPage() {
  return (
    <RouteGuard capability="export" surface="Reports and Exports">
      <ReportsClient />
    </RouteGuard>
  );
}
