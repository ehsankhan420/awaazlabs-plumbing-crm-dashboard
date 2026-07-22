/**
 * series-map.ts — the single place that binds a data ENTITY to a color.
 *
 * THEME_NOTES.md §3: "Color follows the entity, not its rank." Filtering a series out must
 * never repaint the survivors, so every binding here is a fixed lookup keyed by the entity,
 * assigned in slot order once and never cycled. Voice is always `--chart-1`, Web Chat always
 * `--chart-2`, etc. — regardless of which series are visible.
 *
 * Every value is a CSS custom-property reference (`var(--chart-n)`) or a documented chrome
 * token (`hsl(var(--…))`). No literal color appears here. Status tokens
 * (`--destructive` / `--status-warning`) are used ONLY where the entity carries a genuine
 * good/bad meaning; categorical series never borrow them.
 */

import type {
  AssignmentStatus,
  ChatChannel,
  IntakeChannel,
  JobPriority,
} from '@/shared/status-models';

/* ----------------------------------------------------------------------------------------
 * Intake channels — §5.1 jobs-created-over-time (stacked by intake channel), §5.2 column
 * -------------------------------------------------------------------------------------- */

/** Fixed slot order for the five §5.1 chart series. */
export const INTAKE_CHANNEL_SERIES: Readonly<Record<IntakeChannel, string>> = {
  voice: 'var(--chart-1)',
  web_chat: 'var(--chart-2)',
  sms: 'var(--chart-3)',
  whatsapp: 'var(--chart-4)',
  staff_entry: 'var(--chart-5)',
};

/* ----------------------------------------------------------------------------------------
 * Chat channels — Chats tab sessions split by channel
 * -------------------------------------------------------------------------------------- */

/** Same hues as INTAKE_CHANNEL_SERIES: each channel keeps its identity across tabs. */
export const CHAT_CHANNEL_SERIES: Readonly<Record<ChatChannel, string>> = {
  web_chat: 'var(--chart-2)',
  sms: 'var(--chart-3)',
  whatsapp: 'var(--chart-4)',
};

/* ----------------------------------------------------------------------------------------
 * Chat performance metrics — grouped bars on the Chat Agents tab
 * -------------------------------------------------------------------------------------- */

export const CHAT_METRICS = ['containment', 'resolution', 'deflection', 'escalation'] as const;
export type ChatMetric = (typeof CHAT_METRICS)[number];

export const CHAT_METRIC_SERIES: Readonly<Record<ChatMetric, string>> = {
  containment: 'var(--chart-1)',
  resolution: 'var(--chart-2)',
  deflection: 'var(--chart-3)',
  escalation: 'var(--chart-4)',
};

/* ----------------------------------------------------------------------------------------
 * Attributed vs organic reviews — Reviews tab stacked bars
 * -------------------------------------------------------------------------------------- */

export const REVIEW_ATTRIBUTION = ['attributed', 'organic'] as const;
export type ReviewAttribution = (typeof REVIEW_ATTRIBUTION)[number];

export const REVIEW_ATTRIBUTION_SERIES: Readonly<Record<ReviewAttribution, string>> = {
  attributed: 'var(--chart-1)',
  organic: 'hsl(var(--muted-foreground))',
};

/* ----------------------------------------------------------------------------------------
 * Job priority — §3.4 (amber on Urgent, red on Emergency)
 * -------------------------------------------------------------------------------------- */

/**
 * Priority is an ordinal SEVERITY, not a categorical set — the "means good/bad" case.
 * Routine recedes into a chrome neutral; Urgent escalates to amber and Emergency to red,
 * exactly matching the spec's chip presentation. These status tokens carry a real status
 * here, so the "reserved" rule is honored, not broken.
 *
 * NOTE ON TOKEN FORM: `--destructive` is stored as a bare HSL triple like every base UI
 * token, so it must be wrapped: `hsl(var(--destructive))`. The chart and status tokens
 * (`--chart-*`, `--seq-*`, `--status-warning`) are stored as complete color values and are
 * used bare. Getting this wrong yields an invalid SVG `fill` that silently paints black.
 */
export const PRIORITY_SERIES: Readonly<Record<JobPriority, string>> = {
  routine: 'hsl(var(--muted-foreground))',
  urgent: 'var(--status-warning)',
  emergency: 'hsl(var(--destructive))',
};

/* ----------------------------------------------------------------------------------------
 * Assignment status — §5.1 dispatch distribution
 *
 * "Unassigned, Matching, Contacting, Awaiting Response, Accepted, Exhausted."
 * Accepted is the success outcome; Exhausted is the red-accented exception state that
 * feeds the attention banner. The four active states take categorical tokens.
 * -------------------------------------------------------------------------------------- */

export const DISPATCH_DISTRIBUTION_STATUSES = [
  'unassigned',
  'matching',
  'contacting',
  'awaiting_response',
  'accepted',
  'exhausted',
] as const satisfies readonly AssignmentStatus[];

export const ASSIGNMENT_STATUS_SERIES: Readonly<Record<AssignmentStatus, string>> = {
  unassigned: 'hsl(var(--muted-foreground))',
  matching: 'var(--chart-1)',
  contacting: 'var(--chart-2)',
  awaiting_response: 'var(--chart-3)',
  accepted: 'var(--chart-4)',
  manually_assigned: 'var(--chart-5)',
  // `hsl(...)` wrapper is required — see the note on PRIORITY_SERIES above.
  exhausted: 'hsl(var(--destructive))',
};
