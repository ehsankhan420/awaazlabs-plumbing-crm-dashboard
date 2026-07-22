/**
 * §5.6 AI RECEPTIONIST — display constants for the categorical dimensions that have no
 * entry in the frozen `series-map.ts` (intake outcome, customer language). Color bindings
 * live here as single module-level lookups keyed by entity — the "color follows the
 * entity, never its rank / never inline" rule. They reference only approved tokens; no
 * literal color appears.
 *
 * All actual numbers come from the data adapter (`fetchLiveReceptionistStats`, via
 * `useLiveReceptionist`) — this file holds no computation over interaction data.
 */

import type { CallDisposition, Language } from '@/shared/status-models';

/** §5.6 outcome distribution: the five spec outcomes, in the spec's order. */
export const RECEPTIONIST_OUTCOMES = [
  'job_created',
  'information_provided',
  'human_transfer',
  'emergency_escalation',
  'out_of_service_area',
] as const satisfies readonly CallDisposition[];

export type ReceptionistOutcome = (typeof RECEPTIONIST_OUTCOMES)[number];

export const RECEPTIONIST_OUTCOME_SERIES: Readonly<Record<ReceptionistOutcome, string>> = {
  job_created: 'var(--chart-1)',
  information_provided: 'var(--chart-2)',
  human_transfer: 'var(--chart-3)',
  // Emergency escalation carries a genuine severity meaning, so it takes the reserved token.
  emergency_escalation: 'hsl(var(--destructive))',
  out_of_service_area: 'hsl(var(--muted-foreground))',
};

export const LANGUAGE_SERIES: Readonly<Record<Language, string>> = {
  en: 'var(--chart-1)',
  es: 'var(--chart-5)',
  other: 'hsl(var(--muted-foreground))',
};
