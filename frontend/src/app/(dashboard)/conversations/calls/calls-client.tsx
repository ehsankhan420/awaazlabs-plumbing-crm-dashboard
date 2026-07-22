'use client';

/**
 * §10.1 Calls sub-view body. The page header, sub-view tabs and shared filter bar live in
 * `conversations/layout.tsx`; this component renders the table, the detail drawer, and the
 * degraded/empty states.
 *
 * Modes (structural, from the data-access layer — never a local role check):
 *   - Owner/Manager: full table, phone reveal, recording + transcript in the drawer.
 *   - Viewer: rows load, but `media` is null → no audio player, no transcript, and
 *     `phoneE164` is absent so MaskedValue shows no reveal control.
 *   - restricted-access: listCalls returns `{ kind: 'aggregate' }`; the union forces the table to be
 *     hidden and only the count renders (§10.4).
 *
 * Deep-link (§10.1): the Jobs drawer links here as
 * `/conversations/calls?interaction={id}`; that row's drawer auto-opens.
 */

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { PhoneOff } from 'lucide-react';

import { Banner } from '@/components/ui/banner';
import { ExportCsvButton, ListExportRow } from '@/components/ui/export-csv-button';
import { EmptyState } from '@/components/ui/empty-state';
import { TablePageSkeleton } from '@/components/ui/skeleton';
import { LiveCallsPanel } from '@/components/live/live-calls-panel';
import { timezoneFor } from '@/lib/format';
import { useLiveCalls } from '@/hooks/use-dashboard-live';
import type { CallInteractionView } from '@/mock/data-access';
import { canExport } from '@/mock/data-access';
import { getFlagsServerSnapshot, getRuntimeFlags, isFlagged, submitFlag, subscribeToFlags } from '@/shared/flag-store';
import { useSession } from '@/shared/session-context';
import { buildCallsCsv } from '@/app/(dashboard)/reports/csv';
import { filtersToParams, runCsvExport } from '@/lib/csv-export';

import { useConversationFilters } from '../_components/conversations-provider';
import { matchesGradeBand, withinDateRange } from '../_components/filters';
import { CallDrawer } from './call-drawer';
import { CallsTable } from './calls-table';

