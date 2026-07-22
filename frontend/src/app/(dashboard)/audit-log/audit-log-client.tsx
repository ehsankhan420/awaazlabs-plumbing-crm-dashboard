'use client';

/**
 * §16.2 AUDIT LOG (COMPLIANCE, restricted mode only, Owner only). Immutable, append-only.
 *
 * ⚠ THE RULE THAT DEFINES THIS TAB (build guide Part A, Rule 7): the Audit Log is NOT fed by
 * a static fixture. It is fed by real actions elsewhere in the app.
 *
 * 9 of the 12 canonical event types are fetched from the real, persisted `audit_events`
 * table via `fetchLiveAuditEvents` (`src/lib/audit-live.ts` → `/api/audit` →
 * dashboard-api's `?resource=audit_events`) — reveal a phone on /jobs, play a
 * recording, run an export, and the row survives a page refresh. The remaining 3
 * (`permission_change`, `consent_list_change`, `knowledge_change_request`) have no backend
 * feature yet (Members/Consent/Knowledge pages are still mock-only), so those are merged in
 * from the client-only store in `shared/audit.ts` — real UI actions, just not durable.
 *
 * Columns (exactly, in order): timestamp (UTC + location timezone) · actor · role · event
 * type · object reference · IP · user agent.
 *
 * Immutability is structural: the real rows come from an append-only DB table, the mock
 * rows from an append-only in-memory store; neither this component nor its backend exposes
 * an edit or delete path.
 */

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ChevronLeft, ChevronRight, Download, Filter, ScrollText, Search } from 'lucide-react';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCount, formatUtcAndLocal, timezoneFor } from '@/lib/format';
import { mockNow } from '@/mock/orgs';
import { fetchLiveAuditEvents, recordClientExport } from '@/lib/audit-live';
import {
  AUDIT_EVENT_TYPE_LABELS,
  AUDIT_EVENT_TYPES,
  getAuditEvents,
  getAuditEventsServerSnapshot,
  subscribeToAuditEvents,
  type AuditEvent,
  type AuditEventType,
} from '@/shared/audit';
import { ROLE_LABELS } from '@/shared/status-models';
import { useSession } from '@/shared/session-context';

import { buildAuditCsv, downloadCsv } from './audit-export';

const ALL = '__all__';
const PAGE_SIZE = 15;

/** No backend feature exists yet for these three — see the file-header comment. */
const MOCK_ONLY_EVENT_TYPES: ReadonlySet<AuditEventType> = new Set([
  'permission_change',
  'consent_list_change',
  'knowledge_change_request',
]);

