'use client';

/**
 * §5.4 ESCALATIONS — the human-action worklist for urgent customer needs, safety events,
 * and dispatch failures that require ownership.
 *
 * An item enters this page only when a team member must acknowledge, own, and resolve
 * it. Acknowledgement is gated on `canAcknowledgeEscalation` — a Viewer sees no
 * acknowledge control. Statuses, severities, triggers, labels, and thresholds all import
 * from `@/shared/status-models`; none is re-declared here.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';

import { Banner } from '@/components/ui/banner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { formatCount, formatDateTime, timezoneFor } from '@/lib/format';
import { minutesSince } from '@/lib/metrics';
import { useLiveEscalations, useLiveNotifications } from '@/hooks/use-dashboard-live';
import {
  acknowledgeLiveEscalation,
  assignLiveEscalationOwner,
  resolveLiveEscalation,
  saveLiveEscalationNote,
} from '@/lib/dashboard-live';
import { canAcknowledgeEscalation, canExport, type EscalationView } from '@/mock/data-access';
import { getLocationById, mockNow } from '@/mock/orgs';
import { getFixture } from '@/mock/fixtures';
import {
  ESCALATION_SEVERITY_LABELS,
  ESCALATION_STATUSES,
  ESCALATION_STATUS_LABELS,
  ESCALATION_TRIGGER_LABELS,
  type EscalationStatus,
} from '@/shared/status-models';
import { useSession } from '@/shared/session-context';
import { buildEscalationsCsv } from '@/app/(dashboard)/reports/csv';
import { filtersToParams, runCsvExport } from '@/lib/csv-export';

import { ackThresholdMinutes, computeEscalationStats, isPastThreshold } from './escalation-metrics';
import { EscalationDetailDrawer } from './escalation-detail-drawer';
import { ExportCsvButton, ListExportRow } from '@/components/ui/export-csv-button';
import { EscalationsFilters, ALL_FILTER_VALUE } from './escalations-filters';
import { EscalationsStatStrip } from './escalations-stat-strip';
import { EscalationsTable } from './escalations-table';
import type { EscalationOverride, EscalationRowVM, EscalationSourceLink } from './types';

const HEADER = (
  <PageHeader
    title="Escalations"
    description="Human-action worklist for urgent customer needs, safety events, and dispatch failures that require ownership."
  />
);

function localDateKey(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso),
  );
}

export function EscalationsClient(): React.JSX.Element {
  const { session, org, showLocationFilter } = useSession();
  const searchParams = useSearchParams();
  const statusFromUrl = searchParams.get('status');
  const deepLinkEscalationId = searchParams.get('escalationId');
  const initialStatus =
    statusFromUrl === 'pending'
      ? 'pending'
      : statusFromUrl !== null && (ESCALATION_STATUSES as readonly string[]).includes(statusFromUrl)
        ? statusFromUrl
        : ALL_FILTER_VALUE;

  const { data: live, isLoading: loadingLive, error: liveError, invalidate } = useLiveEscalations();
  const { invalidate: invalidateNotifications } = useLiveNotifications();
  const [overrides, setOverrides] = useState<Readonly<Record<string, EscalationOverride>>>({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(initialStatus);
  const [severity, setSeverity] = useState<string>(ALL_FILTER_VALUE);
  const [trigger, setTrigger] = useState<string>(ALL_FILTER_VALUE);
  const [owner, setOwner] = useState<string>(ALL_FILTER_VALUE);
  const [location, setLocation] = useState<string>(ALL_FILTER_VALUE);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const canAck = canAcknowledgeEscalation(session);
  const canExportRows = canExport(session);
  const scoped = useMemo<readonly EscalationView[]>(
    () => (live?.gated.kind === 'rows' ? live.gated.rows : []),
    [live],
  );

  const dispatchById = useMemo(
    () => new Map(getFixture(session.orgId).dispatchRecords.map((d) => [d.id, d])),
    [session.orgId],
  );
  const memberNames = useMemo(
    () => getFixture(session.orgId).members.filter((m) => m.role !== 'VIEWER').map((m) => m.name),
    [session.orgId],
  );

  const vms = useMemo<EscalationRowVM[]>(() => {
    return scoped.map((record) => {
      const ov = overrides[record.id];
      const acknowledgedAtUtc = ov?.acknowledgedAtUtc ?? record.acknowledgedAtUtc;
      const acknowledgedBy = ov?.acknowledgedBy ?? record.acknowledgedBy;
      const ownerName = ov?.owner ?? record.owner;
      const resolutionNote = ov?.resolutionNote ?? record.resolutionNote;
      const effectiveStatus: EscalationStatus =
        ov?.status ??
        (acknowledgedAtUtc !== null && record.status === 'open' ? 'acknowledged' : record.status);
      const tz = timezoneFor(session.orgId, record.locationId);

      let source: EscalationSourceLink | null = null;
      if (record.sourceInteractionId) {
        source = {
          kind: 'call',
          label: 'Call',
          href: `/conversations/calls?interaction=${record.sourceInteractionId}`,
        };
      } else if (record.dispatchId) {
        source = { kind: 'dispatch', label: 'Dispatch', href: `/dispatch-queue?dispatchId=${record.dispatchId}` };
      } else if (record.jobId) {
        source = { kind: 'job', label: 'Job', href: `/jobs?jobId=${record.jobId}` };
      }

      const identity = record.contact?.identity ?? null;
      return {
        record,
        customerName: identity ? `${identity.firstName} ${identity.lastName}` : 'Unknown customer',
        source,
        triggerLabel: ESCALATION_TRIGGER_LABELS[record.trigger],
        severity: record.severity,
        effectiveStatus,
        owner: ownerName,
        acknowledgedAtUtc,
        acknowledgedBy,
        resolutionNote,
        locationName:
          record.locationName ?? getLocationById(session.orgId, record.locationId)?.name ?? record.locationId,
        timezone: tz,
        timestampLabel: formatDateTime(record.atUtc, tz),
        ackTimestampLabel: acknowledgedAtUtc ? formatDateTime(acknowledgedAtUtc, tz) : null,
        ageMinutes: minutesSince(record.atUtc),
        thresholdMinutes: ackThresholdMinutes(record.severity),
        pastThreshold: isPastThreshold({
          atUtc: record.atUtc,
          trigger: record.trigger,
          severity: record.severity,
          status: effectiveStatus,
          acknowledgedAtUtc,
        }),
      };
    });
  }, [scoped, overrides, session.orgId]);

  const stats = useMemo(
    () =>
      computeEscalationStats(
        vms.map((vm) => ({
          atUtc: vm.record.atUtc,
          trigger: vm.record.trigger,
          severity: vm.severity,
          status: vm.effectiveStatus,
          acknowledgedAtUtc: vm.acknowledgedAtUtc,
        })),
      ),
    [vms],
  );

  const owners = useMemo(
    () => Array.from(new Set(vms.map((vm) => vm.owner).filter((o): o is string => o !== null))).sort(),
    [vms],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vms.filter((vm) => {
      if (status === 'pending' && vm.effectiveStatus === 'resolved') return false;
      if (status !== ALL_FILTER_VALUE && status !== 'pending' && vm.effectiveStatus !== status) return false;
      if (severity !== ALL_FILTER_VALUE && vm.severity !== severity) return false;
      if (trigger !== ALL_FILTER_VALUE && vm.record.trigger !== trigger) return false;
      if (owner === '__unowned__' && vm.owner !== null) return false;
      if (owner !== ALL_FILTER_VALUE && owner !== '__unowned__' && vm.owner !== owner) return false;
      if (location !== ALL_FILTER_VALUE && vm.record.locationId !== location) return false;
      if (dateFrom || dateTo) {
        const key = localDateKey(vm.record.atUtc, vm.timezone);
        if (dateFrom && key < dateFrom) return false;
        if (dateTo && key > dateTo) return false;
      }
      if (q) {
        const identity = vm.record.contact?.identity;
        const hay = [
          vm.customerName,
          identity?.phoneMasked ?? '',
          vm.record.reference,
          vm.record.job?.reference ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [vms, search, status, severity, trigger, owner, location, dateFrom, dateTo]);

  useEffect(() => {
    if (!deepLinkEscalationId) return;
    if (vms.some((vm) => vm.record.id === deepLinkEscalationId)) {
      setOpenRowId(deepLinkEscalationId);
    }
  }, [deepLinkEscalationId, vms]);

  const exportFilterParams = useMemo(
    () =>
      filtersToParams({
        search,
        status: status === ALL_FILTER_VALUE ? 'all' : status,
        severity: severity === ALL_FILTER_VALUE ? 'all' : severity,
        trigger: trigger === ALL_FILTER_VALUE ? 'all' : trigger,
        owner: owner === ALL_FILTER_VALUE ? 'all' : owner,
        location: location === ALL_FILTER_VALUE ? 'all' : location,
        dateFrom,
        dateTo,
      }),
    [search, status, severity, trigger, owner, location, dateFrom, dateTo],
  );

  const isDirty =
    search !== '' ||
    status !== ALL_FILTER_VALUE ||
    severity !== ALL_FILTER_VALUE ||
    trigger !== ALL_FILTER_VALUE ||
    owner !== ALL_FILTER_VALUE ||
    location !== ALL_FILTER_VALUE ||
    dateFrom !== '' ||
    dateTo !== '';

  const clearFilters = useCallback(() => {
    setSearch('');
    setStatus(ALL_FILTER_VALUE);
    setSeverity(ALL_FILTER_VALUE);
    setTrigger(ALL_FILTER_VALUE);
    setOwner(ALL_FILTER_VALUE);
    setLocation(ALL_FILTER_VALUE);
    setDateFrom('');
    setDateTo('');
  }, []);

  const handleExport = useCallback(() => {
    const rows = filtered.map((vm) => ({
      reference: vm.record.reference,
      customerName: vm.customerName,
      severityLabel: ESCALATION_SEVERITY_LABELS[vm.severity],
      triggerLabel: vm.triggerLabel,
      statusLabel: ESCALATION_STATUS_LABELS[vm.effectiveStatus],
      owner: vm.owner ?? '',
      acknowledgedAt: vm.ackTimestampLabel ?? '',
      acknowledgedBy: vm.acknowledgedBy ?? '',
      createdAt: vm.timestampLabel,
      resolutionNote: vm.resolutionNote ?? '',
      locationName: vm.locationName,
    }));
    void runCsvExport(
      session,
      'escalations',
      filtered.length,
      exportFilterParams,
      `escalations-${new Date().toISOString().slice(0, 10)}.csv`,
      buildEscalationsCsv(rows),
    ).then(setExportError);
  }, [session, filtered, exportFilterParams]);

  const now = () => mockNow().toISOString();

  const afterAction = useCallback(() => {
    invalidate();
    invalidateNotifications();
  }, [invalidate, invalidateNotifications]);

  // §5.4 one-tap acknowledge. Optimistic; the adapter records ownership.
  const handleAcknowledge = useCallback(
    (id: string) => {
      if (!canAck) return;
      setOverrides((prev) => ({
        ...prev,
        [id]: { ...prev[id], acknowledgedAtUtc: now(), acknowledgedBy: session.actor, owner: prev[id]?.owner ?? session.actor },
      }));
      void acknowledgeLiveEscalation(session, id).then(afterAction).catch(() => undefined);
    },
    [canAck, afterAction, session],
  );

  const handleAssignOwner = useCallback(
    (id: string, ownerName: string) => {
      if (!canAck) return;
      setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], owner: ownerName } }));
      void assignLiveEscalationOwner(session, id, ownerName).then(afterAction).catch(() => undefined);
    },
    [canAck, afterAction, session],
  );

  // Append a resolution note. Writes the truthful `note_edit` audit event.
  const handleSaveNote = useCallback(
    (id: string, note: string) => {
      void saveLiveEscalationNote(session, id, note).then(afterAction).catch(() => undefined);
      setOverrides((prev) => {
        const cur = prev[id] ?? {};
        return {
          ...prev,
          [id]: {
            ...cur,
            resolutionNote: note,
            acknowledgedAtUtc: cur.acknowledgedAtUtc ?? now(),
            acknowledgedBy: cur.acknowledgedBy ?? session.actor,
            owner: cur.owner ?? session.actor,
          },
        };
      });
    },
    [afterAction, session],
  );

  const handleResolve = useCallback(
    (id: string, note: string) => {
      void resolveLiveEscalation(session, id, note).then(afterAction).catch(() => undefined);
      setOverrides((prev) => {
        const cur = prev[id] ?? {};
        return {
          ...prev,
          [id]: {
            ...cur,
            status: 'resolved',
            resolutionNote: note || cur.resolutionNote,
            resolvedAtUtc: now(),
            acknowledgedAtUtc: cur.acknowledgedAtUtc ?? now(),
            acknowledgedBy: cur.acknowledgedBy ?? session.actor,
            owner: cur.owner ?? session.actor,
          },
        };
      });
      setOpenRowId(null);
    },
    [afterAction, session],
  );

  if (loadingLive && !live) {
    return (
      <div className="flex flex-col gap-6">
        {HEADER}
        <Banner variant="default" title="Loading escalations">
          Pulling the latest escalation worklist.
        </Banner>
      </div>
    );
  }

  if (liveError) {
    return (
      <div className="flex flex-col gap-6">
        {HEADER}
        <Banner variant="destructive" title="Escalation data unavailable">
          {liveError}
        </Banner>
      </div>
    );
  }

  if (live?.gated.kind === 'aggregate') {
    return (
      <div className="flex flex-col gap-6">
        {HEADER}
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle>Escalations in scope</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{formatCount(live.gated.total)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Aggregate count for the current scope.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (scoped.length === 0) {
    return (
      <div>
        {HEADER}
        <EmptyState
          icon={<ShieldAlert className="h-8 w-8" />}
          title="No escalations"
          description="Urgent handoffs, safety events, and dispatch failures requiring human ownership will appear here."
        />
      </div>
    );
  }

  const openRow = openRowId ? vms.find((v) => v.record.id === openRowId) ?? null : null;
  const openDispatch = openRow?.record.dispatchId ? dispatchById.get(openRow.record.dispatchId) ?? null : null;

  return (
    <div className="flex flex-col gap-6">
      {HEADER}

      {exportError ? (
        <Banner variant="destructive" title="Export failed" onDismiss={() => setExportError(null)}>
          {exportError}
        </Banner>
      ) : null}

      <EscalationsStatStrip stats={stats} />

      <Card>
        <CardHeader className="gap-4">
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {formatCount(filtered.length)} escalation{filtered.length === 1 ? '' : 's'}
          </CardTitle>
          <EscalationsFilters
            search={search}
            status={status}
            severity={severity}
            trigger={trigger}
            owner={owner}
            location={location}
            dateFrom={dateFrom}
            dateTo={dateTo}
            owners={owners}
            locations={org.locations.map((l) => ({ id: l.id, name: l.name }))}
            showLocationFilter={showLocationFilter}
            isDirty={isDirty}
            onSearch={setSearch}
            onStatus={setStatus}
            onSeverity={setSeverity}
            onTrigger={setTrigger}
            onOwner={setOwner}
            onLocation={setLocation}
            onDateFrom={setDateFrom}
            onDateTo={setDateTo}
            onClear={clearFilters}
          />
          {canExportRows ? (
            <ListExportRow>
              <ExportCsvButton onClick={handleExport} disabled={filtered.length === 0} />
            </ListExportRow>
          ) : null}
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<ShieldAlert className="h-8 w-8" />}
              title="No escalations match these filters"
              description="Adjust status, severity, trigger, owner, or date filters."
            />
          ) : (
            <EscalationsTable
              rows={filtered}
              canAck={canAck}
              showLocation={showLocationFilter}
              onAcknowledge={handleAcknowledge}
              onOpenRow={setOpenRowId}
            />
          )}
        </CardContent>
      </Card>

      {openRow ? (
        <EscalationDetailDrawer
          row={openRow}
          dispatch={openDispatch}
          open={openRowId !== null}
          onOpenChange={(o) => setOpenRowId(o ? openRow.record.id : null)}
          session={session}
          canAck={canAck}
          members={memberNames}
          onAcknowledge={handleAcknowledge}
          onAssignOwner={handleAssignOwner}
          onSaveNote={handleSaveNote}
          onResolve={handleResolve}
        />
      ) : null}
    </div>
  );
}
