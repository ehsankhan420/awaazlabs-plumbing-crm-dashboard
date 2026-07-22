'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { Redaction } from '@/app/(dashboard)/conversations/_components/redacted-text';

import { readLinesRevealed, writeLinesRevealed } from './transcript-playback-session';
import { RoundBasedLiveTranscript } from './round-reveal';
import { buildTranscriptPlaybackState, roundSignature } from './transcript-rounds';

export type LiveTranscriptTurn = {
  readonly speaker: 'agent' | 'caller';
  readonly at: string;
  readonly text: string;
  readonly redactions: readonly Redaction[];
};

export function LiveTranscriptLines({
  turns,
  timeZone,
  compact = false,
  autoScroll = true,
  callId,
  finalizePending = false,
  playbackMode = 'live',
}: {
  turns: readonly LiveTranscriptTurn[];
  timeZone: string;
  compact?: boolean;
  autoScroll?: boolean;
  callId?: string;
  /** When true, seal trailing agent-only turns and the open customer exchange (call ended). */
  finalizePending?: boolean;
  /** `live` animates the queue; `settled` shows every sealed round immediately. */
  playbackMode?: 'live' | 'settled';
}): React.JSX.Element {
  const endRef = useRef<HTMLLIElement | null>(null);
  const playbackForInit = useMemo(
    () => buildTranscriptPlaybackState(turns, finalizePending),
    [turns, finalizePending],
  );

  const [revealedCount, setRevealedCount] = useState(() => {
    if (playbackMode === 'settled') return playbackForInit.sealedRounds.length;
    if (callId) return readLinesRevealed(callId) ?? 0;
    return 0;
  });
  const seenSignaturesRef = useRef<string[]>([]);
  const wasFinalizePendingRef = useRef(false);

  const { sealedRounds, pending } = useMemo(
    () => buildTranscriptPlaybackState(turns, finalizePending),
    [turns, finalizePending],
  );
  const sealedCount = sealedRounds.length;

  useEffect(() => {
    if (playbackMode === 'settled') return;
    if (!callId) {
      setRevealedCount(0);
      return;
    }
    setRevealedCount(readLinesRevealed(callId) ?? 0);
    seenSignaturesRef.current = [];
    wasFinalizePendingRef.current = false;
  }, [callId, playbackMode]);

  useEffect(() => {
    if (playbackMode === 'settled') {
      setRevealedCount(sealedCount);
    }
  }, [playbackMode, sealedCount]);

  useEffect(() => {
    if (callId) writeLinesRevealed(callId, revealedCount);
  }, [callId, revealedCount]);

  useEffect(() => {
    if (playbackMode === 'settled') return;
    if (finalizePending) {
      // During end-of-call drain only grow the queue — never roll back and re-animate.
      seenSignaturesRef.current = sealedRounds.map(roundSignature);
      return;
    }
    const signatures = sealedRounds.map(roundSignature);
    const prev = seenSignaturesRef.current;
    if (prev.length === 0 && signatures.length === 0) return;

    let sharedPrefix = 0;
    while (sharedPrefix < prev.length && sharedPrefix < signatures.length && prev[sharedPrefix] === signatures[sharedPrefix]) {
      sharedPrefix += 1;
    }

    if (sharedPrefix < prev.length) {
      setRevealedCount(sharedPrefix);
    }

    seenSignaturesRef.current = signatures;
  }, [sealedRounds, playbackMode, finalizePending]);

  const animatingRound =
    playbackMode === 'live' && revealedCount < sealedCount ? sealedRounds[revealedCount] ?? null : null;

  useEffect(() => {
    if (!autoScroll) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [autoScroll, revealedCount, animatingRound, pending.agent?.text, pending.caller?.text]);

  if (turns.length === 0) {
    return <p className="text-sm text-muted-foreground">Waiting for the first transcript turns.</p>;
  }

  return (
    <RoundBasedLiveTranscript
      rounds={sealedRounds}
      pending={pending}
      revealedCount={revealedCount}
      animatingRound={animatingRound}
      sealedCount={sealedCount}
      timeZone={timeZone}
      compact={compact}
      onRoundFinished={() => setRevealedCount((count) => Math.min(count + 1, sealedCount))}
      endRef={endRef}
    />
  );
}
