'use client';

/**
 * ROUTE GUARD — §2.2 "The UI hides what the role cannot access; the API independently
 * rejects it."
 *
 * The nav already hides gated items (see `visibleNavGroups`). This closes the other half:
 * a route reached by typing its URL. Hiding a link is not access control.
 *
 * This mirrors, at the route level, what `data-access.ts` does at the data level. Neither
 * is sufficient alone; the spec asks for both.
 *
 * The capability is named by a string key rather than passed as a predicate function,
 * because a `page.tsx` is a React Server Component and functions are not serializable
 * across the server/client boundary. The lookup happens here, on the client.
 */

import React from 'react';
import { Lock } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { useTranslations } from '@/i18n/locale-context';
import { useSession } from '@/shared/session-context';
import {
  canEditConsentList,
  canExport,
  canSeeAuditLog,
  canSeeBilling,
  canSeeMembers,
  type Session,
} from '@/mock/data-access';

const CAPABILITIES = {
  auditLog: canSeeAuditLog,
  members: canSeeMembers,
  billing: canSeeBilling,
  consentList: canEditConsentList,
  export: canExport,
} as const satisfies Record<string, (session: Session) => boolean>;

export type Capability = keyof typeof CAPABILITIES;

export function RouteGuard({
  capability,
  surface,
  children,
}: {
  capability: Capability;
  /** Human name of the surface, used only in the denial message. */
  surface: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { session } = useSession();
  const t = useTranslations();

  if (CAPABILITIES[capability](session)) return <>{children}</>;

  return (
    <Card className="mx-auto max-w-xl">
      <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold">{`${surface} ${t('guard.notAvailable')}`}</h2>
        {/*
          State the rule, never the data. A denial message naming the record, the
          organization, or how many rows exist would leak precisely what the guard exists
          to protect.
        */}
        <p className="max-w-md text-sm text-muted-foreground">{t('guard.explanation')}</p>
      </div>
    </Card>
  );
}
