/**
 * §9 CHAT AGENTS — pure derivations over chat interactions (WhatsApp + web chat).
 *
 * Reads only aggregate / non-identity fields (channel, outcome, intent, language, latency,
 * message count, grade), so the tab survives restricted mode. Enums and labels import from
 * `@/shared/status-models`; the metric and channel color bindings import from the frozen
 * `series-map.ts`. Intent and language have no series-map entry, so their color lookups live
 * here once, keyed by entity, token-only. Every rate goes through `ratio()` → `null` (not
 * NaN / not a misleading 0%) when the denominator is zero.
 */

import { ratio } from '@/lib/format';
import { daysSince } from '@/lib/metrics';
import type { ChatInteraction } from '@/mock/schema';
import { LANGUAGES, type Language } from '@/shared/status-models';

/* ----------------------------------------------------------------------------------------
 * Period selector (§9.1 "count, period selector")
 * -------------------------------------------------------------------------------------- */

export interface PeriodOption {
  readonly value: string;
  readonly label: string;
  readonly days: number | null;
}

export const PERIOD_OPTIONS: readonly PeriodOption[] = [
  { value: '7', label: 'Last 7 days', days: 7 },
  { value: '30', label: 'Last 30 days', days: 30 },
  { value: '90', label: 'Last 90 days', days: 90 },
  { value: 'all', label: 'All time', days: null },
];

export function filterChatsByPeriod(
  chats: readonly ChatInteraction[],
  days: number | null,
): readonly ChatInteraction[] {
  if (days === null) return chats;
  return chats.filter((c) => {
    const age = daysSince(c.atUtc);
    return age >= 0 && age <= days;
  });
}

/* ----------------------------------------------------------------------------------------
 * §9.1 stat cards
 * -------------------------------------------------------------------------------------- */

export interface ChatStats {
  readonly sessions: number;
  readonly whatsapp: number;
  readonly webChat: number;
  readonly avgMessagesPerSession: number | null;
  readonly containmentRate: number | null;
  readonly resolutionRate: number | null;
  readonly deflectionRate: number | null;
  readonly escalationRate: number | null;
  readonly bookings: number;
  readonly bookingIntentSessions: number;
  readonly bookingConversion: number | null;
  readonly avgLatencyMs: number | null;
  readonly p95LatencyMs: number | null;
  /** §9.1 CSAT proxy out of 5. */
  readonly csatProxy: number | null;
}

function percentile(sortedAsc: readonly number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.round(p * (sortedAsc.length - 1))));
  return sortedAsc[idx];
}

export function computeChatStats(chats: readonly ChatInteraction[]): ChatStats {
  const total = chats.length;

  const escalated = chats.filter((c) => c.outcome === 'escalated').length;
  const resolved = chats.filter((c) => c.outcome === 'resolved').length;
  const abandoned = chats.filter((c) => c.outcome === 'abandoned').length;
  const booked = chats.filter((c) => c.outcome === 'job_created').length;

  const messages = chats.reduce((sum, c) => sum + c.messageCount, 0);
  const latencies = chats.map((c) => c.responseLatencyMs).sort((a, b) => a - b);

  const bookingIntent = chats.filter((c) => normalizeIntent(c.intent) === 'job request').length;

  const graded = chats.filter((c) => c.grade !== null);
  const gradeSum = graded.reduce((sum, c) => sum + (c.grade?.overall ?? 0), 0);
  // Proxy: mean QA grade (0–100) rescaled to a 0–5 CSAT-style score.
  const csatProxy = graded.length > 0 ? Math.round((gradeSum / graded.length / 20) * 10) / 10 : null;

  return {
    sessions: total,
    whatsapp: chats.filter((c) => c.channel === 'whatsapp').length,
    webChat: chats.filter((c) => c.channel === 'web_chat').length,
    avgMessagesPerSession: total > 0 ? messages / total : null,
    // Containment: sessions fully handled by the agent (i.e. not handed to a human).
    containmentRate: ratio(total - escalated, total),
    // Resolution: the customer's goal was met (job created or resolved).
    resolutionRate: ratio(resolved + booked, total),
    // Deflection: completed in text without needing a call or a human handoff.
    deflectionRate: ratio(total - escalated - abandoned, total),
    escalationRate: ratio(escalated, total),
    bookings: booked,
    bookingIntentSessions: bookingIntent,
    bookingConversion: ratio(booked, bookingIntent),
    avgLatencyMs: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null,
    p95LatencyMs: percentile(latencies, 0.95),
    csatProxy,
  };
}

/* ----------------------------------------------------------------------------------------
 * §9.2 containment vs resolution vs deflection vs escalation
 * -------------------------------------------------------------------------------------- */

