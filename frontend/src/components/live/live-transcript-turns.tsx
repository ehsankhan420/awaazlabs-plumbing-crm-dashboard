'use client';

import React, { useEffect, useMemo, useRef } from 'react';

import { RedactedText } from '@/app/(dashboard)/conversations/_components/redacted-text';
import { formatDateTime } from '@/lib/format';

import type { LiveTranscriptTurn } from './live-transcript';
import { sealedTurnCount } from './transcript-turns';

function speakerLabel(speaker: LiveTranscriptTurn['speaker']): string {
  return speaker === 'agent' ? 'Agent' : 'Customer';
}

function SettledTurn({
  turn,
  timeZone,
  compact,
}: {
  turn: LiveTranscriptTurn;
  timeZone: string;
  compact: boolean;
}): React.JSX.Element {
  if (compact) {
    return (
      <li className="flex flex-col gap-0.5 text-sm leading-6 text-foreground">
        <span className="font-semibold text-muted-foreground">{speakerLabel(turn.speaker)}:</span>
        <RedactedText text={turn.text} redactions={turn.redactions} />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {speakerLabel(turn.speaker)}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(turn.at, timeZone)}</span>
      </div>
      <p className="text-sm text-foreground">
        <RedactedText text={turn.text} redactions={turn.redactions} />
      </p>
    </li>
  );
}

function SpeakingIndicator({
  turn,
  compact,
}: {
  turn: LiveTranscriptTurn;
  compact: boolean;
}): React.JSX.Element {
  const label = turn.speaker === 'agent' ? 'Agent speaking…' : 'Customer speaking…';
  return (
    <li
      className={
        compact
          ? 'text-xs text-muted-foreground'
          : 'rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground'
      }
    >
      {label}
    </li>
  );
}

/**
 * Full transcript list for the live-calls drawer: one line per speaker turn,
 * shown only after that turn is complete. No rounds, no typewriter animation.
 */
export function LiveTranscriptTurnList({
  turns,
  timeZone,
  compact = false,
  autoScroll = true,
  finalizePending = false,
}: {
  turns: readonly LiveTranscriptTurn[];
  timeZone: string;
  compact?: boolean;
  autoScroll?: boolean;
  /** When true, the last open turn is treated as finished (call ended). */
  finalizePending?: boolean;
}): React.JSX.Element {
  const endRef = useRef<HTMLLIElement | null>(null);
  const sealedCount = useMemo(() => sealedTurnCount(turns, finalizePending), [turns, finalizePending]);
  const settledTurns = turns.slice(0, sealedCount);
  const inProgressTurn = !finalizePending && sealedCount < turns.length ? turns[sealedCount] ?? null : null;

  useEffect(() => {
    if (!autoScroll) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [autoScroll, sealedCount, inProgressTurn?.text]);

  if (turns.length === 0) {
    return <p className="text-sm text-muted-foreground">Waiting for the first transcript turns.</p>;
  }

  return (
    <ol className={compact ? 'flex flex-col gap-2' : 'flex max-h-[min(52vh,28rem)] flex-col gap-3 overflow-y-auto pr-1'}>
      {settledTurns.map((turn, index) => (
        <SettledTurn key={`${turn.at}-${index}-${turn.speaker}`} turn={turn} timeZone={timeZone} compact={compact} />
      ))}
      {inProgressTurn ? <SpeakingIndicator turn={inProgressTurn} compact={compact} /> : null}
      <li ref={endRef} aria-hidden="true" className="h-0" />
    </ol>
  );
}
