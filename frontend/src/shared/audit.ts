/**
 * AUDIT EVENT WRITER — feeds the Audit Log tab.
 *
 * An in-memory store fed by real UI actions elsewhere in the app (never a static
 * fixture). Writes happen at the action layer and cannot be disabled.
 */

import type { Role } from './status-models';

/**
 * The canonical audited event types: login, phone-number reveal, recording playback,
 * transcript view, customer search, export, note edit, job status change, dispatch
 * queue action, knowledge change request, consent list change, permission change.
 *
 * Exactly twelve. Do not add a thirteenth without a spec line to point at.
 */
export const AUDIT_EVENT_TYPES = [
  'login',
  'phone_number_reveal',
  'recording_playback',
  'transcript_view',
  'customer_search',
  'export',
  'note_edit',
  'job_status_change',
  'dispatch_queue_action',
  'knowledge_change_request',
  'consent_list_change',
  'permission_change',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const AUDIT_EVENT_TYPE_LABELS: Readonly<Record<AuditEventType, string>> = {
  login: 'Login',
  phone_number_reveal: 'Phone number reveal',
  recording_playback: 'Recording playback',
  transcript_view: 'Transcript view',
  customer_search: 'Customer search',
  export: 'Export',
  note_edit: 'Note edit',
  job_status_change: 'Job status change',
  dispatch_queue_action: 'Dispatch queue action',
  knowledge_change_request: 'Knowledge change request',
  consent_list_change: 'Consent list change',
  permission_change: 'Permission change',
};

/**
 * §16.2 columns: "timestamp (UTC plus location timezone), actor, role, event type,
 * object reference, IP, user agent."
 */
export interface AuditEvent {
  readonly id: string;
  /** ISO-8601 UTC. Rendered in the location's timezone at display time (§2.7). */
  readonly timestampUtc: string;
  readonly actor: string;
  readonly role: Role;
  readonly eventType: AuditEventType;
  /** e.g. "job:appt_0142", "dispatch:vob_0031". Free-form reference to the object acted on. */
  readonly objectRef: string;
  readonly ip: string;
  readonly userAgent: string;
  readonly locationId: string | null;
  /**
   * §16.1 requires exports to record "row-count and filter parameters". Kept as a
   * string map so the Audit Log can render it without knowing each caller's shape.
   */
  readonly detail?: Readonly<Record<string, string>>;
}

export type AuditEventDraft = Omit<AuditEvent, 'id' | 'timestampUtc' | 'ip' | 'userAgent'>;

/* ------------------------------------------------------------------------------------
 * Store
 *
 * A module-level singleton with a `useSyncExternalStore`-compatible subscribe/snapshot
 * pair. Next.js App Router navigations are client-side, so this persists across route
 * changes within a session, which is what §16.2 needs to demonstrate. A hard refresh
 * resets it and re-seeds the login event — acceptable for a hardcoded-data build, and
 * stated plainly rather than papered over with localStorage.
 * ---------------------------------------------------------------------------------- */

let events: AuditEvent[] = [];
let counter = 0;
const listeners = new Set<() => void>();

/**
 * Immutable snapshot. `useSyncExternalStore` compares by reference, so this must return
 * the same array identity until a write actually occurs — otherwise React re-renders
 * forever.
 */
function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * The environment fields (§16.2 "IP, user agent") cannot be truthfully known in a
 * frontend-only build. They are stamped from the browser where available and from an
 * explicit placeholder otherwise. We never invent a plausible-looking IP: a fabricated
 * audit field is worse than an honest one.
 */
function environment(): { ip: string; userAgent: string } {
  if (typeof navigator === 'undefined') {
    return { ip: 'unavailable (server render)', userAgent: 'unavailable (server render)' };
  }
  return { ip: 'recorded server-side', userAgent: navigator.userAgent };
}

/**
 * Write an immutable audit event. Called by the mock data-access layer and by every
 * gated UI action. There is no `disableAudit` switch, by design (§2.3).
 */
export function writeAuditEvent(draft: AuditEventDraft): AuditEvent {
  const { ip, userAgent } = environment();
  counter += 1;

  const event: AuditEvent = Object.freeze({
    ...draft,
    id: `audit_${String(counter).padStart(5, '0')}`,
    // Deterministic ordering is guaranteed by the counter; the clock only labels.
    timestampUtc: new Date().toISOString(),
    ip,
    userAgent,
  });

  // Newest first — §16.2 is an append-only log read reverse-chronologically.
  events = [event, ...events];
  emit();
  return event;
}

/** Reverse-chronological. Never mutate the returned array. */
export function getAuditEvents(): readonly AuditEvent[] {
  return events;
}

export function subscribeToAuditEvents(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Server snapshot for `useSyncExternalStore`. Always empty: the store is client-only. */
const EMPTY: readonly AuditEvent[] = Object.freeze([]);
export function getAuditEventsServerSnapshot(): readonly AuditEvent[] {
  return EMPTY;
}

/** Test/demo affordance only. Never called from UI. */
export function __resetAuditStoreForTests(): void {
  events = [];
  counter = 0;
  emit();
}
