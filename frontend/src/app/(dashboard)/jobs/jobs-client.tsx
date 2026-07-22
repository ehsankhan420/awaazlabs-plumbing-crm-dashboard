'use client';

/**
 * §5.2 Jobs — the master operational record, from intake through assignment, service,
 * and completion. Five-card statistics strip, search and filter card, All Jobs / Needs
 * Attention scope control, Table and Calendar tabs, paginated table, export control, and
 * the right-side detail drawer with outcome actions, notes, timeline, and flag-for-review.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Wrench } from 'lucide-react';

import { Banner } from '@/components/ui/banner';
import { ExportCsvButton, ListExportRow } from '@/components/ui/export-csv-button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { DataTableSkeleton, StatGridSkeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime, formatPercent, timezoneFor } from '@/lib/format';
import { useLiveJobs } from '@/hooks/use-dashboard-live';
import {
  addLiveJobNote,
  recordLiveCustomerSearch,
  updateLiveJobStatus,
  type JobStatsDto,
} from '@/lib/dashboard-live';
import { isMultiLocation } from '@/mock/schema';
import { getFixture } from '@/mock/fixtures';
import { submitFlag } from '@/shared/flag-store';
import type { GatedRows, JobView } from '@/mock/data-access';
import { canExport } from '@/mock/data-access';
import { useSession } from '@/shared/session-context';
import { buildJobsCsv } from '@/app/(dashboard)/reports/csv';
import { filtersToParams, runCsvExport } from '@/lib/csv-export';
import type { JobStatus } from '@/shared/status-models';

import { JobDrawer } from './job-drawer';
import { JobsCalendar } from './jobs-calendar';
import { JobsFilters } from './jobs-filters';
import { JobsTable } from './jobs-table';
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  PRIORITY_ORDER,
  effectiveWindow,
  localDateKey,
  type JobFilters,
  type SortState,
} from './types';

type LocalNote = { readonly at: string; readonly author: string; readonly body: string };

const EMPTY_STATS: JobStatsDto = {
  createdToday: 0,
  createdSameWeekdayLastWeek: 0,
  createdThisWeek: 0,
  jobCreationRateThisWeek: null,
  scheduledNext7Days: 0,
  completedThisWeek: 0,
  canceledThisWeek: 0,
  completionRateThisWeek: null,
  completionRate30d: null,
  assignmentRate: null,
  nextScheduledJob: null,
};

const EMPTY_GATED_JOBS: GatedRows<JobView> = { kind: 'rows', rows: [] };

/** §5.2 header KPI cards, in the spec's order. */
function HeaderStats({ stats, tz }: { stats: JobStatsDto; tz: string }) {
  const pct = (v: number | null) => (v === null ? '—' : formatPercent(v));
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Created today" value={stats.createdToday} format="number" />
      <StatCard label="Scheduled next 7 days" value={stats.scheduledNext7Days} format="number" />
      <StatCard
        label="Assignment rate"
        value={pct(stats.assignmentRate)}
        format="text"
        tooltip="Accepted and Manually Assigned jobs divided by jobs that entered dispatch, trailing 30 days."
      />
      <StatCard
        label="Completion rate (30 days)"
        value={pct(stats.completionRate30d)}
        format="text"
        tooltip="Completed jobs divided by all non-canceled jobs created in the trailing 30 days. Canceled jobs are excluded from the denominator."
      />
      <StatCard
        label="Next scheduled job"
        value={stats.nextScheduledJob ? formatDateTime(stats.nextScheduledJob.startsAtUtc, tz) : 'None'}
        format="text"
        subStats={stats.nextScheduledJob ? [{ label: 'Customer', value: stats.nextScheduledJob.customerName }] : []}
        tooltip="The start of the next confirmed arrival window and the customer it belongs to."
      />
    </div>
  );
}

