type PreviewPhase = 'typing' | 'hold' | 'erasing';

export interface TranscriptPlaybackSession {
  playbackIndex: number;
  phase: PreviewPhase;
  furthestCompletedIndex: number;
}

const sessions = new Map<string, TranscriptPlaybackSession>();
const linesRevealedByCallId = new Map<string, number>();

export function readPlaybackSession(callId: string): TranscriptPlaybackSession {
  return sessions.get(callId) ?? { playbackIndex: 0, phase: 'typing', furthestCompletedIndex: -1 };
}

export function writePlaybackSession(callId: string, session: TranscriptPlaybackSession): void {
  sessions.set(callId, session);
}

export function clearPlaybackSession(callId: string): void {
  sessions.delete(callId);
  linesRevealedByCallId.delete(callId);
}

export function readLinesRevealed(callId: string): number | undefined {
  return linesRevealedByCallId.get(callId);
}

export function writeLinesRevealed(callId: string, count: number): void {
  linesRevealedByCallId.set(callId, count);
}