export function AuditLogClient(): React.JSX.Element {
  const { session } = useSession();

  // The 3 event types with no backend feature yet, filtered from the client-only store.
  const mockStoreEvents = useSyncExternalStore(
    subscribeToAuditEvents,
    getAuditEvents,
    getAuditEventsServerSnapshot,
  );
  const mockEvents = useMemo(
    () => mockStoreEvents.filter((e) => MOCK_ONLY_EVENT_TYPES.has(e.eventType)),
    [mockStoreEvents],
  );

  const [liveEvents, setLiveEvents] = useState<readonly AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLiveEvents = useCallback(() => {
    setIsLoading(true);
    fetchLiveAuditEvents({})
      .then((rows) => {
        setLiveEvents(rows);
        setLoadError(null);
      })
      .catch(() => setLoadError('Could not load audit events from the server.'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    loadLiveEvents();
  }, [loadLiveEvents]);

  const events = useMemo(
    () =>
      [...liveEvents, ...mockEvents].sort(
        (a, b) => Date.parse(b.timestampUtc) - Date.parse(a.timestampUtc),
      ),
    [liveEvents, mockEvents],
  );

  const [actor, setActor] = useState<string>(ALL);
  const [eventType, setEventType] = useState<string>(ALL);
  const [objectQuery, setObjectQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const actors = useMemo(
    () => Array.from(new Set(events.map((e) => e.actor))).sort(),
    [events],
  );

  const filtered = useMemo(() => {
    const q = objectQuery.trim().toLowerCase();
    const fromMs = fromDate ? Date.parse(`${fromDate}T00:00:00.000Z`) : null;
    const toMs = toDate ? Date.parse(`${toDate}T23:59:59.999Z`) : null;

    return events.filter((e) => {
      if (actor !== ALL && e.actor !== actor) return false;
      if (eventType !== ALL && e.eventType !== eventType) return false;
      if (q !== '' && !e.objectRef.toLowerCase().includes(q)) return false;
      const t = Date.parse(e.timestampUtc);
      if (fromMs !== null && t < fromMs) return false;
      if (toMs !== null && t > toMs) return false;
      return true;
    });
  }, [events, actor, eventType, objectQuery, fromDate, toDate]);

  const [page, setPage] = useState(1);

  // Filters changing collapses the result set; return to the first page so the user is
  // never stranded on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [actor, eventType, objectQuery, fromDate, toDate]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // If the result set shrinks on its own (e.g. a background refresh), clamp without
  // resetting on every poll.
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount));
  }, [pageCount]);

  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  const eventTypeOptions = useMemo(
    () => [
      { value: ALL, label: 'All event types' },
      ...AUDIT_EVENT_TYPES.map((t) => ({ value: t, label: AUDIT_EVENT_TYPE_LABELS[t] })),
    ],
    [],
  );

  const actorOptions = useMemo(
    () => [{ value: ALL, label: 'All actors' }, ...actors.map((a) => ({ value: a, label: a }))],
    [actors],
  );

  const handleExport = useCallback(() => {
    const filters: Record<string, string> = {
      actor: actor === ALL ? 'all' : actor,
      eventType: eventType === ALL ? 'all' : eventType,
      object: objectQuery.trim() === '' ? 'all' : objectQuery.trim(),
      from: fromDate === '' ? 'all' : fromDate,
      to: toDate === '' ? 'all' : toDate,
    };
    // §16.2: the export action itself writes an audit event. This appends a new `export`
    // row to the very log being exported — the CSV captures the state *before* that write,
    // and the new row appears at the top of the table once the reload below completes.
    recordClientExport('audit_log', filtered.length, filters)
      .then(() => {
        downloadCsv(`audit-log-${mockNow().toISOString().slice(0, 10)}.csv`, buildAuditCsv(filtered, session.orgId));
        setError(null);
        loadLiveEvents();
      })
      .catch(() => setError('Export failed. No file was produced.'));
  }, [session, filtered, actor, eventType, objectQuery, fromDate, toDate, loadLiveEvents]);

  const dateInputClass =
    'rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground';

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Immutable, append-only record of every audited action. Fed live by actions across the app — reveals, playback, transcript views, searches, exports, and status changes."
        actions={
          <Button onClick={handleExport} aria-label="Export the filtered audit log as CSV">
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        }
      />

      {error ? (
        <Banner variant="destructive" className="mb-4" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      ) : null}

      {loadError ? (
        <Banner variant="destructive" className="mb-4" onDismiss={() => setLoadError(null)}>
          {loadError}
        </Banner>
      ) : null}

      <Banner variant="default" className="mb-4" title="Retention">
        Audit events are retained per your contract term and cannot be edited or deleted from
        this interface. Exporting the log is itself an audited action and appears as a new row.
      </Banner>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {formatCount(filtered.length)} event{filtered.length === 1 ? '' : 's'}
            {isLoading ? <span className="text-xs font-normal text-muted-foreground">Refreshing…</span> : null}
          </CardTitle>

          <div className="flex flex-wrap items-end gap-3">
            <Select
              value={actor}
              onValueChange={setActor}
              options={actorOptions}
              aria-label="Filter by actor"
            />
            <Select
              value={eventType}
              onValueChange={setEventType}
              options={eventTypeOptions}
              aria-label="Filter by event type"
            />
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              From
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label="Filter from date"
                className={dateInputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              To
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                aria-label="Filter to date"
                className={dateInputClass}
              />
            </label>
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={objectQuery}
                onChange={(e) => setObjectQuery(e.target.value)}
                placeholder="Filter by object reference"
                aria-label="Filter by object reference"
                className="w-full min-w-[12rem] rounded-md border border-input bg-transparent py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="h-8 w-8" />}
              title={isLoading ? 'Loading audit events…' : 'No audit events match these filters'}
              description="Adjust the actor, event type, date range, or object filters. New events appear here the moment an audited action occurs elsewhere in the app."
            />
          ) : (
            <Table caption="Audit events, newest first">
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Event type</TableHead>
                  <TableHead>Object reference</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>User agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRows.map((e) => {
                  const tz = e.locationId ? timezoneFor(session.orgId, e.locationId) : 'UTC';
                  const { utc, local } = formatUtcAndLocal(e.timestampUtc, tz);
                  const detail = e.detail
                    ? Object.entries(e.detail)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ')
                    : null;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap align-top tabular-nums">
                        <div className="text-foreground">{utc} UTC</div>
                        <div className="text-muted-foreground">
                          {local} ({e.locationId ? tz : 'org-level'})
                        </div>
                      </TableCell>
                      <TableCell className="align-top">{e.actor}</TableCell>
                      <TableCell className="align-top">{ROLE_LABELS[e.role]}</TableCell>
                      <TableCell className="align-top">{AUDIT_EVENT_TYPE_LABELS[e.eventType]}</TableCell>
                      <TableCell className="align-top">
                        <div className="font-mono text-xs text-foreground">{e.objectRef}</div>
                        {detail ? <div className="text-xs text-muted-foreground">{detail}</div> : null}
                      </TableCell>
                      <TableCell className="align-top text-muted-foreground">{e.ip}</TableCell>
                      <TableCell className="max-w-[16rem] align-top text-xs text-muted-foreground">
                        <span className="block truncate" title={e.userAgent}>
                          {e.userAgent}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {filtered.length > 0 ? (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
                <span className="tabular-nums">
                  Page {currentPage} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
