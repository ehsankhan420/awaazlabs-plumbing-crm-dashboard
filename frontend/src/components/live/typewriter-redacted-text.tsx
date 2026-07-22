'use client';

import React from 'react';

import { RedactedText, type Redaction } from '@/app/(dashboard)/conversations/_components/redacted-text';
import { cn } from '@/lib/utils';

import { useTypewriterErase, useTypewriterText } from './use-typewriter-text';

export function TypewriterRedactedText({
  text,
  redactions,
  active = false,
  erasing = false,
  showCursor = false,
  className,
}: {
  text: string;
  redactions: readonly Redaction[];
  active?: boolean;
  erasing?: boolean;
  showCursor?: boolean;
  className?: string;
}): React.JSX.Element {
  const visible = useTypewriterText(text, active && !erasing);
  const erased = useTypewriterErase(text, erasing);
  const display = erasing ? erased : active ? visible : text;
  const typing = active && !erasing && display.length < text.length;
  const deleting = erasing && display.length > 0;

  return (
    <span className={cn('inline', className)}>
      <RedactedText text={display} redactions={redactions} />
      {typing || deleting || showCursor ? (
        <span
          className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px] animate-pulse bg-foreground/70"
          aria-hidden="true"
        />
      ) : null}
    </span>
  );
}
