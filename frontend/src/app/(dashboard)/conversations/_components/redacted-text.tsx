import React from 'react';

/**
 * §10.1 "Full transcript with speaker labels and PII redaction markers."
 *
 * Renders a transcript turn's text with its redacted character ranges shown as visible
 * redaction markers (e.g. `[name redacted]`). The ranges are `{start, end, kind}` offsets
 * into `text` (see schema `TranscriptTurn`), and every visible span is produced by
 * `String.prototype.slice` and rendered as plain React text nodes — no raw-HTML injection
 * API is used anywhere in this path, so the stored transcript can never inject markup.
 */

export interface Redaction {
  readonly start: number;
  readonly end: number;
  readonly kind: string;
}

type Segment =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'redaction'; readonly label: string };

/** Split `text` into ordered plain/redacted segments using the redaction ranges. */
export function toSegments(text: string, redactions: readonly Redaction[]): readonly Segment[] {
  // Sort by start and clamp to valid, non-overlapping ranges so slice() is always safe.
  const ranges = [...redactions]
    .filter((r) => r.start >= 0 && r.end > r.start && r.start < text.length)
    .map((r) => ({ ...r, end: Math.min(r.end, text.length) }))
    .sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const r of ranges) {
    // Skip any range that overlaps one already consumed.
    if (r.start < cursor) continue;
    if (r.start > cursor) {
      segments.push({ kind: 'text', value: text.slice(cursor, r.start) });
    }
    segments.push({ kind: 'redaction', label: `${r.kind} redacted` });
    cursor = r.end;
  }

  if (cursor < text.length) {
    segments.push({ kind: 'text', value: text.slice(cursor) });
  }

  return segments;
}

export function RedactedText({
  text,
  redactions,
}: {
  text: string;
  redactions: readonly Redaction[];
}): React.JSX.Element {
  const segments = toSegments(text, redactions);
  return (
    <>
      {segments.map((seg, i) =>
        seg.kind === 'text' ? (
          <React.Fragment key={i}>{seg.value}</React.Fragment>
        ) : (
          <span
            key={i}
            className="mx-0.5 rounded-sm bg-muted px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            [{seg.label}]
          </span>
        ),
      )}
    </>
  );
}
