/**
 * Formatting helpers. FROZEN (Foundation).
 *
 * §2.7: "All timestamps stored UTC, rendered in the location's configured timezone."
 * Every date the user sees goes through this file. A raw `toLocaleString()` elsewhere is a
 * defect: it silently renders in the *browser's* timezone, which for a Chicago business
 * viewed from Karachi is a different day.
 */

import { getOrgById } from '@/mock/orgs';

/** Resolve the display timezone for a row, given its org and location. */
export function timezoneFor(orgId: string, locationId: string): string {
  const org = getOrgById(orgId);
  const loc = org?.locations.find((l) => l.id === locationId);
  if (loc?.timezone) return loc.timezone;
  // Live API rows may carry backend location UUIDs that are not in mock org fixtures.
  return org?.locations[0]?.timezone ?? 'America/Chicago';
}

/** Navbar clock and session-scoped labels (e.g. live-call refresh time). */
export function displayTimezone(
  session: { orgId: string; locationId: string | null },
  org?: { locations: readonly { id: string; timezone: string }[] } | null,
): string {
  const orgData = org ?? getOrgById(session.orgId);
  if (session.locationId) {
    const loc = orgData?.locations.find((l) => l.id === session.locationId);
    if (loc?.timezone) return loc.timezone;
  }
  return orgData?.locations[0]?.timezone ?? 'America/Chicago';
}

export function formatLiveClock(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

/** §16.2 requires "timestamp (UTC plus location timezone)" — both, side by side. */
export function formatUtcAndLocal(iso: string, timeZone: string): { utc: string; local: string } {
  return {
    utc: new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(iso)),
    local: formatDateTime(iso, timeZone),
  };
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** Percentage where the caller already has 0–100, not 0–1. */
export function formatPercentPoints(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

/** Whole dollars. For headline figures like the §4.3 revenue estimate. */
export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Sub-dollar amounts, e.g. §4.5's "average cost per interaction" (~$0.19).
 *
 * `formatUsd` would round that to `$0`, which reads as "this costs nothing" — a materially
 * misleading number on a page whose whole purpose is unit economics. Uses enough precision
 * to keep small values meaningful, and drops to cents once the value clears a dollar.
 */
export function formatUsdPrecise(value: number): string {
  const digits = Math.abs(value) < 1 ? 3 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/** e.g. 3725 -> "1h 2m". Used for handle time and durations. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s === 0 ? `${m}m` : `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatMs(ms: number): string {
  return `${Math.round(ms)} ms`;
}

/** §8.1 aging column: "age in queue". */
export function formatAge(hours: number): string {
  const h = Math.max(0, hours);
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Safe ratio: returns null rather than NaN or a misleading 0 when the denominator is 0. */
export function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}
