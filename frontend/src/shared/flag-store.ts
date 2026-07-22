/**
 * FLAG STORE — spec §12.5, written by §5.4, §8.2, §10.1, §10.2.
 *
 * §12.5: "All client-submitted flags (from the Flag this interaction button across
 * Jobs, Conversations, Dispatch Queue) land here as priority items with status:
 * submitted, under review, resolved... This closes the loop publicly: the business flags,
 * the operations team reviews, the fix appears in the optimization timeline."
 *
 * Like the audit store, this must be fed by **real actions**, not by a static fixture.
 * The seeded `fixture.flags` provide history (items already under review or resolved);
 * anything the user flags during the session is appended here and appears immediately in
 * the §12.5 inbox.
 *
 * Note deliberately NOT done: flagging does not write an audit event. §2.3 enumerates
 * exactly twelve audited event types and "flag" is not among them. Adding a thirteenth
 * would contradict the spec and the frozen `AuditEventType` union. See BUILD_NOTES § B14.
 */

import type { FlaggedInteraction } from '@/mock/schema';

type Listener = () => void;

/** Per-org, because the §12.5 inbox is scoped to the active organization. */
const runtimeFlags = new Map<string, FlaggedInteraction[]>();
const listeners = new Set<Listener>();
let counter = 0;

function emit(): void {
  for (const listener of listeners) listener();
}

export interface FlagDraft {
  readonly orgId: string;
  /** The call or chat being flagged. */
  readonly interactionId: string;
  readonly submittedBy: string;
  readonly reason: string;
}

/** §17: a new flag always begins at `submitted`. */
export function submitFlag(draft: FlagDraft): FlaggedInteraction {
  counter += 1;

  const flag: FlaggedInteraction = Object.freeze({
    id: `flag_rt_${String(counter).padStart(4, '0')}`,
    interactionId: draft.interactionId,
    submittedAtUtc: new Date().toISOString(),
    submittedBy: draft.submittedBy,
    status: 'submitted',
    reason: draft.reason,
    resolutionNote: null,
  });

  const existing = runtimeFlags.get(draft.orgId) ?? [];
  runtimeFlags.set(draft.orgId, [flag, ...existing]);
  emit();
  return flag;
}

/** Flags submitted during this session, newest first. Never mutate the result. */
export function getRuntimeFlags(orgId: string): readonly FlaggedInteraction[] {
  return runtimeFlags.get(orgId) ?? EMPTY;
}

/** True once the user has flagged this interaction, so the button can show its state. */
export function isFlagged(orgId: string, interactionId: string): boolean {
  return getRuntimeFlags(orgId).some((f) => f.interactionId === interactionId);
}

export function subscribeToFlags(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const EMPTY: readonly FlaggedInteraction[] = Object.freeze([]);

/** Server snapshot for `useSyncExternalStore`. The store is client-only. */
export function getFlagsServerSnapshot(): readonly FlaggedInteraction[] {
  return EMPTY;
}

/*
 * The §12.5 inbox composes `getRuntimeFlags(orgId)` with the seeded `fixture.flags`
 * directly, inside a `useMemo` keyed on the subscription value. An `allFlags()` helper used
 * to live here, but it read the store internally, which hid the reactive dependency from
 * React's exhaustive-deps rule. Composing at the call site keeps the dependency visible.
 */

/** Test/demo affordance only. Never called from UI. */
export function __resetFlagStoreForTests(): void {
  runtimeFlags.clear();
  counter = 0;
  emit();
}
