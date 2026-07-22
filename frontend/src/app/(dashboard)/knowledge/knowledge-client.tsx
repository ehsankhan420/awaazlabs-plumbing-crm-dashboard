'use client';

/**
 * §15 AGENT KNOWLEDGE TAB.
 *
 * Purpose (§15): "answers the business owner's biggest trust question: what is this system
 * telling my customers."
 *
 * §15.1 renders all eight knowledge categories (iterated from `KNOWLEDGE_CATEGORIES`, never
 * hardcoded), structured and per-location where applicable — content is real
 * (`knowledge_content`), directly editable by OWNER_ADMIN. §15.2 attaches a change-request
 * control to every block, tracks request status through requested → scheduled → live, and
 * lists version history — real (`knowledge_requests` / history).
 *
 * PERMISSIONS:
 *  - OWNER_ADMIN: can edit knowledge content directly, and can advance a change request's status.
 *  - MANAGER: can request an update and view Change Requests & version history — no direct edit,
 *    no status control.
 *  - VIEWER: can only view the Knowledge view — no request form, no Change Requests section at
 *    all (enforced both here and server-side in `listKnowledgeRequests`).
 *
 * Aggregate-by-nature: no customer name, phone, recording, or transcript appears here.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Building2, ChevronLeft, ChevronRight, History, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { KnowledgeRequestStatusChip } from '@/components/ui/status-chip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime, timezoneFor } from '@/lib/format';
import {
  fetchLiveKnowledgeContent,
  fetchLiveKnowledgeRequests,
  updateLiveKnowledgeContent,
  updateLiveKnowledgeRequestStatus,
} from '@/lib/dashboard-live';
import type { LiveKnowledgeChangeRequest, LiveKnowledgeContentBlock, LiveKnowledgeEntry } from '@/lib/dashboard-live';
import { KNOWLEDGE_CATEGORIES, type KnowledgeCategory } from '@/mock/schema';
import { KNOWLEDGE_REQUEST_STATUSES, KNOWLEDGE_REQUEST_STATUS_LABELS, type KnowledgeRequestStatus, type Role } from '@/shared/status-models';
import { useSession } from '@/shared/session-context';

import { KNOWLEDGE_CATEGORY_LABELS } from './categories';
import { ChangeRequestForm } from './change-request-form';

/** §15: only OWNER_ADMIN edits content directly or changes a request's status. */
function canEditKnowledgeContent(role: Role): boolean {
  return role === 'OWNER_ADMIN';
}
function canManageChangeRequests(role: Role): boolean {
  return role === 'OWNER_ADMIN';
}
/** §15: VIEWER never sees the request form or the Change Requests section. */
function canRequestKnowledgeChange(role: Role): boolean {
  return role !== 'VIEWER';
}
function canViewChangeRequests(role: Role): boolean {
  return role !== 'VIEWER';
}

const STATUS_OPTIONS = KNOWLEDGE_REQUEST_STATUSES.map((status) => ({
  value: status,
  label: KNOWLEDGE_REQUEST_STATUS_LABELS[status],
}));

/** §2.4: per-location blocks respect the active global location filter; org-wide always shows. */
function blockInScope(block: LiveKnowledgeContentBlock, locationId: string | null): boolean {
  if (block.locationId === null) return true;
  if (locationId === null) return true;
  return block.locationId === locationId;
}

/** The live request's `category` is a plain string (the DB does not constrain it to the
 * frontend's 8-value enum); fall back to the raw value for anything unrecognized. */
function categoryLabelFor(category: string): string {
  return (KNOWLEDGE_CATEGORY_LABELS as Record<string, string>)[category] ?? category;
}

const REQUESTS_PAGE_SIZE = 5;

