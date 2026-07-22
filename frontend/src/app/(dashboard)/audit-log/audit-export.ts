/**
 * §16.2 Audit Log CSV export.
 *
 * "Export available; the export action itself writes an audit event." The audit row is
 * written by `recordClientExport` (real `audit_events` table) in the client BEFORE this
 * builder runs, so exporting the audit log appends a new `export` row to the audit log —
 * that is the requirement, not a bug.
 *
 * The environment columns (IP, user agent) are rendered exactly as stored. For the 9 event
 * types backed by the real backend they're the actual request IP/user-agent; for the 3
 * still-mock event types (permission/consent/knowledge change) they're honest placeholders,
 * since a frontend-only write genuinely cannot know them. Nothing is fabricated here.
 */

import { formatUtcAndLocal, timezoneFor } from '@/lib/format';
import { AUDIT_EVENT_TYPE_LABELS, type AuditEvent } from '@/shared/audit';
import { ROLE_LABELS } from '@/shared/status-models';

/** RFC-4180 field escaping: wrap in quotes and double any embedded quote. */
function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const COLUMNS = [
  'Timestamp (UTC)',
  'Timestamp (location)',
  'Actor',
  'Role',
  'Event type',
  'Object reference',
  'IP',
  'User agent',
  'Detail',
] as const;

function detailString(detail: AuditEvent['detail']): string {
  if (!detail) return '';
  return Object.entries(detail)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}

export function buildAuditCsv(rows: readonly AuditEvent[], orgId: string): string {
  const header = COLUMNS.map(csvField).join(',');
  const body = rows.map((e) => {
    const tz = e.locationId ? timezoneFor(orgId, e.locationId) : 'UTC';
    const { utc, local } = formatUtcAndLocal(e.timestampUtc, tz);
    return [
      utc,
      local,
      e.actor,
      ROLE_LABELS[e.role],
      AUDIT_EVENT_TYPE_LABELS[e.eventType],
      e.objectRef,
      e.ip,
      e.userAgent,
      detailString(e.detail),
    ]
      .map(csvField)
      .join(',');
  });
  return [header, ...body].join('\r\n');
}

/** Triggers a client-side Blob download. No network, no server round-trip. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
