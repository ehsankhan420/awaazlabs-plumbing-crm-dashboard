import type { Metadata } from 'next';

import { RouteGuard } from '@/components/route-guard';
import { AuditLogClient } from './audit-log-client';

export const metadata: Metadata = { title: 'Audit Log' };

/**
 * Spec §16.2 (COMPLIANCE, restricted mode only, Owner only).
 *
 * Role-gated. The nav hides this item, but hiding a link is not access control — a user can
 * type the URL. `RouteGuard` independently rejects, per §2.2, mirroring `data-access.ts`'s
 * `canSeeAuditLog` (standard mode AND Owner).
 */
export default function AuditLogPage() {
  return (
    <RouteGuard capability="auditLog" surface="Audit Log">
      <AuditLogClient />
    </RouteGuard>
  );
}
