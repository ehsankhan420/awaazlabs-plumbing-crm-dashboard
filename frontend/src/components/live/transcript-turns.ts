import type { LiveTranscriptTurn } from './live-transcript';

/** How many transcript lines are complete and safe to show (no animation). */
export function sealedTurnCount(turns: readonly LiveTranscriptTurn[], finalizePending = false): number {
  if (turns.length === 0) return 0;
  if (finalizePending) return turns.length;
  return Math.max(0, turns.length - 1);
}
