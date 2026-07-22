import type { LiveTranscriptTurn } from './live-transcript';

export interface TranscriptRound {
  readonly agent: LiveTranscriptTurn;
  /** Absent when the call ends mid-agent-turn or the customer never responded. */
  readonly caller?: LiveTranscriptTurn;
}

function mergeTurnText(previous: LiveTranscriptTurn, next: LiveTranscriptTurn): LiveTranscriptTurn {
  return {
    ...next,
    text: `${previous.text} ${next.text}`.trim(),
  };
}

export function hasCallerTurn(round: TranscriptRound): boolean {
  return Boolean(round.caller?.text);
}

/**
 * One round = agent speaks, then the user responds.
 * A round is complete as soon as the caller turn exists (no wait for the next agent).
 * The open exchange with only an agent turn stays in `pending`.
 */
export function groupTranscriptIntoRounds(
  turns: readonly LiveTranscriptTurn[],
): {
  complete: TranscriptRound[];
  pending: { agent?: LiveTranscriptTurn; caller?: LiveTranscriptTurn };
} {
  const complete: TranscriptRound[] = [];
  let index = 0;

  while (index < turns.length) {
    if (turns[index].speaker !== 'agent') {
      index += 1;
      continue;
    }

    let agent = turns[index];
    index += 1;
    while (index < turns.length && turns[index].speaker === 'agent') {
      agent = mergeTurnText(agent, turns[index]);
      index += 1;
    }

    if (index >= turns.length || turns[index].speaker !== 'caller') {
      return { complete, pending: { agent } };
    }

    let caller = turns[index];
    index += 1;
    while (index < turns.length && turns[index].speaker === 'caller') {
      caller = mergeTurnText(caller, turns[index]);
      index += 1;
    }

    complete.push({ agent, caller });
  }

  return { complete, pending: {} };
}

type PendingRounds = { agent?: LiveTranscriptTurn; caller?: LiveTranscriptTurn };

export interface TranscriptPlaybackState {
  /** Rounds that are frozen and ready to animate or display. */
  sealedRounds: TranscriptRound[];
  /** Live in-progress indicator (agent speaking, customer still talking). */
  pending: PendingRounds;
  /** Count of agent+customer rounds parsed from the transcript. */
  liveCompleteCount: number;
}

/**
 * Derives the playback queue.
 * Live: latest customer exchange stays open until the next agent speaks.
 * Finalize (call ended): seal every parsed round, including a trailing agent-only turn.
 */
export function buildTranscriptPlaybackState(
  turns: readonly LiveTranscriptTurn[],
  finalizePending = false,
): TranscriptPlaybackState {
  const { complete, pending } = groupTranscriptIntoRounds(turns);

  if (finalizePending) {
    const sealedRounds = [...complete];
    if (pending.agent) {
      sealedRounds.push({ agent: pending.agent });
    }
    return { sealedRounds, pending: {}, liveCompleteCount: complete.length };
  }

  const sealedRounds = pending.agent
    ? [...complete]
    : complete.length > 0
      ? complete.slice(0, -1)
      : [];

  return { sealedRounds, pending, liveCompleteCount: complete.length };
}

export function roundSignature(round: TranscriptRound): string {
  return `${round.agent.at}|${round.agent.text}|${round.caller?.at ?? ''}|${round.caller?.text ?? ''}`;
}

/** Stable key for animation state — does not change while caller text streams in. */
export function roundIdentity(round: TranscriptRound): string {
  return `${round.agent.at}|${round.caller?.at ?? 'agent-only'}`;
}

/** @deprecated Use buildTranscriptPlaybackState().sealedRounds.length */
export function sealedRoundCount(
  complete: readonly TranscriptRound[],
  pending: PendingRounds,
  finalizePending = false,
): number {
  if (finalizePending) {
    return complete.length + (pending.agent ? 1 : 0);
  }
  if (complete.length === 0) return 0;
  if (pending.agent) return complete.length;
  return Math.max(0, complete.length - 1);
}
