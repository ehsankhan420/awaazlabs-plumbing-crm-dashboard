/**
 * MOCK DATA-ACCESS LAYER — the enforcement point for role gating.
 *
 * FROZEN FILE (Foundation).
 *
 * Role gating is structurally real: a Viewer never receives a raw phone number — not
 * masked in CSS, absent from the returned object. Recordings and transcripts are omitted,
 * not disabled. Every gated read that succeeds writes an audit event.
 */

import { writeAuditEvent } from '@/shared/audit';
import type { Role } from '@/shared/status-models';
import type {
  CallInteraction,
  ChatInteraction,
  CustomerContact,
  DispatchRecord,
  Escalation,
  Job,
  OrgFixture,
  Plumber,
} from './schema';

/* ==================================================================================
 * Session
 * ================================================================================== */

export interface Session {
  readonly actor: string;
  readonly role: Role;
  readonly orgId: string;
  /** Global location filter. `null` = all locations. */
  readonly locationId: string | null;
}

/* ==================================================================================
 * Capability predicates — derived from the role model, in one place, never re-derived
 * ================================================================================== */

/** Viewer: no phone-number reveal. */
export function canRevealPhone(s: Session): boolean {
  return s.role !== 'VIEWER';
}

/** Viewer: no recordings, no transcripts. */
export function canAccessMedia(s: Session): boolean {
  return s.role !== 'VIEWER';
}

/** Exports are role-gated to Owner, Manager, and Dispatcher. */
export function canExport(s: Session): boolean {
  return s.role !== 'VIEWER';
}

/** Audit Log: Owner only. */
export function canSeeAuditLog(s: Session): boolean {
  return s.role === 'OWNER_ADMIN';
}

export function canSeeBilling(s: Session): boolean {
  return s.role === 'OWNER_ADMIN';
}

export function canSeeMembers(s: Session): boolean {
  return s.role === 'OWNER_ADMIN';
}

/** Consent list: manual add and remove (audited, Owner and Manager). */
export function canEditConsentList(s: Session): boolean {
  return s.role === 'OWNER_ADMIN' || s.role === 'MANAGER';
}

/** Any Owner, Manager, or Dispatcher can acknowledge an escalation. */
export function canAcknowledgeEscalation(s: Session): boolean {
  return s.role !== 'VIEWER';
}

/** Row actions and job outcome controls are staff workflow, not Viewer surface. */
export function canPerformWorkflowActions(s: Session): boolean {
  return s.role !== 'VIEWER';
}

/** Pause and resume controls (Owner and Manager, audited). */
export function canControlCampaigns(s: Session): boolean {
  return s.role === 'OWNER_ADMIN' || s.role === 'MANAGER';
}

/* ==================================================================================
 * View types — what the UI is actually allowed to hold
 * ================================================================================== */

/**
 * The identity a caller receives. `phoneE164` is `null` for a Viewer: the raw value
 * never crosses the boundary, so `MaskedValue` has nothing to reveal and the reveal
 * control is not rendered.
 */
export interface CustomerIdentityView {
  readonly firstName: string;
  readonly lastName: string;
  /** Masked pattern. Always safe to render. */
  readonly phoneMasked: string;
  /** Present only when `canRevealPhone(session)`. */
  readonly phoneE164: string | null;
}

export type ContactView = Omit<CustomerContact, 'identity'> & {
  readonly identity: CustomerIdentityView | null;
};

export type JobView = Job & {
  readonly contact: ContactView;
  readonly locationName?: string | null;
  readonly serviceAreaName?: string | null;
  readonly assignedPlumberName?: string | null;
  /** The linked dispatch record, attached for the drawer's Dispatch and Assignment section. */
  readonly dispatch?: DispatchRecord | null;
  /** §5.2 Needs Attention scope membership. Computed by the data adapter. */
  readonly needsAttention?: boolean;
};

export type DispatchRecordView = DispatchRecord & {
  readonly contact: ContactView;
  readonly job: Job | null;
  readonly locationName?: string | null;
  readonly serviceAreaName?: string | null;
  readonly currentCandidateName?: string | null;
  readonly assignedPlumberName?: string | null;
};

export type CallInteractionView = CallInteraction & {
  readonly contact: ContactView | null;
  readonly plumber: Plumber | null;
  readonly locationName?: string | null;
};

