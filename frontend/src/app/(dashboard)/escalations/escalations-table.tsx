'use client';

/**
 * §5.4 table. Columns in the spec's order: Created · Customer · Source · Severity ·
 * Trigger · Reason · Escalation Owner · Acknowledged · Aging · Resolution Note ·
 * Business Location.
 *
 * The detail drawer opens from the customer-name `RowOpenButton` (keyboard-reachable,
 * named). One-tap acknowledgement renders inline in the Acknowledged column only when
 * `canAck`; a Viewer sees a read-only "No".
 */

import React from 'react';
import Link from 'next/link';
import { Link as LinkIcon } from 'lucide-react';

import { AgingBadge } from '@/components/ui/aging-badge';
import { Button } from '@/components/ui/button';
import { SeverityChip } from '@/components/ui/status-chip';
import { RowOpenButton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { EscalationRowVM } from './types';

export function EscalationsTable({
  rows,
  canAck,
  showLocation,
  onAcknowledge,
  onOpenRow,
}: {
  rows: readonly EscalationRowVM[];
  canAck: boolean;
  showLocation: boolean;
  onAcknowledge: (id: string) => void;
  onOpenRow: (id: string) => void;
}): React.JSX.Element {
  return (
    <Table caption="Human-action escalation worklist, most recent first.">
      <TableHeader>
        <TableRow>
          <TableHead>Created</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead>Acknowledged</TableHead>
          <TableHead>Aging</TableHead>
          <TableHead>Resolution Note</TableHead>
          {showLocation ? <TableHead>Business Location</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.record.id}>
            <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
              {row.timestampLabel}
            </TableCell>
            <TableCell>
              <RowOpenButton
                onClick={() => onOpenRow(row.record.id)}
                ariaLabel={`Open escalation ${row.record.reference} for ${row.customerName}`}
              >
                {row.customerName}
              </RowOpenButton>
            </TableCell>
            <TableCell>
              {row.source ? (
                <Link
                  href={row.source.href}
                  className="inline-flex items-center gap-1 text-foreground underline underline-offset-2 hover:no-underline"
                >
                  <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {row.source.label}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              <SeverityChip severity={row.severity} />
            </TableCell>
            <TableCell>{row.triggerLabel}</TableCell>
            <TableCell className="max-w-[16rem]">
              <span className="line-clamp-2 text-sm text-foreground">{row.record.reason}</span>
            </TableCell>
            <TableCell className="text-muted-foreground">{row.owner ?? '—'}</TableCell>
            <TableCell>
              {row.acknowledgedAtUtc ? (
                <span className="text-sm text-foreground">
                  <span className="font-medium">Yes</span>
                  <span className="text-muted-foreground">
                    {' · '}
                    {row.ackTimestampLabel}
                    {row.acknowledgedBy ? ` · ${row.acknowledgedBy}` : ''}
                  </span>
                </span>
              ) : canAck ? (
                <Button size="sm" onClick={() => onAcknowledge(row.record.id)}>
                  Acknowledge
                </Button>
              ) : (
                <span className="text-muted-foreground">No</span>
              )}
            </TableCell>
            <TableCell>
              {row.pastThreshold ? (
                <AgingBadge level="red" minutes={row.ageMinutes} label="past threshold" />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              {row.resolutionNote ? (
                <span className="line-clamp-2 text-sm text-foreground">{row.resolutionNote}</span>
              ) : canAck ? (
                <Button variant="outline" size="sm" onClick={() => onOpenRow(row.record.id)}>
                  Add note
                </Button>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            {showLocation ? <TableCell className="text-muted-foreground">{row.locationName}</TableCell> : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
