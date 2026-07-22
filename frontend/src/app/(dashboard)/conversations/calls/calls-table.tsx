'use client';

/**
 * §5.3 Calls table. Columns in the spec's order: Timestamp · Direction · Agent ·
 * Party Type · Customer or Plumber · Phone · Duration · Disposition · Priority ·
 * QA Grade · Linked Record · Business Location.
 *
 * Party Type is Customer or Plumber. Linked Record displays Job, Dispatch, Escalation,
 * Review, Campaign, or a dash. Paginated for a dense list. Row click opens the detail
 * drawer; the phone cell stops propagation so the masked-reveal control is independent.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MaskedValue } from '@/components/ui/masked-value';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, RowOpenButton } from '@/components/ui/table';
import { CallDispositionChip, PriorityChip } from '@/components/ui/status-chip';
import { formatDateTime, formatDuration, timezoneFor } from '@/lib/format';
import type { CallInteractionView, Session } from '@/mock/data-access';
import { AGENT_LABELS, PARTY_TYPE_LABELS } from '@/shared/status-models';

const PAGE_SIZE = 15;

/** §5.3 Linked Record: Job, Dispatch, Escalation, Review, Campaign, or a dash. */
function linkedRecord(call: CallInteractionView): { label: string; href: string } | null {
  if (call.linked.jobId) return { label: 'Job', href: `/jobs?jobId=${call.linked.jobId}` };
  if (call.linked.dispatchId) return { label: 'Dispatch', href: `/dispatch-queue?dispatchId=${call.linked.dispatchId}` };
  if (call.linked.escalationId) return { label: 'Escalation', href: `/escalations?escalationId=${call.linked.escalationId}` };
  if (call.linked.reviewRequestId) return { label: 'Review', href: '/reviews' };
  if (call.linked.campaignId) return { label: 'Campaign', href: '/campaigns' };
  return null;
}

export function partyName(call: CallInteractionView): string {
  if (call.partyType === 'plumber') return call.plumber?.name ?? 'Plumber';
  const identity = call.contact?.identity ?? null;
  return identity ? `${identity.firstName} ${identity.lastName}` : '—';
}

export function CallsTable({
  rows,
  session,
  showLocation,
  onRowClick,
  pageResetKey,
}: {
  rows: readonly CallInteractionView[];
  session: Session;
  showLocation: boolean;
  onRowClick: (id: string) => void;
  /** Changes when filters/sort change — resets pagination. Omit for a stable key. */
  pageResetKey: string;
}): React.JSX.Element {
  const [page, setPage] = useState(1);

  // Reset only when the user changes filters — not when live polling refreshes row data.
  useEffect(() => {
    setPage(1);
  }, [pageResetKey]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  // If the result set shrinks, clamp so we are not stranded past the last page.
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount));
  }, [pageCount]);
  const current = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    [rows, current],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-card">
        <Table caption="Calls, one row per call, newest first.">
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Customer / Plumber</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Disposition</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>QA Grade</TableHead>
              <TableHead>Linked Record</TableHead>
              {showLocation ? <TableHead>Business Location</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((call) => {
              const tz = timezoneFor(session.orgId, call.locationId);
              const identity = call.contact?.identity ?? null;
              const name = partyName(call);
              const linked = linkedRecord(call);

              return (
                <TableRow key={call.id} onClick={() => onRowClick(call.id)}>
                  <TableCell className="whitespace-nowrap">
                    <RowOpenButton onClick={() => onRowClick(call.id)} ariaLabel={`Open call details for ${name}`}>
                      {formatDateTime(call.atUtc, tz)}
                    </RowOpenButton>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {call.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{AGENT_LABELS[call.agent]}</TableCell>
                  <TableCell className="whitespace-nowrap">{PARTY_TYPE_LABELS[call.partyType]}</TableCell>
                  <TableCell className="whitespace-nowrap">{name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {identity ? (
                      <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                        <MaskedValue identity={identity} session={session} objectRef={`interaction:${call.id}`} />
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatDuration(call.durationSeconds)}</TableCell>
                  <TableCell>
                    <CallDispositionChip status={call.disposition} />
                  </TableCell>
                  <TableCell>
                    <PriorityChip priority={call.priority} />
                  </TableCell>
                  <TableCell>
                    {call.grade ? (
                      <Badge variant="outline">
                        <span className="tabular-nums">{call.grade.overall}</span>
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {linked ? (
                      <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                        <Link
                          href={linked.href}
                          className="text-foreground underline underline-offset-2 hover:no-underline"
                          aria-label={`Open linked ${linked.label.toLowerCase()} for ${name}`}
                        >
                          {linked.label}
                        </Link>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  {showLocation ? (
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {call.locationName ?? call.locationId}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {rows.length === 0
            ? 'No matching calls'
            : `Showing ${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, rows.length)} of ${rows.length}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="tabular-nums">
            Page {current} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={current >= pageCount}
            onClick={() => setPage(current + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
