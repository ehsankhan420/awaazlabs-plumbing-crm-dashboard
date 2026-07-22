/**
 * Audit action helpers — frontend-only build.
 *
 * These write to the in-memory audit store (src/shared/audit.ts), which feeds the Audit
 * Log tab. The function names are kept API-shaped so a real backend can slot in behind
 * them later without touching call sites.
 */

import { getAuditEvents, writeAuditEvent, type AuditEvent, type AuditEventType } from '@/shared/audit';

export interface AuditEventFilters {
  readonly actor?: string;
  readonly eventType?: AuditEventType;
  readonly object?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
}

let sessionActor = 'owner@dashboard';
let sessionRole: AuditEvent['role'] = 'OWNER_ADMIN';

/** Called once by the session provider so audit writes carry the active identity. */
export function setAuditIdentity(actor: string, role: AuditEvent['role']): void {
  sessionActor = actor;
  sessionRole = role;
}

export async function fetchLiveAuditEvents(filters: AuditEventFilters): Promise<readonly AuditEvent[]> {
  return getAuditEvents().filter((event) => {
    if (filters.actor && !event.actor.toLowerCase().includes(filters.actor.toLowerCase())) return false;
    if (filters.eventType && event.eventType !== filters.eventType) return false;
    if (filters.object && !event.objectRef.toLowerCase().includes(filters.object.toLowerCase())) return false;
    if (filters.dateFrom && event.timestampUtc < filters.dateFrom) return false;
    if (filters.dateTo && event.timestampUtc > `${filters.dateTo}T23:59:59.999Z`) return false;
    return true;
  });
}

/** Fires once per session, right after the app resolves identity — see session-context.tsx. */
export async function recordLoginEvent(): Promise<void> {
  writeAuditEvent({
    actor: sessionActor,
    role: sessionRole,
    eventType: 'login',
    objectRef: 'session',
    locationId: null,
  });
}

/** Records that a transcript drawer was opened. */
export async function recordTranscriptView(id: string, entity: 'call' | 'chat' = 'call'): Promise<void> {
  writeAuditEvent({
    actor: sessionActor,
    role: sessionRole,
    eventType: 'transcript_view',
    objectRef: `${entity}:${id}`,
    locationId: null,
  });
}

/** Records recording playback from the audio player. */
export async function recordRecordingPlayback(id: string): Promise<void> {
  writeAuditEvent({
    actor: sessionActor,
    role: sessionRole,
    eventType: 'recording_playback',
    objectRef: `call:${id}`,
    locationId: null,
  });
}

/** For CSV exports built entirely client-side from data already in hand. */
export async function recordClientExport(
  entity: string,
  rowCount: number,
  filters: Readonly<Record<string, string>>,
): Promise<void> {
  writeAuditEvent({
    actor: sessionActor,
    role: sessionRole,
    eventType: 'export',
    objectRef: `export:${entity}`,
    locationId: null,
    detail: { rowCount: String(rowCount), ...filters },
  });
}