export type ChatInteractionView = ChatInteraction & { readonly contact: ContactView | null };

export type EscalationView = Escalation & {
  readonly contact: ContactView | null;
  readonly job: Job | null;
  readonly locationName?: string | null;
};

/**
 * Row payloads stay behind a discriminated union so a future backend can degrade a
 * restricted caller to aggregates without silently rendering an empty table.
 */
export type GatedRows<T> =
  | { readonly kind: 'rows'; readonly rows: readonly T[] }
  | { readonly kind: 'aggregate'; readonly total: number; readonly reason: string };

/* ==================================================================================
 * Masking
 * ================================================================================== */

/**
 * "Phone (masked as pattern, click-to-reveal, reveal audited)".
 * `+13125551234` -> `(•••) •••-1234`. The last four digits are the standard
 * disambiguator dispatch staff use; nothing more is exposed.
 */
export function maskPhone(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  const last4 = digits.slice(-4);
  return `(•••) •••-${last4}`;
}

/* ==================================================================================
 * Projection — the single choke point where gating happens
 * ================================================================================== */

function projectContact(contact: CustomerContact, session: Session): ContactView {
  if (!contact.identity) {
    return { ...contact, identity: null };
  }

  return {
    ...contact,
    identity: {
      firstName: contact.identity.firstName,
      lastName: contact.identity.lastName,
      phoneMasked: maskPhone(contact.identity.phoneE164),
      // The raw number is withheld here, at the boundary — not later, in the component.
      phoneE164: canRevealPhone(session) ? contact.identity.phoneE164 : null,
    },
  };
}

function projectCall(call: CallInteraction, session: Session): CallInteraction {
  if (canAccessMedia(session)) return call;
  // Recording URL and transcript are removed from the payload entirely.
  return { ...call, media: null };
}

function projectChat(chat: ChatInteraction, session: Session): ChatInteraction {
  if (canAccessMedia(session)) return chat;
  return { ...chat, messages: null };
}

/** The global location filter sits in the top bar and persists across tabs. */
function inScope(locationId: string, session: Session): boolean {
  return session.locationId === null || session.locationId === locationId;
}

/* ==================================================================================
 * Readers
 * ================================================================================== */

function contactIndex(fixture: OrgFixture): ReadonlyMap<string, CustomerContact> {
  return new Map(fixture.contacts.map((c) => [c.id, c]));
}

function plumberIndex(fixture: OrgFixture): ReadonlyMap<string, Plumber> {
  return new Map(fixture.plumbers.map((p) => [p.id, p]));
}

function locationName(fixture: OrgFixture, locationId: string): string | null {
  return fixture.org.locations.find((l) => l.id === locationId)?.name ?? null;
}

function serviceAreaName(fixture: OrgFixture, areaId: string): string | null {
  return fixture.org.serviceAreas.find((a) => a.id === areaId)?.name ?? null;
}

export function listJobs(fixture: OrgFixture, session: Session): GatedRows<JobView> {
  const scoped = fixture.jobs.filter((j) => inScope(j.locationId, session));
  const contacts = contactIndex(fixture);
  const plumbers = plumberIndex(fixture);
  const dispatchById = new Map(fixture.dispatchRecords.map((d) => [d.id, d]));

  const rows = scoped.flatMap((job) => {
    const contact = contacts.get(job.contactId);
    if (!contact) return [];
    return [{
      ...job,
      contact: projectContact(contact, session),
      locationName: locationName(fixture, job.locationId),
      serviceAreaName: serviceAreaName(fixture, job.serviceAreaId),
      assignedPlumberName: job.assignedPlumberId ? plumbers.get(job.assignedPlumberId)?.name ?? null : null,
      dispatch: job.dispatchId ? dispatchById.get(job.dispatchId) ?? null : null,
    }];
  });

  return { kind: 'rows', rows };
}