export const CHAT_METRIC_ORDER = ['containment', 'resolution', 'deflection', 'escalation'] as const;
export type ChatMetricKey = (typeof CHAT_METRIC_ORDER)[number];

export const CHAT_METRIC_LABELS: Readonly<Record<ChatMetricKey, string>> = {
  containment: 'Containment',
  resolution: 'Resolution',
  deflection: 'Deflection',
  escalation: 'Escalation',
};

export function chatMetricRates(stats: ChatStats): Readonly<Record<ChatMetricKey, number | null>> {
  return {
    containment: stats.containmentRate,
    resolution: stats.resolutionRate,
    deflection: stats.deflectionRate,
    escalation: stats.escalationRate,
  };
}

/* ----------------------------------------------------------------------------------------
 * §9.2 sessions over time by channel
 * -------------------------------------------------------------------------------------- */

export interface ChannelTimeSeries {
  readonly labels: readonly string[];
  readonly whatsapp: readonly number[];
  readonly webChat: readonly number[];
}

/** Weekly session counts per channel, oldest → newest. */
export function sessionsByChannelOverTime(
  chats: readonly ChatInteraction[],
  weeks: number,
): ChannelTimeSeries {
  const whatsapp = new Array<number>(weeks).fill(0);
  const webChat = new Array<number>(weeks).fill(0);

  for (const c of chats) {
    const weekIdx = Math.floor(daysSince(c.atUtc) / 7);
    if (weekIdx < 0 || weekIdx >= weeks) continue;
    const bucket = weeks - 1 - weekIdx;
    if (c.channel === 'whatsapp') whatsapp[bucket] += 1;
    else webChat[bucket] += 1;
  }

  const labels = Array.from({ length: weeks }, (_, i) => {
    const ago = weeks - 1 - i;
    return ago === 0 ? 'This week' : `${ago}w ago`;
  });
  return { labels, whatsapp, webChat };
}

/* ----------------------------------------------------------------------------------------
 * §9.2 intent distribution
 * -------------------------------------------------------------------------------------- */

export const CHAT_INTENTS = [
  'job request',
  'pricing',
  'service area',
  'job status',
  'reschedule',
  'other',
] as const;
export type ChatIntent = (typeof CHAT_INTENTS)[number];

export const CHAT_INTENT_LABELS: Readonly<Record<ChatIntent, string>> = {
  'job request': 'New job request',
  pricing: 'Pricing',
  'service area': 'Service area',
  'job status': 'Job status',
  reschedule: 'Reschedule',
  other: 'Other',
};

/** Local color binding (not in the frozen series-map): six intents, fixed slot order. */
export const CHAT_INTENT_SERIES: Readonly<Record<ChatIntent, string>> = {
  'job request': 'var(--chart-1)',
  pricing: 'var(--chart-2)',
  'service area': 'var(--chart-3)',
  'job status': 'var(--chart-4)',
  reschedule: 'var(--chart-5)',
  other: 'hsl(var(--muted-foreground))',
};

/** Free-text fixture intents map onto the six buckets by keyword. */
function normalizeIntent(intent: string): ChatIntent {
  const lower = intent.toLowerCase();
  if (lower.includes('new job') || lower.includes('schedule service') || lower.includes('intake')) return 'job request';
  if (lower.includes('pricing') || lower.includes('quote') || lower.includes('fee')) return 'pricing';
  if (lower.includes('area') || lower.includes('coverage')) return 'service area';
  if (lower.includes('status')) return 'job status';
  if (lower.includes('reschedul')) return 'reschedule';
  return 'other';
}

export interface IntentCount {
  readonly key: ChatIntent;
  readonly count: number;
}

export function intentDistribution(chats: readonly ChatInteraction[]): readonly IntentCount[] {
  return CHAT_INTENTS.map((intent) => ({
    key: intent,
    count: chats.filter((c) => normalizeIntent(c.intent) === intent).length,
  }));
}

/* ----------------------------------------------------------------------------------------
 * §9.2 language mix
 * -------------------------------------------------------------------------------------- */

/** Local color binding (not in the frozen series-map). Token references only. */
export const LANGUAGE_SERIES: Readonly<Record<Language, string>> = {
  en: 'var(--chart-1)',
  es: 'var(--chart-5)',
  other: 'hsl(var(--muted-foreground))',
};

export interface LanguageCount {
  readonly key: Language;
  readonly count: number;
}

export function languageDistribution(chats: readonly ChatInteraction[]): readonly LanguageCount[] {
  return LANGUAGES.map((lang) => ({
    key: lang,
    count: chats.filter((c) => c.language === lang).length,
  }));
}
