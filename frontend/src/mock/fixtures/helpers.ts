/**
 * FIXTURE HELPERS — deterministic construction primitives for the mock dataset.
 *
 * Everything time-related is anchored to `MOCK_NOW_UTC` (see `orgs.ts`). Nothing in the
 * fixtures reads the wall clock; a fixture that drifts with real time is a defect, because
 * the seeded 48-hour-red Dispatch row and the "booked today" counts must stay stable forever.
 * All randomness comes from a seeded mulberry32 PRNG — never the platform RNG.
 */

import { MOCK_NOW_UTC } from '@/mock/orgs';
import type { GradingDimension } from '@/shared/status-models';
import { GRADING_DIMENSIONS } from '@/shared/status-models';
import type { GradeBreakdown, QaGrade, TranscriptTurn } from '@/mock/schema';

/* ==================================================================================
 * Time — every timestamp derives from MOCK_NOW_UTC
 * ================================================================================== */

export const MOCK_NOW_MS = new Date(MOCK_NOW_UTC).getTime();

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** ISO-8601 UTC string `n` hours before the anchored now. Negative `n` = future. */
export function hoursAgo(n: number): string {
  return new Date(MOCK_NOW_MS - n * HOUR_MS).toISOString();
}

/** ISO-8601 UTC string `n` days before the anchored now. Negative `n` = future. */
export function daysAgo(n: number): string {
  return new Date(MOCK_NOW_MS - n * DAY_MS).toISOString();
}

/** ISO-8601 UTC string `n` minutes before the anchored now. Negative `n` = future. */
export function minutesAgo(n: number): string {
  return new Date(MOCK_NOW_MS - n * MINUTE_MS).toISOString();
}

export function hoursFromNow(n: number): string {
  return hoursAgo(-n);
}

export function daysFromNow(n: number): string {
  return daysAgo(-n);
}

/** Offset (ms) between a timezone's local wall clock and UTC at a given instant. */
function tzOffsetMs(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(at)) map[part.type] = part.value;
  const hour = map.hour === '24' ? 0 : Number(map.hour);
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - at.getTime();
}

/**
 * The UTC instant corresponding to a local wall-clock time (`hour`:`minute`) on the
 * calendar date that is `dayOffset` days from the anchored now, in `timeZone`.
 *
 * §2.7: timestamps are stored UTC and rendered in the location's timezone, so a fixture
 * that wants "3pm at the Denver business yesterday" expresses it here and stores the UTC.
 */
export function atLocalHour(
  dayOffset: number,
  hour: number,
  timeZone: string,
  minute = 0,
): string {
  const base = new Date(MOCK_NOW_MS + dayOffset * DAY_MS);
  const cal = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base);
  const [y, m, d] = cal.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute);
  const offset = tzOffsetMs(timeZone, new Date(guess));
  return new Date(guess - offset).toISOString();
}

/** Local hour-of-day (0-23) for a UTC ISO string in a given timezone. */
export function localHour(iso: string, timeZone: string): number {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
  }).format(new Date(iso));
  return Number(h) === 24 ? 0 : Number(h);
}

/** Whole hours between an earlier ISO timestamp and the anchored now. */
export function ageHours(iso: string): number {
  return (MOCK_NOW_MS - new Date(iso).getTime()) / HOUR_MS;
}

/** Add whole seconds to an ISO timestamp, returning a new ISO string. */
export function addSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}

/** Add whole minutes to an ISO timestamp, returning a new ISO string. */
export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * MINUTE_MS).toISOString();
}

/* ==================================================================================
 * Seeded PRNG — mulberry32. Fully deterministic; the platform RNG is never used.
 * ================================================================================== */

export interface Prng {
  /** float in [0, 1) */
  next(): number;
  /** integer in [min, max] inclusive */
  int(min: number, max: number): number;
  /** pick one element deterministically */
  pick<T>(items: readonly T[]): T;
  /** true with probability `p` */
  chance(p: number): boolean;
}

export function makePrng(seed: number): Prng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
}

/* ==================================================================================
 * IDs
 * ================================================================================== */

export function pad(n: number, width = 3): string {
  return String(n).padStart(width, '0');
}

/** Reserved-for-fiction 555 exchange number. `seq` seeds the last four digits. */
export function fictionPhone(seq: number): string {
  const last4 = pad(1000 + (seq % 9000), 4);
  return `+1312555${last4}`;
}

/* ==================================================================================
 * Grades — overall plus a plausible 5-dimension breakdown (§12.3)
 * ================================================================================== */

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Build a QA grade whose five sub-scores sit around `overall` with small deterministic
 * jitter drawn from `rng`. The `overall` returned is exactly the value requested, so the
 * §12.2 trend line reads the truth and post-deployment lift is real.
 */
export function makeGrade(overall: number, rng: Prng): QaGrade {
  const breakdown = GRADING_DIMENSIONS.reduce((acc, dim: GradingDimension) => {
    acc[dim] = clampScore(overall + rng.int(-6, 6));
    return acc;
  }, {} as Record<GradingDimension, number>);
  return { overall: clampScore(overall), breakdown: breakdown as GradeBreakdown };
}

/* ==================================================================================
 * Transcripts — turns with computed PII redaction ranges (§10.1)
 * ================================================================================== */

export interface RedactPhrase {
  readonly phrase: string;
  readonly kind: string;
}

/**
 * Build a transcript turn, computing redaction character ranges for any PII phrases that
 * appear in `text`. The range points at the phrase inside the stored text; a Viewer never
 * receives `media` at all, so this only matters for staff-visible transcripts.
 */
export function turn(
  speaker: TranscriptTurn['speaker'],
  at: string,
  text: string,
  redact: readonly RedactPhrase[] = [],
): TranscriptTurn {
  const redactions = redact.flatMap((r) => {
    const start = text.indexOf(r.phrase);
    if (start < 0) return [];
    return [{ start, end: start + r.phrase.length, kind: r.kind }];
  });
  return { speaker, at, text, redactions };
}