export function CallsClient(): React.JSX.Element {
  const { session, showLocationFilter } = useSession();
  const { filters } = useConversationFilters();
  const searchParams = useSearchParams();

  const { data: liveCalls, error: loadError, isLoading } = useLiveCalls();
  const gated = liveCalls?.gated ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dismissedInteractionId, setDismissedInteractionId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const canExportRows = canExport(session);

  // §12.5 flags are a real, shared store fed by this button (not the audit log, and not a
  // local set). Subscribing keeps the button's flagged state in sync with the store.
  useSyncExternalStore(subscribeToFlags, () => getRuntimeFlags(session.orgId), getFlagsServerSnapshot);

  const baseRows = useMemo<readonly CallInteractionView[]>(
    () => (gated?.kind === 'rows' ? gated.rows : []),
    [gated],
  );

  const filtered = useMemo<readonly CallInteractionView[]>(() => {
    const q = filters.search.trim().toLowerCase();
    const rows = baseRows.filter((call) => {
      if (filters.agent !== 'all' && call.agent !== filters.agent) return false;
      if (filters.direction !== 'all' && call.direction !== filters.direction) return false;
      if (filters.disposition !== 'all' && call.disposition !== filters.disposition) return false;
      if (filters.priority !== 'all' && call.priority !== filters.priority) return false;
      if (filters.locationId !== 'all' && call.locationId !== filters.locationId) return false;
      if (!matchesGradeBand(call.grade?.overall ?? null, filters.gradeBand)) return false;
      if (!withinDateRange(call.atUtc, timezoneFor(session.orgId, call.locationId), filters.dateFrom, filters.dateTo))
        return false;

      if (q) {
        const id = call.contact?.identity ?? null;
        const hay = [
          id ? `${id.firstName} ${id.lastName}` : '',
          id?.phoneMasked ?? '',
          id?.phoneE164 ?? '',
          call.plumber?.name ?? '',
          call.linked.jobId ?? '',
          call.id,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
      // Channel is a Chats-only dimension; it does not apply to calls.
    });
    // Newest first.
    return [...rows].sort((a, b) => new Date(b.atUtc).getTime() - new Date(a.atUtc).getTime());
  }, [baseRows, filters, session.orgId]);

  const exportFilterParams = useMemo(() => filtersToParams({ ...filters, view: 'calls' }), [filters]);
  const pageResetKey = useMemo(() => JSON.stringify(filters), [filters]);

  const handleExport = useCallback(() => {
    void runCsvExport(
      session,
      'calls',
      filtered.length,
      exportFilterParams,
      `calls-${new Date().toISOString().slice(0, 10)}.csv`,
      buildCallsCsv(filtered, session.orgId),
    ).then(setExportError);
  }, [session, filtered, exportFilterParams]);

  // §10.1 deep-link: auto-open the drawer for `?interaction={id}` when that call is present.
  const interactionParam = searchParams.get('interaction');
  useEffect(() => {
    setDismissedInteractionId(null);
  }, [interactionParam]);

  useEffect(() => {
    if (interactionParam && interactionParam !== dismissedInteractionId && baseRows.some((c) => c.id === interactionParam)) {
      setSelectedId(interactionParam);
    }
  }, [interactionParam, dismissedInteractionId, baseRows]);

  const selected = selectedId ? baseRows.find((c) => c.id === selectedId) ?? null : null;

  const handleSelectCall = (id: string) => {
    setDismissedInteractionId(interactionParam);
    setSelectedId(id);
  };

  const handleFlag = (reason: string, context: string) => {
    if (!selected) return;
    // Flags an *interaction*; interactionId is the call's own id. Writes to the shared
    // flag store, which feeds the Quality tab inbox.
    submitFlag({
      orgId: session.orgId,
      interactionId: selected.id,
      submittedBy: session.actor,
      reason: context.trim() ? `${reason}: ${context.trim()}` : reason,
    });
  };

  if (isLoading && gated === null && !loadError) {
    return <TablePageSkeleton label="Loading live calls from the voice platform..." rows={8} />;
  }

  if (gated?.kind === 'aggregate') {
    // §10.4 restricted-access degradation: aggregate counts only; no rows, no recordings, no transcripts.
    return (
      <div className="flex flex-col gap-4">
        <Banner variant="default" title="Aggregate view (restricted mode)">
          This workspace is in restricted mode, so call-level rows, recordings, and transcripts are not available. Only an
          aggregate count is shown.
        </Banner>
        <LiveCallsPanel snapshot={gated} session={session} description="Live calls in this workspace." />
      </div>
    );
  }

  if (loadError) {
    return (
      <Banner variant="destructive" title="Could not load live calls">
        {loadError}
      </Banner>
    );
  }

  if (baseRows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <LiveCallsPanel snapshot={gated} session={session} description="Live calls in this workspace." />
        <EmptyState
          icon={<PhoneOff className="h-8 w-8" />}
          title="No calls yet"
          description="When your voice agents handle calls, each one appears here with its recording, transcript, and QA grade."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {exportError ? (
        <Banner variant="destructive" title="Export failed" onDismiss={() => setExportError(null)}>
          {exportError}
        </Banner>
      ) : null}

      <LiveCallsPanel snapshot={gated} session={session} description="Live calls in this workspace." />

      {canExportRows ? (
        <ListExportRow>
          <ExportCsvButton onClick={handleExport} disabled={filtered.length === 0} />
        </ListExportRow>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<PhoneOff className="h-8 w-8" />}
          title="No calls match these filters"
          description="Adjust or clear the filters above to see more calls."
        />
      ) : (
        <CallsTable
          rows={filtered}
          session={session}
          showLocation={showLocationFilter}
          onRowClick={handleSelectCall}
          pageResetKey={pageResetKey}
        />
      )}

      {selected ? (
        <CallDrawer
          call={selected}
          session={session}
          flagged={isFlagged(session.orgId, selected.id)}
          onFlag={handleFlag}
          onClose={() => {
            setDismissedInteractionId(interactionParam ?? selected.id);
            setSelectedId(null);
          }}
        />
      ) : null}
    </div>
  );
}
