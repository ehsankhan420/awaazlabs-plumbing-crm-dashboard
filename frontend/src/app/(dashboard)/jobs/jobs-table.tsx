'use client';

/**
 * §5.2 Jobs table. Columns in the spec's order: Service Window, Customer, Phone,
 * Issue or Job Type, Intake Channel, Priority, Job Status, Assignment Status,
 * Assigned Plumber, Created By, Service Area, and Business Location (rendered only when
 * multiple locations exist).
 *
 * Paginated. Customer opens the drawer; phone remains masked until authorized reveal.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MaskedValue } from '@/components/ui/masked-value';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  RowOpenButton,
} from '@/components/ui/table';
import { AssignmentStatusChip, JobStatusChip, PriorityChip } from '@/components/ui/status-chip';
import { timezoneFor } from '@/lib/format';
import { getLocationById } from '@/mock/orgs';
import type { JobView, Session } from '@/mock/data-access';
import {
  INTAKE_CHANNEL_LABELS,
  ISSUE_TYPE_LABELS,
  JOB_CREATOR_LABELS,
} from '@/shared/status-models';

import { effectiveWindow, formatWindow, type SortKey, type SortState } from './types';

const PAGE_SIZE = 12;

function SortHeader({
  label,
  columnKey,
  sort,
  onSortChange,
  className,
}: {
  label: string;
  columnKey: SortKey;
  sort: SortState;
  onSortChange: (next: SortState) => void;
  className?: string;
}) {
  const active = sort.key === columnKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() =>
          onSortChange(
            active ? { key: columnKey, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: columnKey, dir: 'asc' },
          )
        }
        aria-label={`Sort by ${label}${active ? (sort.dir === 'asc' ? ', ascending' : ', descending') : ''}`}
        className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
      >
        <span>{label}</span>
        <Icon className="h-3 w-3" aria-hidden="true" />
      </button>
    </TableHead>
  );
}

export function JobsTable({
  rows,
  session,
  sort,
  onSortChange,
  onRowClick,
  showLocation,
  pageResetKey,
}: {
  rows: readonly JobView[];
  session: Session;
  sort: SortState;
  onSortChange: (next: SortState) => void;
  onRowClick: (id: string) => void;
  showLocation: boolean;
  /** Changes when filters/sort/scope change — not on live data refresh. */
  pageResetKey: string;
}) {
  const [page, setPage] = useState(1);

  // Filters or sort changing collapses the result set; return to the first page so the
  // user is never stranded on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [pageResetKey]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  // If the result set shrinks, clamp the page index without resetting on every poll.
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
        <Table caption="Jobs, one row per job, sortable and filterable.">
          <TableHeader>
            <TableRow>
              <SortHeader label="Service Window" columnKey="window" sort={sort} onSortChange={onSortChange} />
              <SortHeader label="Customer" columnKey="name" sort={sort} onSortChange={onSortChange} />
              <TableHead>Phone</TableHead>
              <TableHead>Issue / Job Type</TableHead>
              <TableHead>Intake Channel</TableHead>
              <SortHeader label="Priority" columnKey="priority" sort={sort} onSortChange={onSortChange} />
              <SortHeader label="Job Status" columnKey="status" sort={sort} onSortChange={onSortChange} />
              <TableHead>Assignment</TableHead>
              <TableHead>Assigned Plumber</TableHead>
              <SortHeader label="Created By" columnKey="created" sort={sort} onSortChange={onSortChange} />
              <TableHead>Service Area</TableHead>
              {showLocation ? <TableHead>Business Location</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((job) => {
              const tz = timezoneFor(session.orgId, job.locationId);
              const identity = job.contact.identity;
              const name = identity ? `${identity.firstName} ${identity.lastName}` : '—';
              const window = effectiveWindow(job);
              const locationName =
                job.locationName ?? getLocationById(session.orgId, job.locationId)?.name ?? job.locationId;

              return (
                // §4.9: the whole row opens the drawer. `TableRow` supplies focus,
                // role="button", and Enter/Space activation.
                <TableRow key={job.id} onClick={() => onRowClick(job.id)}>
                  <TableCell className="whitespace-nowrap">
                    <RowOpenButton onClick={() => onRowClick(job.id)} ariaLabel={`Open job details for ${name}`}>
                      {window ? (
                        <span className="flex flex-col">
                          <span>{formatWindow(window.window, tz)}</span>
                          <span className="text-xs text-muted-foreground">
                            {window.kind === 'scheduled' ? 'Scheduled arrival' : 'Requested window'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No window yet</span>
                      )}
                    </RowOpenButton>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {identity ? (
                      <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                        <MaskedValue identity={identity} session={session} objectRef={`job:${job.id}`} />
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{ISSUE_TYPE_LABELS[job.issueType]}</span>
                      <span className="text-xs text-muted-foreground">{job.jobType}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{INTAKE_CHANNEL_LABELS[job.intakeChannel]}</TableCell>
                  <TableCell>
                    <PriorityChip priority={job.priority} />
                  </TableCell>
                  <TableCell>
                    <JobStatusChip status={job.status} />
                  </TableCell>
                  <TableCell>
                    {job.dispatch ? (
                      <AssignmentStatusChip status={job.dispatch.status} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {job.assignedPlumberName ?? <span className="text-muted-foreground">Unassigned</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{JOB_CREATOR_LABELS[job.createdBy]}</TableCell>
                  <TableCell className="whitespace-nowrap">{job.serviceAreaName ?? job.serviceAreaId}</TableCell>
                  {showLocation ? <TableCell className="whitespace-nowrap">{locationName}</TableCell> : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {rows.length === 0
            ? 'No matching jobs'
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