function EntryList({ entries }: { entries: readonly LiveKnowledgeEntry[] }): React.JSX.Element {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,14rem)_1fr]">
      {entries.map((entry, i) => (
        <React.Fragment key={`${entry.label}-${i}`}>
          <dt className="text-sm font-medium text-muted-foreground">{entry.label}</dt>
          <dd className="text-sm text-foreground">{entry.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function EntryEditor({
  entries,
  onChange,
}: {
  entries: readonly LiveKnowledgeEntry[];
  onChange: (entries: LiveKnowledgeEntry[]) => void;
}): React.JSX.Element {
  function updateRow(i: number, field: 'label' | 'value', value: string): void {
    onChange(entries.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)));
  }
  function removeRow(i: number): void {
    onChange(entries.filter((_, idx) => idx !== i));
  }
  function addRow(): void {
    onChange([...entries, { label: '', value: '' }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry, i) => (
        <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={entry.label}
            onChange={(e) => updateRow(i, 'label', e.target.value)}
            placeholder="Label"
            aria-label={`Row ${i + 1} label`}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-48"
          />
          <input
            value={entry.value}
            onChange={(e) => updateRow(i, 'value', e.target.value)}
            placeholder="Value"
            aria-label={`Row ${i + 1} value`}
            className="w-full flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => removeRow(i)}
            aria-label={`Remove row ${i + 1}`}
            disabled={entries.length <= 1}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addRow} className="w-fit">
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add row
      </Button>
    </div>
  );
}

function KnowledgeBlockView({
  block,
  category,
  categoryLabel,
  locationName,
  canEdit,
  canRequest,
  onSubmitted,
  onSaved,
}: {
  block: LiveKnowledgeContentBlock;
  category: KnowledgeCategory;
  categoryLabel: string;
  locationName: string | null;
  canEdit: boolean;
  canRequest: boolean;
  onSubmitted: (request: LiveKnowledgeChangeRequest) => void;
  onSaved: (block: LiveKnowledgeContentBlock) => void;
}): React.JSX.Element {
  const { session } = useSession();
  const scopeLabel = locationName ?? 'All locations';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LiveKnowledgeEntry[]>(() => block.entries.map((e) => ({ ...e })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(): void {
    setDraft(block.entries.map((e) => ({ ...e })));
    setError(null);
    setEditing(true);
  }
  function cancelEdit(): void {
    setEditing(false);
    setError(null);
  }
  async function save(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateLiveKnowledgeContent(session, block.id, draft);
      onSaved(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  const canSave = !saving && draft.length > 0 && draft.every((e) => e.label.trim() !== '' && e.value.trim() !== '');

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {locationName ? (
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {scopeLabel}
        </span>
        <div className="flex items-center gap-2">
          {canEdit && !editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={startEdit}
              aria-label={`Edit ${categoryLabel} — ${scopeLabel}`}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </Button>
          ) : null}
          {canRequest ? (
            <ChangeRequestForm
              category={category}
              categoryLabel={categoryLabel}
              blockLabel={scopeLabel}
              onSubmitted={onSubmitted}
            />
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <EntryEditor entries={draft} onChange={setDraft} />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={!canSave}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <EntryList entries={block.entries} />
      )}
    </div>
  );
}

export function KnowledgeClient(): React.JSX.Element {
  const { session, org } = useSession();

  const tz = timezoneFor(session.orgId, session.locationId ?? org.locations[0]?.id ?? '');
  const locationName = (id: string): string => org.locations.find((l) => l.id === id)?.name ?? id;

  const editAllowed = canEditKnowledgeContent(session.role);
  const requestAllowed = canRequestKnowledgeChange(session.role);
  const viewRequestsAllowed = canViewChangeRequests(session.role);
  const manageRequestsAllowed = canManageChangeRequests(session.role);

  // §15.1 knowledge content — real (dashboard-api `knowledge_content`).
  const [blocks, setBlocks] = useState<readonly LiveKnowledgeContentBlock[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [blocksError, setBlocksError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBlocksLoading(true);
    setBlocksError(null);
    fetchLiveKnowledgeContent(session)
      .then((data) => {
        if (!cancelled) setBlocks(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setBlocksError(e instanceof Error ? e.message : 'Could not load knowledge content.');
      })
      .finally(() => {
        if (!cancelled) setBlocksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  function handleSaved(updated: LiveKnowledgeContentBlock): void {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }

  const blocksInScope = blocks.filter((b) => blockInScope(b, session.locationId));
  const hasAnyKnowledge = blocksInScope.length > 0;

  // §15.2 change requests + version history — real (dashboard-api `knowledge_requests`).
  // VIEWER never sees this section, so never fetches it either (matches the server-side gate).
  const [requests, setRequests] = useState<readonly LiveKnowledgeChangeRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(viewRequestsAllowed);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  useEffect(() => {
    if (!viewRequestsAllowed) {
      setRequestsLoading(false);
      return;
    }
    let cancelled = false;
    setRequestsLoading(true);
    setRequestsError(null);
    fetchLiveKnowledgeRequests(session)
      .then((data) => {
        if (!cancelled) setRequests(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setRequestsError(e instanceof Error ? e.message : 'Could not load change requests.');
      })
      .finally(() => {
        if (!cancelled) setRequestsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, viewRequestsAllowed]);

  function handleSubmitted(request: LiveKnowledgeChangeRequest): void {
    setRequests((prev) => [request, ...prev]);
    setActiveStatusTab('requested');
    setRequestsPage(1);
  }

  const [changingId, setChangingId] = useState<string | null>(null);
  const [statusChangeError, setStatusChangeError] = useState<string | null>(null);

  async function handleStatusChange(requestId: string, status: KnowledgeRequestStatus): Promise<void> {
    setChangingId(requestId);
    setStatusChangeError(null);
    try {
      const updated = await updateLiveKnowledgeRequestStatus(session, requestId, status);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setStatusChangeError(e instanceof Error ? e.message : 'Could not update status.');
    } finally {
      setChangingId(null);
    }
  }

  const [activeStatusTab, setActiveStatusTab] = useState<KnowledgeRequestStatus>('requested');
  const requestsForTab = useMemo(
    () => requests.filter((r) => r.status === activeStatusTab),
    [requests, activeStatusTab],
  );

  const [requestsPage, setRequestsPage] = useState(1);
  const requestsPageCount = Math.max(1, Math.ceil(requestsForTab.length / REQUESTS_PAGE_SIZE));

  // Reset to page 1 whenever the tab changes or the filtered list shrinks (e.g. a refetch
  // returns fewer rows) — only a genuinely out-of-range page needs correcting.
  useEffect(() => {
    setRequestsPage(1);
  }, [activeStatusTab]);
  useEffect(() => {
    setRequestsPage((p) => Math.min(p, requestsPageCount));
  }, [requestsPageCount]);

  const currentRequestsPage = Math.min(requestsPage, requestsPageCount);
  const pagedRequests = useMemo(
    () => requestsForTab.slice((currentRequestsPage - 1) * REQUESTS_PAGE_SIZE, currentRequestsPage * REQUESTS_PAGE_SIZE),
    [requestsForTab, currentRequestsPage],
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Agent Knowledge"
        description="Everything the agents tell your customers, across all eight knowledge categories."
      />

      {/* §15.1 — the knowledge view. All eight categories, iterated from KNOWLEDGE_CATEGORIES. */}
      <section className="flex flex-col gap-6" aria-label="Knowledge categories">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
          <BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Knowledge view
        </h2>

        {blocksLoading ? (
          <p className="text-sm text-muted-foreground">Loading knowledge content…</p>
        ) : blocksError ? (
          <p className="text-sm text-destructive">{blocksError}</p>
        ) : !hasAnyKnowledge ? (
          <EmptyState
            title="No knowledge configured yet"
            description="Once this business's services, pricing, hours, and other knowledge are loaded, they appear here across all eight categories."
          />
        ) : (
          KNOWLEDGE_CATEGORIES.map((category) => {
            const categoryLabel = KNOWLEDGE_CATEGORY_LABELS[category];
            const categoryBlocks = blocksInScope.filter((b) => b.category === category);
            const orgWide = categoryBlocks.filter((b) => b.locationId === null);
            const perLocation = categoryBlocks.filter((b) => b.locationId !== null);

            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{categoryLabel}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {categoryBlocks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No entries configured for this category yet.
                    </p>
                  ) : (
                    <>
                      {orgWide.map((block) => (
                        <KnowledgeBlockView
                          key={block.id}
                          block={block}
                          category={category}
                          categoryLabel={categoryLabel}
                          locationName={null}
                          canEdit={editAllowed}
                          canRequest={requestAllowed}
                          onSubmitted={handleSubmitted}
                          onSaved={handleSaved}
                        />
                      ))}
                      {perLocation.map((block) => (
                        <KnowledgeBlockView
                          key={block.id}
                          block={block}
                          category={category}
                          categoryLabel={categoryLabel}
                          locationName={block.locationId ? locationName(block.locationId) : null}
                          canEdit={editAllowed}
                          canRequest={requestAllowed}
                          onSubmitted={handleSubmitted}
                          onSaved={handleSaved}
                        />
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      {/* §15.2 — change requests, status tracking, and version history. VIEWER never sees this. */}
      {viewRequestsAllowed ? (
        <section className="flex flex-col gap-4" aria-label="Change requests and version history">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
            <History className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Change requests &amp; version history
          </h2>
          <p className="text-sm text-muted-foreground">
            Every state change (Requested → Scheduled → Live) notifies the requester. Notification
            delivery is stubbed in this demo.
          </p>

          {requestsLoading ? (
            <p className="text-sm text-muted-foreground">Loading change requests…</p>
          ) : requestsError ? (
            <p className="text-sm text-destructive">{requestsError}</p>
          ) : requests.length === 0 ? (
            <EmptyState
              title="No change requests yet"
              description="When someone requests a knowledge update, it appears here with its current status and full version history."
            />
          ) : (
            <div className="flex flex-col gap-4">
              <Tabs value={activeStatusTab} onValueChange={(v) => setActiveStatusTab(v as KnowledgeRequestStatus)}>
                <TabsList label="Filter by status">
                  {KNOWLEDGE_REQUEST_STATUSES.map((status) => (
                    <TabsTrigger key={status} value={status}>
                      {KNOWLEDGE_REQUEST_STATUS_LABELS[status]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {statusChangeError ? <p className="text-sm text-destructive">{statusChangeError}</p> : null}

              {requestsForTab.length === 0 ? (
                <EmptyState
                  title={`No ${KNOWLEDGE_REQUEST_STATUS_LABELS[activeStatusTab].toLowerCase()} requests`}
                  description="Requests appear here once they reach this status."
                />
              ) : (
                <>
                  {pagedRequests.map((req) => (
                    <Card key={req.id}>
                      <CardContent className="flex flex-col gap-4 pt-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium text-foreground">{req.proposedChange}</p>
                            <p className="text-sm text-muted-foreground">
                              {categoryLabelFor(req.category)} · {req.reason}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Requested by {req.requestedBy} · {formatDateTime(req.requestedAtUtc, tz)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {manageRequestsAllowed ? (
                              <Select
                                value={req.status}
                                onValueChange={(value) => void handleStatusChange(req.id, value as KnowledgeRequestStatus)}
                                options={STATUS_OPTIONS}
                                disabled={changingId === req.id}
                                aria-label={`Status for ${categoryLabelFor(req.category)} request`}
                              />
                            ) : (
                              <KnowledgeRequestStatusChip status={req.status} />
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 border-t border-border pt-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Version history
                          </p>
                          <ol className="flex flex-col gap-2">
                            {req.history.map((h, i) => (
                              <li key={`${h.status}-${i}`} className="flex items-center gap-3">
                                <KnowledgeRequestStatusChip status={h.status} />
                                <span className="text-xs text-muted-foreground">{formatDateTime(h.at, tz)}</span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Showing {(currentRequestsPage - 1) * REQUESTS_PAGE_SIZE + 1}–
                      {Math.min(currentRequestsPage * REQUESTS_PAGE_SIZE, requestsForTab.length)} of {requestsForTab.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentRequestsPage <= 1}
                        onClick={() => setRequestsPage(currentRequestsPage - 1)}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <span className="tabular-nums">
                        Page {currentRequestsPage} of {requestsPageCount}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentRequestsPage >= requestsPageCount}
                        onClick={() => setRequestsPage(currentRequestsPage + 1)}
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
