'use client';

import React, { useEffect, useState } from 'react';

import { RedactedText } from '@/app/(dashboard)/conversations/_components/redacted-text';
import { formatDateTime } from '@/lib/format';

import type { LiveTranscriptTurn } from './live-transcript';
import { TypewriterRedactedText } from './typewriter-redacted-text';
import { useTypewriterText } from './use-typewriter-text';
import type { TranscriptRound } from './transcript-rounds';
import { hasCallerTurn } from './transcript-rounds';

function speakerLabel(speaker: LiveTranscriptTurn['speaker']): string {
  return speaker === 'agent' ? 'Agent' : 'Customer';
}

function SettledRound({
  round,
  timeZone,
  compact,
}: {
  round: TranscriptRound;
  timeZone: string;
  compact: boolean;
}): React.JSX.Element {
  if (compact) {
    return (
      <li className="flex flex-col gap-2 text-sm leading-6 text-foreground">
        <div>
          <span className="font-semibold text-muted-foreground">{speakerLabel('agent')}:</span>{' '}
          <RedactedText text={round.agent.text} redactions={round.agent.redactions} />
        </div>
        {hasCallerTurn(round) ? (
          <div>
            <span className="font-semibold text-muted-foreground">{speakerLabel('caller')}:</span>{' '}
            <RedactedText text={round.caller!.text} redactions={round.caller!.redactions} />
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {speakerLabel('agent')}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(round.agent.at, timeZone)}</span>
        </div>
        <p className="text-sm text-foreground">
          <RedactedText text={round.agent.text} redactions={round.agent.redactions} />
        </p>
      </div>
      {hasCallerTurn(round) ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {speakerLabel('caller')}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(round.caller!.at, timeZone)}</span>
          </div>
          <p className="text-sm text-foreground">
            <RedactedText text={round.caller!.text} redactions={round.caller!.redactions} />
          </p>
        </div>
      ) : null}
    </li>
  );
}

function RoundRevealAnimator({
  round,
  roundKey,
  timeZone,
  compact,
  onFinished,
}: {
  round: TranscriptRound;
  roundKey: string;
  timeZone: string;
  compact: boolean;
  onFinished: () => void;
}): React.JSX.Element {
  const [phase, setPhase] = useState<'agent' | 'caller'>('agent');
  const agentVisible = useTypewriterText(round.agent.text, phase === 'agent', 42);
  const callerText = round.caller?.text ?? '';
  const callerVisible = useTypewriterText(callerText, phase === 'caller', 42);

  useEffect(() => {
    setPhase('agent');
  }, [roundKey]);

  useEffect(() => {
    if (phase !== 'agent') return;
    if (round.agent.text.length === 0) {
      if (hasCallerTurn(round)) setPhase('caller');
      else onFinished();
      return;
    }
    if (agentVisible.length < round.agent.text.length) return;
    const timer = window.setTimeout(() => {
      if (hasCallerTurn(round)) setPhase('caller');
      else onFinished();
    }, 260);
    return () => window.clearTimeout(timer);
  }, [phase, agentVisible, round, onFinished]);

  useEffect(() => {
    if (phase !== 'caller') return;
    if (callerText.length === 0) {
      onFinished();
      return;
    }
    if (callerVisible.length < callerText.length) return;
    const timer = window.setTimeout(onFinished, 480);
    return () => window.clearTimeout(timer);
  }, [phase, callerVisible, callerText, onFinished]);

  if (compact) {
    return (
      <li className="flex flex-col gap-2 text-sm leading-6 text-foreground">
        <div>
          <span className="font-semibold text-muted-foreground">{speakerLabel('agent')}:</span>{' '}
          <TypewriterRedactedText
            text={phase === 'agent' ? agentVisible : round.agent.text}
            redactions={round.agent.redactions}
            active={phase === 'agent'}
          />
        </div>
        {phase === 'caller' && round.caller ? (
          <div>
            <span className="font-semibold text-muted-foreground">{speakerLabel('caller')}:</span>{' '}
            <TypewriterRedactedText text={callerVisible} redactions={round.caller.redactions} active />
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-md border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {speakerLabel('agent')}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(round.agent.at, timeZone)}</span>
        </div>
        <p className="text-sm text-foreground">
          <TypewriterRedactedText
            text={phase === 'agent' ? agentVisible : round.agent.text}
            redactions={round.agent.redactions}
            active={phase === 'agent'}
          />
        </p>
      </div>
      {phase === 'caller' && round.caller ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {speakerLabel('caller')}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(round.caller.at, timeZone)}</span>
          </div>
          <p className="text-sm text-foreground">
            <TypewriterRedactedText text={callerVisible} redactions={round.caller.redactions} active />
          </p>
        </div>
      ) : null}
    </li>
  );
}

function PendingIndicator({
  pending,
  compact,
  waitingForSeal,
}: {
  pending: { agent?: LiveTranscriptTurn; caller?: LiveTranscriptTurn };
  compact: boolean;
  waitingForSeal?: boolean;
}): React.JSX.Element | null {
  if (waitingForSeal) {
    return (
      <li className={compact ? 'text-xs text-muted-foreground' : 'rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground'}>
        Waiting for the exchange to finish…
      </li>
    );
  }
  if (!pending.agent) return null;
  const label = 'Agent speaking…';
  return (
    <li className={compact ? 'text-xs text-muted-foreground' : 'rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground'}>
      {label}
    </li>
  );
}

export function RoundBasedLiveTranscript({
  rounds,
  pending,
  revealedCount,
  animatingRound,
  sealedCount,
  timeZone,
  compact,
  onRoundFinished,
  endRef,
}: {
  rounds: readonly TranscriptRound[];
  pending: { agent?: LiveTranscriptTurn; caller?: LiveTranscriptTurn };
  revealedCount: number;
  animatingRound: TranscriptRound | null;
  sealedCount: number;
  timeZone: string;
  compact: boolean;
  onRoundFinished: () => void;
  endRef?: React.RefObject<HTMLLIElement | null>;
}): React.JSX.Element {
  const settled = rounds.slice(0, revealedCount);
  const waitingForSeal = rounds.length > 0 && sealedCount === 0 && !animatingRound;

  return (
    <ol className={compact ? 'flex flex-col gap-2' : 'flex max-h-[min(52vh,28rem)] flex-col gap-3 overflow-y-auto pr-1'}>
      {settled.map((round, index) => (
        <SettledRound key={`settled-${index}-${round.agent.at}`} round={round} timeZone={timeZone} compact={compact} />
      ))}
      {animatingRound ? (
        <RoundRevealAnimator
          round={animatingRound}
          roundKey={String(revealedCount)}
          timeZone={timeZone}
          compact={compact}
          onFinished={onRoundFinished}
        />
      ) : null}
      <PendingIndicator pending={pending} compact={compact} waitingForSeal={waitingForSeal} />
      <li ref={endRef} aria-hidden="true" className="h-0" />
    </ol>
  );
}
