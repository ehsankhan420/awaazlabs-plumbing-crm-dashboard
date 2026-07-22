/**
 * §10.3 Conversations shared filter model. One filter set drives BOTH sub-views (Calls and
 * Chats); it lives in the conversations layout so it genuinely persists across the
 * Calls ↔ Chats tab switch (see conversations-provider.tsx).
 *
 * Every status/label comes from `@/shared/status-models`; nothing is hardcoded. The one
 * dimension the spec names but that has no canonical enum is "QA grade band" — a display
 * bucketing of the numeric automation grade — so its buckets are defined here and nowhere
 * else. No color, no `any`, no status string literals.
 */

import type {
  CallDirection,
  CallDisposition,
  ChatChannel,
  InteractionAgentId,
  JobPriority,
} from '@/shared/status-models';

/**
 * §10.3 "QA grade band". The automation grade is a 0–100 number (see schema `QaGrade`);
 * there is no canonical band enum, so the buckets are declared once, here. Ungraded records
 * (grade === null) match only the `all` band.
 */
export const GRADE_BANDS = ['all', '90_100', '80_89', '70_79', 'below_70'] as const;
export type GradeBand = (typeof GRADE_BANDS)[number];

export const GRADE_BAND_LABELS: Readonly<Record<GradeBand, string>> = {
  all: 'All grades',
  '90_100': '90–100',
  '80_89': '80–89',
  '70_79': '70–79',
  below_70: 'Below 70',
};

export function matchesGradeBand(overall: number | null, band: GradeBand): boolean {
  if (band === 'all') return true;
  if (overall === null) return false;
  switch (band) {
    case '90_100':
      return overall >= 90;
    case '80_89':
      return overall >= 80 && overall < 90;
    case '70_79':
      return overall >= 70 && overall < 80;
    case 'below_70':
      return overall < 70;
    default:
      return true;
  }
}

/**
 * §10.3 shared filters. Some dimensions are call-only (direction, disposition, agent,
 * priority) and some chat-only (channel); the shared bar exposes all of them, and each
 * sub-view applies the subset its records carry (BUILD_NOTES B2: `chat` is not one of the
 * voice agents, so the agent dimension is a Calls concern and the channel dimension a Chats
 * concern). `'all'` means unfiltered.
 */
export interface ConversationFilters {
  /** §5.3 "Search by customer name, plumber name, phone, job reference, or conversation reference." */
  readonly search: string;
  /** yyyy-mm-dd inclusive lower bound on the interaction's local date. '' = open. */
  readonly dateFrom: string;
  /** yyyy-mm-dd inclusive upper bound. '' = open. */
  readonly dateTo: string;
  /** Voice agent (Calls). */
  readonly agent: InteractionAgentId | 'all';
  /** Chat channel (Chats). */
  readonly channel: ChatChannel | 'all';
  readonly direction: CallDirection | 'all';
  readonly disposition: CallDisposition | 'all';
  readonly priority: JobPriority | 'all';
  readonly gradeBand: GradeBand;
  /** Location id, or `'all'`. Surfaced only when the org is multi-location. */
  readonly locationId: string | 'all';
}

export const DEFAULT_FILTERS: ConversationFilters = {
  search: '',
  dateFrom: '',
  dateTo: '',
  agent: 'all',
  channel: 'all',
  direction: 'all',
  disposition: 'all',
  priority: 'all',
  gradeBand: 'all',
  locationId: 'all',
};

/**
 * yyyy-mm-dd date key in a given IANA timezone, for range comparison against the date
 * filter. Never used for display (that always goes through `@/lib/format`). `en-CA` yields
 * ISO-ordered y-m-d.
 */
export function localDateKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** True when `iso`'s local date sits within the (possibly open-ended) filter range. */
export function withinDateRange(iso: string, timeZone: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const key = localDateKey(iso, timeZone);
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}
