'use client';

/**
 * §5.5 Dispatch Queue table. Columns in the spec's order: selection, Job and Customer,
 * Issue or Job Type, Required Specialty, Service Area, Priority, Requested Service
 * Window, Assignment Status, Current Candidate, Queue Age, Last Attempt, Attempts, and
 * Business Location.
 *
 * §5.5 aging presentation: neutral before threshold, amber when approaching, red when
 * exceeded or Exhausted — always icon + text, never color alone (via AgingBadge).
 *
 * The leading checkbox column (bulk retry selection) renders only when the session may
 * perform workflow actions — a Viewer never sees it.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { AgingBadge } from '@/components/ui/aging-badge';
import { Button } from '@/components/ui/button';
import { AssignmentStatusChip, PriorityChip } from '@/components/ui/status-chip';
import { RowOpenButton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SPECIALTY_LABELS } from '@/shared/status-models';
import type { DispatchRowVM } from './types';

const PAGE_SIZE = 15;

export function DispatchTable({
  rows,
  canAct,
  selectedIds,
  onToggle,
  onToggleAll,
  onOpenRow,
  showLocation,
  pageResetKey,
}: {
  rows: readonly DispatchRowVM[];
  canAct: boolean;
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpenRow: (id: string) => void;
  showLocation: boolean;
  /** Changes when filters change — resets pagination. */
  pageResetKey: string;
}) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [pageResetKey]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  useEffect(() => {
    setPage((p) => Math.min(p, pageCount));
  }, [pageCount]);

  const current = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    [rows, current],
  );

  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.record.id));

  return (
    <div className="flex flex-col gap-3">
      <Table caption="Dispatch Queue — plumber assignment worklist">
        <TableHeader>
          <TableRow>
            {canAct ? (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all filtered rows"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="h-4 w-4 rounded border-input"
                />
              </TableHead>
            ) : null}
            <TableHead>Job &amp; Customer</TableHead>
            <TableHead>Issue / Job Type</TableHead>
            <TableHead>Required Specialty</TableHead>
            <TableHead>Service Area</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Requested Window</TableHead>
            <TableHead>Assignment Status</TableHead>
            <TableHead>Current Candidate</TableHead>
            <TableHead>Queue Age</TableHead>
            <TableHead>Last Attempt</TableHead>
            <TableHead className="text-right">Attempts</TableHead>
            {showLocation ? <TableHead>Business Location</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((r) => (
            <TableRow key={r.record.id} onClick={() => onOpenRow(r.record.id)}>
              {canAct ? (
                <TableCell>
                  <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                    <input
                      type="checkbox"
                      aria-label={`Select dispatch for ${r.customerName}`}
                      checked={selectedIds.has(r.record.id)}
                      onChange={() => onToggle(r.record.id)}
                      className="h-4 w-4 rounded border-input"
                    />
                  </span>
                </TableCell>
              ) : null}
              <TableCell>
                <RowOpenButton
                  onClick={() => onOpenRow(r.record.id)}
                  ariaLabel={`Open dispatch record ${r.jobReference} for ${r.customerName}`}
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{r.customerName}</span>
                    <span className="text-xs text-muted-foreground">{r.jobReference}</span>
                  </span>
                </RowOpenButton>
              </TableCell>
              <TableCell>{r.issueJobType}</TableCell>
              <TableCell className="whitespace-nowrap">{SPECIALTY_LABELS[r.record.requiredSpecialty]}</TableCell>
              <TableCell className="whitespace-nowrap">{r.serviceAreaName}</TableCell>
              <TableCell>
                <PriorityChip priority={r.priority} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{r.requestedWindowLabel}</TableCell>
              <TableCell>
                <AssignmentStatusChip status={r.effectiveStatus} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {r.effectiveCandidateName ?? '—'}
              </TableCell>
              <TableCell>
                <AgingBadge level={r.agingLevel} minutes={r.ageMinutes} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{r.lastAttempt}</TableCell>
              <TableCell className="text-right tabular-nums">{r.attemptsCount}</TableCell>
              {showLocation ? <TableCell className="text-muted-foreground">{r.locationName}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {rows.length === 0
            ? 'No matching dispatch records'
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