export function JobsClient() {
  const { session, org } = useSession();
  const searchParams = useSearchParams();
  const deepLinkJobId = searchParams.get('jobId');
  const tz = session.locationId ? timezoneFor(session.orgId, session.locationId) : org.locations[0]?.timezone ?? 'UTC';

  const { data: live, isLoading: loadingLive, error: liveError, invalidate } = useLiveJobs();

  const stats = live?.stats ?? EMPTY_STATS;
  const gated: GatedRows<JobView> = live?.gated ?? EMPTY_GATED_JOBS;

  const plumbers = useMemo(() => getFixture(session.orgId).plumbers, [session.orgId]);

  const [filters, setFilters] = useState<JobFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [view, setView] = useState<'table' | 'calendar'>('table');
  const [scope, setScope] = useState<'all' | 'attention'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Local optimistic overlays for §5.2 outcome actions. The data adapter is the source of
  // record; these make the change visible before the next refresh.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, JobStatus>>({});
  const [notesByJob, setNotesByJob] = useState<Record<string, readonly LocalNote[]>>({});
  const [flagged, setFlagged] = useState<ReadonlySet<string>>(new Set());

  // Customer search is audited: debounce keystrokes; the recorder no-ops on empty input.
  useEffect(() => {
    const q = filters.search;
    const t = setTimeout(() => {
      if (q.trim()) void recordLiveCustomerSearch(session, q).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [filters.search, session]);

  const baseRows = useMemo<readonly JobView[]>(() => (gated.kind === 'rows' ? gated.rows : []), [gated]);

  const enrichedRows = useMemo<readonly JobView[]>(
    () =>
      baseRows.map((job) => {
        const override = statusOverrides[job.id];
        const extra = notesByJob[job.id];
        if (!override && !extra) return job;
        return {
          ...job,
          status: override ?? job.status,
          staffNotes: extra ? [...job.staffNotes, ...extra] : job.staffNotes,
        };
      }),
    [baseRows, statusOverrides, notesByJob],
  );

  // §5.2 scope control: Needs Attention = Ready for Dispatch without active dispatch,
  // exhausted dispatches, overdue scheduled jobs, emergencies without acknowledgement.
  const scopedRows = useMemo<readonly JobView[]>(
    () => (scope === 'all' ? enrichedRows : enrichedRows.filter((j) => j.needsAttention === true)),
    [enrichedRows, scope],
  );

  const filtered = useMemo<readonly JobView[]>(() => {
    const q = filters.search.trim().toLowerCase();
    return scopedRows.filter((job) => {
      if (filters.status !== 'all' && job.status !== filters.status) return false;
      if (filters.assignmentStatus !== 'all') {
        if (filters.assignmentStatus === 'none') {
          if (job.dispatch) return false;
        } else if (job.dispatch?.status !== filters.assignmentStatus) {
          return false;
        }
      }
      if (filters.priority !== 'all' && job.priority !== filters.priority) return false;
      if (filters.issueType !== 'all' && job.issueType !== filters.issueType) return false;
      if (filters.intakeChannel !== 'all' && job.intakeChannel !== filters.intakeChannel) return false;
      if (filters.requiredSpecialty !== 'all' && job.requiredSpecialty !== filters.requiredSpecialty) return false;
      if (filters.assignedPlumberId !== 'all' && job.assignedPlumberId !== filters.assignedPlumberId) return false;
      if (filters.serviceAreaId !== 'all' && job.serviceAreaId !== filters.serviceAreaId) return false;
      if (filters.locationId !== 'all' && job.locationId !== filters.locationId) return false;
      if (filters.language !== 'all' && job.language !== filters.language) return false;

      if (filters.dateFrom || filters.dateTo) {
        const key = localDateKey(job.createdAtUtc, timezoneFor(session.orgId, job.locationId));
        if (filters.dateFrom && key < filters.dateFrom) return false;
        if (filters.dateTo && key > filters.dateTo) return false;
      }

      if (q) {
        const id = job.contact.identity;
        const hay = [
          id ? `${id.firstName} ${id.lastName}` : '',
          id?.phoneMasked ?? '',
          id?.phoneE164 ?? '',
          job.reference,
          job.contact.zip,
          job.contact.serviceAddress,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [scopedRows, filters, session.orgId]);

  const sorted = useMemo<readonly JobView[]>(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sort.key) {
        case 'created':
          return (new Date(a.createdAtUtc).getTime() - new Date(b.createdAtUtc).getTime()) * dir;
        case 'window': {
          const aw = effectiveWindow(a)?.window.startUtc ?? '';
          const bw = effectiveWindow(b)?.window.startUtc ?? '';
          return aw.localeCompare(bw) * dir;
        }
        case 'name': {
          const an = a.contact.identity ? `${a.contact.identity.lastName} ${a.contact.identity.firstName}` : '';
          const bn = b.contact.identity ? `${b.contact.identity.lastName} ${b.contact.identity.firstName}` : '';
          return an.localeCompare(bn) * dir;
        }
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'priority':
          return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) * dir;
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sort]);

  const selected = selectedId ? enrichedRows.find((j) => j.id === selectedId) ?? null : null;

  useEffect(() => {
    if (!deepLinkJobId) return;
    if (enrichedRows.some((job) => job.id === deepLinkJobId)) {
      setSelectedId(deepLinkJobId);
    }
  }, [deepLinkJobId, enrichedRows]);

  const handleStatusChange = (to: JobStatus) => {
    if (!selected) return;
    setStatusOverrides((prev) => ({ ...prev, [selected.id]: to }));
    void updateLiveJobStatus(session, selected.id, to)
      .then(() => invalidate())
      .catch(() => {
        setStatusOverrides((prev) => {
          const next = { ...prev };
          delete next[selected.id];
          return next;
        });
      });
  };

  const handleAddNote = (body: string) => {
    if (!selected) return;
    void addLiveJobNote(session, selected.id, body).then(() => invalidate()).catch(() => undefined);
    setNotesByJob((prev) => ({
      ...prev,
      [selected.id]: [...(prev[selected.id] ?? []), { at: new Date().toISOString(), author: session.actor, body }],
    }));
  };

  /** §5.2 Flag for Review flags the *originating interaction*, feeding the Quality inbox. */
  const handleFlag = (reason: string, context: string) => {
    if (!selected?.originatingInteractionId) return;

    submitFlag({
      orgId: session.orgId,
      interactionId: selected.originatingInteractionId,
      submittedBy: session.actor,
      reason: context.trim() ? `${reason}: ${context.trim()}` : reason,
    });

    setFlagged((prev) => {
      const next = new Set(prev);
      next.add(selected.id);
      return next;
    });
  };

  const showLocation = isMultiLocation(org);

  const pageResetKey = useMemo(() => JSON.stringify({ filters, sort, scope }), [filters, sort, scope]);
  const canExportRows = canExport(session);

  const exportFilterParams = useMemo(
    () =>
      filtersToParams({
        search: filters.search,
        status: filters.status,
        assignmentStatus: filters.assignmentStatus,
        priority: filters.priority,
        issueType: filters.issueType,
        intakeChannel: filters.intakeChannel,
        requiredSpecialty: filters.requiredSpecialty,
        assignedPlumberId: filters.assignedPlumberId,
        serviceAreaId: filters.serviceAreaId,
        locationId: filters.locationId,
        language: filters.language,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        scope,
      }),
    [filters, scope],
  );

  const handleExport = useCallback(() => {
    void runCsvExport(
      session,
      'jobs',
      sorted.length,
      exportFilterParams,
      `jobs-${new Date().toISOString().slice(0, 10)}.csv`,
      buildJobsCsv(sorted, session.orgId),
    ).then(setExportError);
  }, [session, sorted, exportFilterParams]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Jobs"
        description="The complete record of customer work, from intake through assignment, service, and completion."
      />

      {liveError ? (
        <Banner variant="destructive" title="Job data is temporarily unavailable">
          {liveError}
        </Banner>
      ) : null}

      {exportError ? (
        <Banner variant="destructive" title="Export failed" onDismiss={() => setExportError(null)}>
          {exportError}
        </Banner>
      ) : null}

      {loadingLive && live === null ? (
        <>
          <span role="status" className="sr-only">
            Loading job data
          </span>
          <StatGridSkeleton cards={5} />
          <DataTableSkeleton rows={8} />
        </>
      ) : (
        <>
          <HeaderStats stats={stats} tz={tz} />

          {baseRows.length === 0 ? (
            // §5.2 first-use empty state.
            <EmptyState
              icon={<Wrench className="h-8 w-8" />}
              title="No jobs yet"
              description="New jobs created by the AI Receptionist, Chat Agent, or a team member will appear here."
            />
          ) : (
            <div className="flex flex-col gap-4">
              <JobsFilters
                filters={filters}
                onChange={setFilters}
                locations={org.locations}
                serviceAreas={org.serviceAreas}
                plumbers={plumbers}
                showLocationFilter={showLocation}
              />

              <Tabs value={view} onValueChange={(v) => setView(v === 'calendar' ? 'calendar' : 'table')}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* §5.2 scope control: two compact scope buttons above the view tabs. */}
                  <div className="inline-flex rounded-lg border border-border bg-muted p-1">
                    <button
                      type="button"
                      onClick={() => setScope('all')}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                        scope === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                      }`}
                    >
                      All Jobs
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope('attention')}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                        scope === 'attention' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                      }`}
                    >
                      Needs Attention
                    </button>
                  </div>
                  <TabsList label="Jobs view">
                    <TabsTrigger value="table">Table</TabsTrigger>
                    <TabsTrigger value="calendar">Calendar</TabsTrigger>
                  </TabsList>
                </div>

                {canExportRows ? (
                  <ListExportRow>
                    <ExportCsvButton onClick={handleExport} disabled={sorted.length === 0} />
                  </ListExportRow>
                ) : null}

                <TabsContent value="table" className="mt-4">
                  {sorted.length === 0 ? (
                    <EmptyState
                      title="No jobs match these filters"
                      description="Adjust the date, status, assignment, priority, or search filters."
                    />
                  ) : (
                    <JobsTable
                      rows={sorted}
                      session={session}
                      sort={sort}
                      onSortChange={setSort}
                      onRowClick={setSelectedId}
                      showLocation={showLocation}
                      pageResetKey={pageResetKey}
                    />
                  )}
                </TabsContent>

                <TabsContent value="calendar" className="mt-4">
                  <JobsCalendar rows={sorted} session={session} onRowClick={setSelectedId} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </>
      )}

      {selected ? (
        <JobDrawer
          job={selected}
          session={session}
          flagged={flagged.has(selected.id)}
          onStatusChange={handleStatusChange}
          onAddNote={handleAddNote}
          onFlag={handleFlag}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
