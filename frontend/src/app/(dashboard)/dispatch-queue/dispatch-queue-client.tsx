'use client';

/**
 * §5.5 DISPATCH QUEUE — the action-oriented plumber-assignment worklist.
 *
 * It includes assignment activity, not the complete service lifecycle: assigned records
 * remain available for recent-history filtering (pick Accepted / Manually Assigned in the
 * status filter) but no longer count as active queue work, so the default view hides them.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ClipboardList, Filter, ShieldAlert, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { useLiveCalls, useLiveDispatchQueue, useLiveNotifications } from '@/hooks/use-dashboard-live';
import { formatCount, formatDateTime, timezoneFor } from '@/lib/format';
import { dispatchAgingLevel, minutesSince } from '@/lib/metrics';
import {
  addLiveDispatchNote,
  assignLiveDispatchManually,
  changeLiveDispatchCandidate,
  escalateLiveDispatch,
  markLiveDispatchExhausted,
  retryLiveDispatch,
  type DispatchStatsDto,
} from '@/lib/dashboard-live';
import { getLocationById } from '@/mock/orgs';
import { getFixture } from '@/mock/fixtures';
import {
  canExport,
  canPerformWorkflowActions,
  type CallInteractionView,
  type DispatchRecordView,
} from '@/mock/data-access';
import { recordClientExport } from '@/lib/audit-live';
import {
  isAssignmentActive,
  ISSUE_TYPE_LABELS,
  type AssignmentStatus,
} from '@/shared/status-models';
import { useSession } from '@/shared/session-context';
import { buildDispatchCsv, downloadCsv } from '@/app/(dashboard)/reports/csv';
import { formatWindow } from '@/app/(dashboard)/jobs/types';

import { DispatchDrawer } from './dispatch-drawer';
import { ExportCsvButton, ListExportRow } from '@/components/ui/export-csv-button';
import { DispatchFilters, ALL_FILTER_VALUE, type AgeFilter, type EscalationStateFilter } from './dispatch-filters';
import { DispatchTable } from './dispatch-table';
import type { DispatchOverride, DispatchRowVM } from './types';

const EMPTY_OVERRIDE: DispatchOverride = { extraTimeline: [], extraNotes: [] };
const EMPTY_STATS: DispatchStatsDto = {
  inDispatch: 0,
  byStatus: {
    unassigned: 0,
    matching: 0,
    contacting: 0,
    awaiting_response: 0,
    accepted: 0,
    manually_assigned: 0,
    exhausted: 0,
  },
  assignedToday: 0,
  assignmentRate: null,
  needsAttention: 0,
  awaitingResponse: 0,
  unassigned: 0,
};

export function DispatchQueueClient() {
  const { session, org, showLocationFilter } = useSession();

  const searchParams = useSearchParams();
  const deepLinkDispatchId = searchParams.get('dispatchId');
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(searchParams.get('filter') === 'needs-attention');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL_FILTER_VALUE);
  const [priority, setPriority] = useState<string>(ALL_FILTER_VALUE);
  const [specialty, setSpecialty] = useState<string>(ALL_FILTER_VALUE);
  const [serviceArea, setServiceArea] = useState<string>(ALL_FILTER_VALUE);
  const [age, setAge] = useState<AgeFilter>('all');
  const [candidate, setCandidate] = useState<string>(ALL_FILTER_VALUE);
  const [plumber, setPlumber] = useState<string>(ALL_FILTER_VALUE);
  const [escalationState, setEscalationState] = useState<EscalationStateFilter>('all');
  const [location, setLocation] = useState<string>(ALL_FILTER_VALUE);

  const [overrides, setOverrides] = useState<Readonly<Record<string, DispatchOverride>>>({});
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: liveQueue, isLoading, error: liveError, invalidate } = useLiveDispatchQueue();
  const { invalidate: invalidateNotifications } = useLiveNotifications();
  const { data: liveCalls } = useLiveCalls();

  const stats = liveQueue?.stats ?? EMPTY_STATS;
  const showLoading = isLoading && liveQueue === null;

  const plumbers = useMemo(() => getFixture(session.orgId).plumbers, [session.orgId]);
  const plumbersById = useMemo(() => new Map(plumbers.map((p) => [p.id, p])), [plumbers]);

  const callById = useMemo(() => {
    const map = new Map<string, CallInteractionView>();
    if (liveCalls?.gated.kind === 'rows') {
      for (const call of liveCalls.gated.rows) map.set(call.id, call);
    }
    return map;
  }, [liveCalls]);

  const resolveCall = useCallback((id: string) => callById.get(id), [callById]);

  const canAct = canPerformWorkflowActions(session);
  const canExportRows = canExport(session);

  const rows = useMemo<readonly DispatchRecordView[]>(
    () => (liveQueue?.gated.kind === 'rows' ? liveQueue.gated.rows : []),
    [liveQueue],
  );

  const allVms = useMemo<DispatchRowVM[]>(() => {
    return rows.map((record) => {
      const ov = overrides[record.id];
      const effectiveStatus = ov?.status ?? record.status;
      const effectiveCandidateId =
        ov && 'currentCandidateId' in ov && ov.currentCandidateId !== undefined
          ? ov.currentCandidateId
          : record.currentCandidateId;
      const effectivePlumberId =
        ov && 'assignedPlumberId' in ov && ov.assignedPlumberId !== undefined
          ? ov.assignedPlumberId
          : record.assignedPlumberId;
      const tz = timezoneFor(session.orgId, record.locationId);
      const job = record.job;
      const identity = record.contact.identity;
      const effectiveRecord = { ...record, status: effectiveStatus };
      return {
        record,
        effectiveStatus,
        effectiveCandidateName: effectiveCandidateId
          ? plumbersById.get(effectiveCandidateId)?.name ?? record.currentCandidateName ?? null
          : null,
        effectivePlumberName: effectivePlumberId
          ? plumbersById.get(effectivePlumberId)?.name ?? record.assignedPlumberName ?? null
          : null,
        customerName: identity ? `${identity.firstName} ${identity.lastName}` : 'Unknown customer',
        phoneMasked: identity?.phoneMasked ?? '—',
        jobReference: job?.reference ?? record.jobId,
        issueJobType: job ? `${ISSUE_TYPE_LABELS[job.issueType]} — ${job.jobType}` : '—',
        priority: job?.priority ?? 'routine',
        requestedWindowLabel: job?.requestedWindow ? formatWindow(job.requestedWindow, tz) : '—',
        ageMinutes: minutesSince(record.startedAtUtc),
        agingLevel: dispatchAgingLevel(effectiveRecord, job),
        lastAttempt:
          record.attempts.length > 0
            ? formatDateTime(record.attempts[record.attempts.length - 1].at, tz)
            : '—',
        attemptsCount: record.attempts.length,
        serviceAreaName: record.serviceAreaName ?? record.serviceAreaId,
        locationName:
          record.locationName ?? getLocationById(session.orgId, record.locationId)?.name ?? record.locationId,
        timezone: tz,
      };
    });
  }, [rows, overrides, plumbersById, session.orgId]);

  useEffect(() => {
    if (!deepLinkDispatchId) return;
    if (allVms.some((vm) => vm.record.id === deepLinkDispatchId)) {
      setOpenRowId(deepLinkDispatchId);
    }
  }, [deepLinkDispatchId, allVms]);

  const locationOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const vm of allVms) {
      const id = vm.record.locationId;
      if (!id || map.has(id)) continue;
      map.set(id, vm.locationName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allVms]);

  const showLocationFilterBar = showLocationFilter && locationOptions.length > 1;

  const candidateNames = useMemo(
    () =>
      Array.from(
        new Set(allVms.map((vm) => vm.effectiveCandidateName).filter((n): n is string => n !== null)),
      ).sort(),
    [allVms],
  );
  const plumberNames = useMemo(
    () =>
      Array.from(new Set(allVms.map((vm) => vm.effectivePlumberName).filter((n): n is string => n !== null))).sort(),
    [allVms],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allVms.filter((vm) => {
      // Default view is the active queue: assigned records show only when explicitly filtered.
      if (
        status === ALL_FILTER_VALUE &&
        (vm.effectiveStatus === 'accepted' || vm.effectiveStatus === 'manually_assigned')
      ) {
        return false;
      }

      if (needsAttentionOnly && vm.effectiveStatus !== 'exhausted' && vm.agingLevel !== 'red') return false;
      if (status !== ALL_FILTER_VALUE && vm.effectiveStatus !== status) return false;
      if (priority !== ALL_FILTER_VALUE && vm.priority !== priority) return false;
      if (specialty !== ALL_FILTER_VALUE && vm.record.requiredSpecialty !== specialty) return false;
      if (serviceArea !== ALL_FILTER_VALUE && vm.record.serviceAreaId !== serviceArea) return false;
      if (age === 'fresh' && vm.agingLevel !== 'none') return false;
      if (age === 'amber' && vm.agingLevel !== 'amber') return false;
      if (age === 'red' && vm.agingLevel !== 'red') return false;
      if (candidate !== ALL_FILTER_VALUE && vm.effectiveCandidateName !== candidate) return false;
      if (plumber !== ALL_FILTER_VALUE && vm.effectivePlumberName !== plumber) return false;
      if (escalationState === 'escalated' && !vm.record.escalationId) return false;
      if (escalationState === 'not_escalated' && vm.record.escalationId) return false;
      if (location !== ALL_FILTER_VALUE && vm.record.locationId !== location) return false;

      if (q) {
        const hay = [
          vm.customerName,
          vm.jobReference,
          vm.record.zip,
          vm.phoneMasked,
          vm.effectiveCandidateName ?? '',
          vm.effectivePlumberName ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allVms, needsAttentionOnly, status, priority, specialty, serviceArea, age, candidate, plumber, escalationState, location, search]);

  const now = () => new Date().toISOString();

  const applyOverride = useCallback((id: string, fn: (cur: DispatchOverride) => DispatchOverride) => {
    setOverrides((prev) => ({ ...prev, [id]: fn(prev[id] ?? EMPTY_OVERRIDE) }));
  }, []);

  const effectiveStatusOf = useCallback(
    (id: string): AssignmentStatus => {
      const rec = rows.find((r) => r.id === id);
      return overrides[id]?.status ?? rec?.status ?? 'unassigned';
    },
    [rows, overrides],
  );

  const afterAction = useCallback(() => {
    invalidate();
    invalidateNotifications();
  }, [invalidate, invalidateNotifications]);

  const handleRetry = useCallback(
    (id: string) => {
      if (!canAct) return;
      applyOverride(id, (cur) => ({
        ...cur,
        status: 'contacting',
        extraTimeline: [
          ...cur.extraTimeline,
          { at: now(), status: 'contacting', actor: session.actor, note: 'Outreach restarted' },
        ],
      }));
      void retryLiveDispatch(session, id)
        .then(afterAction)
        .catch(() => setActionError('Could not restart outreach. Refresh and try again.'));
    },
    [canAct, session, applyOverride, afterAction],
  );

  const handleAssignManually = useCallback(
    (id: string, plumberId: string) => {
      if (!canAct) return;
      const name = plumbersById.get(plumberId)?.name ?? 'plumber';
      applyOverride(id, (cur) => ({
        ...cur,
        status: 'manually_assigned',
        assignedPlumberId: plumberId,
        currentCandidateId: null,
        extraTimeline: [
          ...cur.extraTimeline,
          { at: now(), status: 'manually_assigned', actor: session.actor, note: `Manually assigned to ${name}` },
        ],
      }));
      setOpenRowId(null);
      void assignLiveDispatchManually(session, id, plumberId)
        .then(afterAction)
        .catch(() => setActionError('Could not assign the plumber. Refresh and try again.'));
    },
    [canAct, session, plumbersById, applyOverride, afterAction],
  );

  const handleChangeCandidate = useCallback(
    (id: string, plumberId: string) => {
      if (!canAct) return;
      const name = plumbersById.get(plumberId)?.name ?? 'plumber';
      applyOverride(id, (cur) => ({
        ...cur,
        status: 'contacting',
        currentCandidateId: plumberId,
        extraTimeline: [
          ...cur.extraTimeline,
          { at: now(), status: 'contacting', actor: session.actor, note: `Candidate changed to ${name}` },
        ],
      }));
      void changeLiveDispatchCandidate(session, id, plumberId)
        .then(afterAction)
        .catch(() => setActionError('Could not change the candidate. Refresh and try again.'));
    },
    [canAct, session, plumbersById, applyOverride, afterAction],
  );

  const handleEscalate = useCallback(
    (id: string, assignee: string) => {
      if (!canAct) return;
      applyOverride(id, (cur) => ({
        ...cur,
        extraNotes: [...cur.extraNotes, { at: now(), body: `Escalated to ${assignee} for manual handling.` }],
        extraTimeline: [
          ...cur.extraTimeline,
          { at: now(), status: effectiveStatusOf(id), actor: session.actor, note: `Escalated to ${assignee}` },
        ],
      }));
      void escalateLiveDispatch(session, id, assignee)
        .then(afterAction)
        .catch(() => setActionError('Could not escalate. Refresh and try again.'));
    },
    [canAct, session, applyOverride, effectiveStatusOf, afterAction],
  );

  const handleMarkExhausted = useCallback(
    (id: string) => {
      if (!canAct) return;
      applyOverride(id, (cur) => ({
        ...cur,
        status: 'exhausted',
        currentCandidateId: null,
        extraTimeline: [
          ...cur.extraTimeline,
          { at: now(), status: 'exhausted', actor: session.actor, note: 'Marked exhausted' },
        ],
      }));
      void markLiveDispatchExhausted(session, id)
        .then(afterAction)
        .catch(() => setActionError('Could not mark exhausted. Refresh and try again.'));
    },
    [canAct, session, applyOverride, afterAction],
  );

  const handleAddNote = useCallback(
    (id: string, body: string) => {
      if (!canAct) return;
      applyOverride(id, (cur) => ({
        ...cur,
        extraNotes: [...cur.extraNotes, { at: now(), body }],
      }));
      void addLiveDispatchNote(session, id, body)
        .then(afterAction)
        .catch(() => setActionError('Could not save note. Refresh and try again.'));
    },
    [canAct, session, applyOverride, afterAction],
  );

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filteredIds = useMemo(() => filtered.map((v) => v.record.id), [filtered]);
  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = filteredIds.length > 0 && filteredIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...filteredIds]);
    });
  }, [filteredIds]);

  const handleBulkRetry = useCallback(() => {
    const ids = filteredIds.filter((id) => selectedIds.has(id));
    ids.forEach((id) => handleRetry(id));
    setSelectedIds(new Set());
  }, [filteredIds, selectedIds, handleRetry]);

  const filterParams = useMemo<Record<string, string>>(
    () => ({
      search,
      status: status === ALL_FILTER_VALUE ? 'all' : status,
      priority: priority === ALL_FILTER_VALUE ? 'all' : priority,
      specialty: specialty === ALL_FILTER_VALUE ? 'all' : specialty,
      serviceArea: serviceArea === ALL_FILTER_VALUE ? 'all' : serviceArea,
      age,
      candidate: candidate === ALL_FILTER_VALUE ? 'all' : candidate,
      plumber: plumber === ALL_FILTER_VALUE ? 'all' : plumber,
      escalationState,
      location: location === ALL_FILTER_VALUE ? 'all' : location,
      needsAttentionOnly: String(needsAttentionOnly),
    }),
    [search, status, priority, specialty, serviceArea, age, candidate, plumber, escalationState, location, needsAttentionOnly],
  );

  const pageResetKey = useMemo(() => JSON.stringify(filterParams), [filterParams]);

  const handleExport = useCallback(() => {
    if (!canExport(session)) {
      setExportError('Export not permitted for this role.');
      return;
    }
    void recordClientExport('dispatch_queue', filtered.length, filterParams)
      .then(() => {
        downloadCsv(
          `dispatch-queue-${new Date().toISOString().slice(0, 10)}.csv`,
          buildDispatchCsv(filtered.map((vm) => vm.record), session.orgId),
        );
        setExportError(null);
      })
      .catch(() => setExportError('Export failed.'));
  }, [session, filtered, filterParams]);

  const openRow = openRowId ? allVms.find((v) => v.record.id === openRowId) ?? null : null;

  const header = (
    <PageHeader
      title="Dispatch Queue"
      description="Match ready jobs with qualified plumbers, monitor outreach, and resolve assignment exceptions."
    />
  );

  if (showLoading) {
    return (
      <div>
        {header}
        <Card className="mt-4">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading dispatch records…</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}

      {liveError ? (
        <Banner variant="destructive">{liveError}</Banner>
      ) : null}

      {actionError ? (
        <Banner variant="destructive" onDismiss={() => setActionError(null)}>
          {actionError}
        </Banner>
      ) : null}

      {exportError ? (
        <Banner variant="destructive" onDismiss={() => setExportError(null)}>
          {exportError}
        </Banner>
      ) : null}

      {/* §5.5 KPI cards. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Unassigned" value={stats.unassigned} format="number" />
        <StatCard
          label="Dispatch in progress"
          value={stats.byStatus.matching + stats.byStatus.contacting}
          format="number"
          tooltip="Dispatch records currently in Matching or Contacting."
        />
        <StatCard label="Awaiting response" value={stats.awaitingResponse} format="number" />
        <StatCard label="Assigned today" value={stats.assignedToday} format="number" />
        <StatCard
          label="Needs attention"
          value={stats.needsAttention}
          format="number"
          accent={stats.needsAttention > 0 ? 'destructive' : undefined}
          tooltip="Exhausted records plus Urgent or Emergency jobs beyond their assignment threshold."
        />
      </div>

      {needsAttentionOnly ? (
        <div className="flex items-center gap-2">
          <Badge variant="destructive">
            <span className="inline-flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" aria-hidden="true" />
              Needs attention only
            </span>
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setNeedsAttentionOnly(false)}>
            <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {formatCount(filtered.length)} dispatch record{filtered.length === 1 ? '' : 's'}
            </CardTitle>
          </div>
          <DispatchFilters
            search={search}
            status={status}
            priority={priority}
            specialty={specialty}
            serviceArea={serviceArea}
            age={age}
            candidate={candidate}
            plumber={plumber}
            escalationState={escalationState}
            location={location}
            serviceAreas={org.serviceAreas}
            candidates={candidateNames}
            plumbers={plumberNames}
            locations={locationOptions}
            showLocationFilter={showLocationFilterBar}
            onSearch={setSearch}
            onStatus={setStatus}
            onPriority={setPriority}
            onSpecialty={setSpecialty}
            onServiceArea={setServiceArea}
            onAge={setAge}
            onCandidate={setCandidate}
            onPlumber={setPlumber}
            onEscalationState={setEscalationState}
            onLocation={setLocation}
            selectedCount={filteredIds.filter((id) => selectedIds.has(id)).length}
            onBulkRetry={handleBulkRetry}
            canAct={canAct}
          />
          {canExportRows ? (
            <ListExportRow>
              <ExportCsvButton onClick={handleExport} disabled={filtered.length === 0} />
            </ListExportRow>
          ) : null}
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            allVms.filter((vm) => isAssignmentActive(vm.effectiveStatus) || vm.effectiveStatus === 'exhausted').length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-8 w-8" />}
                title="Dispatch Queue is clear"
                description="Jobs ready for plumber assignment will appear here."
              />
            ) : (
              <EmptyState
                icon={<ClipboardList className="h-8 w-8" />}
                title="No dispatch records match these filters"
                description="Adjust the status, priority, specialty, area, age, or search filters to see more."
              />
            )
          ) : (
            <DispatchTable
              rows={filtered}
              canAct={canAct}
              selectedIds={selectedIds}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onOpenRow={setOpenRowId}
              showLocation={showLocationFilterBar}
              pageResetKey={pageResetKey}
            />
          )}
        </CardContent>
      </Card>

      {openRow ? (
        <DispatchDrawer
          row={openRow}
          override={overrides[openRow.record.id]}
          open={openRowId !== null}
          onOpenChange={(o) => setOpenRowId(o ? openRow.record.id : null)}
          session={session}
          canAct={canAct}
          plumbers={plumbers}
          resolveCall={resolveCall}
          onRetry={handleRetry}
          onAssignManually={handleAssignManually}
          onChangeCandidate={handleChangeCandidate}
          onEscalate={handleEscalate}
          onMarkExhausted={handleMarkExhausted}
          onAddNote={handleAddNote}
        />
      ) : null}
    </div>
  );
}
