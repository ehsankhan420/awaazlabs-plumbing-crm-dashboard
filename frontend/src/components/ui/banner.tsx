'use client';

import React from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Dismissible banner. §4.6 red attention banner (deep-links per condition) and §5.6
 * "EHR sync unavailable" notice. Dismissal state is the caller's concern — this component
 * just calls `onDismiss`; it does not remember being dismissed.
 */
export function Banner({
  variant = 'default',
  title,
  children,
  onDismiss,
  className,
}: {
  variant?: 'destructive' | 'default';
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const isDestructive = variant === 'destructive';
  const Icon = isDestructive ? AlertTriangle : Info;

  return (
    <div
      role={isDestructive ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-md border px-4 py-3 text-sm',
        isDestructive
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border bg-muted text-foreground',
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title && 'mt-1')}>{children}</div>
      </div>
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-foreground/10"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