export function listDispatchRecords(fixture: OrgFixture, session: Session): GatedRows<DispatchRecordView> {
  const scoped = fixture.dispatchRecords.filter((d) => inScope(d.locationId, session));
  const contacts = contactIndex(fixture);
  const plumbers = plumberIndex(fixture);
  const jobsById = new Map(fixture.jobs.map((j) => [j.id, j]));

  const rows = scoped.flatMap((record) => {
    const job = jobsById.get(record.jobId) ?? null;
    const contact = job ? contacts.get(job.contactId) : undefined;
    if (!contact) return [];
    return [{
      ...record,
      contact: projectContact(contact, session),
      job,
      locationName: locationName(fixture, record.locationId),
      serviceAreaName: serviceAreaName(fixture, record.serviceAreaId),
      currentCandidateName: record.currentCandidateId ? plumbers.get(record.currentCandidateId)?.name ?? null : null,
      assignedPlumberName: record.assignedPlumberId ? plumbers.get(record.assignedPlumberId)?.name ?? null : null,
    }];
  });

  return { kind: 'rows', rows };
}

export function listCalls(fixture: OrgFixture, session: Session): GatedRows<CallInteractionView> {
  const scoped = fixture.calls.filter((c) => inScope(c.locationId, session));
  const contacts = contactIndex(fixture);
  const plumbers = plumberIndex(fixture);

  const rows = scoped.map((call) => {
    const contact = call.contactId ? contacts.get(call.contactId) : undefined;
    return {
      ...projectCall(call, session),
      contact: contact ? projectContact(contact, session) : null,
      plumber: call.plumberId ? plumbers.get(call.plumberId) ?? null : null,
      locationName: locationName(fixture, call.locationId),
    };
  });

  return { kind: 'rows', rows };
}

export function listChats(fixture: OrgFixture, session: Session): GatedRows<ChatInteractionView> {
  const scoped = fixture.chats.filter((c) => inScope(c.locationId, session));
  const contacts = contactIndex(fixture);

  const rows = scoped.map((chat) => {
    const contact = chat.contactId ? contacts.get(chat.contactId) : undefined;
    return {
      ...projectChat(chat, session),
      contact: contact ? projectContact(contact, session) : null,
    };
  });

  return { kind: 'rows', rows };
}

export function listEscalations(fixture: OrgFixture, session: Session): GatedRows<EscalationView> {
  const scoped = fixture.escalations.filter((e) => inScope(e.locationId, session));
  const contacts = contactIndex(fixture);
  const jobsById = new Map(fixture.jobs.map((j) => [j.id, j]));

  const rows = scoped.map((escalation) => {
    const contact = escalation.contactId ? contacts.get(escalation.contactId) : undefined;
    return {
      ...escalation,
      contact: contact ? projectContact(contact, session) : null,
      job: escalation.jobId ? jobsById.get(escalation.jobId) ?? null : null,
      locationName: locationName(fixture, escalation.locationId),
    };
  });

  return { kind: 'rows', rows };
}

/* ==================================================================================
 * Audited actions
 *
 * Each refuses first and audits second, so a denied attempt never produces a
 * misleading "success" audit row.
 * ================================================================================== */

export class PermissionDeniedError extends Error {
  constructor(action: string, role: Role) {
    super(`Permission denied: ${action} is not available to ${role}.`);
    this.name = 'PermissionDeniedError';
  }
}

/** "Click-to-reveal, reveal audited". Returns the raw number or throws. */
export function revealPhone(identity: CustomerIdentityView, session: Session, objectRef: string): string {
  if (!canRevealPhone(session) || identity.phoneE164 === null) {
    throw new PermissionDeniedError('phone number reveal', session.role);
  }

  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: 'phone_number_reveal',
    objectRef,
    locationId: session.locationId,
  });

  return identity.phoneE164;
}

/** Consent list: "manual add and remove (audited, Owner and Manager)". */
export function recordConsentListChange(session: Session, phoneMasked: string, action: 'add' | 'remove'): void {
  if (!canEditConsentList(session)) {
    throw new PermissionDeniedError('consent list change', session.role);
  }
  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: 'consent_list_change',
    objectRef: `suppression:${phoneMasked}`,
    locationId: session.locationId,
    detail: { action },
  });
}

/** "Role changes audited." */
export function recordPermissionChange(session: Session, memberId: string, from: Role, to: Role): void {
  if (!canSeeMembers(session)) {
    throw new PermissionDeniedError('permission change', session.role);
  }
  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: 'permission_change',
    objectRef: `member:${memberId}`,
    locationId: session.locationId,
    detail: { from, to },
  });
}
