'use client';

import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PermissionDeniedError,
  revealPhone,
  type CustomerIdentityView,
  type Session,
} from '@/mock/data-access';

/**
 * SECURITY-CRITICAL. §5.2 "Phone remains masked until authorized reveal."
 *
 * `identity.phoneE164` carries the raw value only when the data-access layer decided the
 * session may see it; reveal is a synchronous local toggle, audited by `revealPhone`.
 * A Viewer receives `phoneE164: null`, so there is nothing on the client to reveal and
 * the control is not rendered — the accessible name still announces that state (§4.13).
 */
export function MaskedValue({
  identity,
  session,
  objectRef,
  className,
}: {
  identity: CustomerIdentityView;
  session: Session;
  objectRef: string;
  className?: string;
}) {
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canReveal = identity.phoneE164 !== null;

  const handleReveal = () => {
    try {
      const raw = revealPhone(identity, session, objectRef);
      setRevealedValue(raw);
      setError(null);
    } catch (e) {
      // Never surface the underlying message (it names the role); keep it non-leaking.
      setError(e instanceof PermissionDeniedError ? 'Reveal not permitted.' : 'Unable to reveal.');
    }
  };

  if (revealedValue !== null) {
    return <span className={cn('tabular-nums', className)}>{revealedValue}</span>;
  }

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="tabular-nums">{identity.phoneMasked}</span>
      {canReveal ? (
        <button
          type="button"
          onClick={handleReveal}
          aria-label={`Reveal phone number for ${identity.firstName} ${identity.lastName}`}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
      {error ? (
        <span role="status" className="text-xs text-muted-foreground">
          {error}
        </span>
      ) : null}
    </span>
  );
}
