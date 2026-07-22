'use client';

/**
 * §10.2 Chats sub-view body. The page header, sub-view tabs and shared filter bar live in
 * `conversations/layout.tsx`; this component renders the thread list, the thread-detail
 * drawer, and the degraded/empty states.
 *
 * Thread list columns (§10.2): purpose · channel · last message time · session
 * outcome · message count.
 *
 * Data source: live support-chat sessions from the dashboard API (customer-support-chat widget).
 */

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ChevronLeft, ChevronRight, MessageSquareOff } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { ExportCsvButton, ListExportRow } from '@/components/ui/export-csv-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { TablePageSkeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  RowOpenButton, } from '@/components/ui/table';
import { formatCount, formatDateTime, timezoneFor } from '@/lib/format';
import { useLiveChats } from '@/hooks/use-dashboard-live';
import type { ChatInteractionView } from '@/mock/data-access';
import { canExport } from '@/mock/data-access';
import { getFlagsServerSnapshot, getRuntimeFlags, isFlagged, submitFlag, subscribeToFlags } from '@/shared/flag-store';
import { useSession } from '@/shared/session-context';
import { CHAT_CHANNEL_LABELS } from '@/shared/status-models';
import Link from 'next/link';
import { buildChatsCsv } from '@/app/(dashboard)/reports/csv';
import { filtersToParams, runCsvExport } from '@/lib/csv-export';

import { useConversationFilters } from '../_components/conversations-provider';
import { matchesGradeBand, withinDateRange } from '../_components/filters';
import { ChatDrawer } from './chat-drawer';
import { CHAT_OUTCOME_LABELS, chatCustomerDisplayName, chatPurposeLabel } from './chat-display';

const PAGE_SIZE = 15;

export function ChatsClient(): React.JSX.Element {
  const { session, showLocationFilter } = useSession();
  const { filters } = useConversationFilters();
  const { data: liveChats, error: loadError, isLoading } = useLiveChats();
  const gated = liveChats?.gated ?? null;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [exportError, setExportError] = useState<string | null>(null);
  const canExportRows = canExport(session);

  useSyncExternalStore(subscribeToFlags, () => getRuntimeFlags(session.orgId), getFlagsServerSnapshot);

  const baseRows = useMemo<readonly ChatInteractionView[]>(
    () => (gated?.kind === 'rows' ? gated.rows : []),
    [gated],
  );

  const filtered = useMemo<readonly ChatInteractionView[]>(() => {
    const q = filters.search.trim().toLowerCase();
    const rows = baseRows.filter((chat) => {
      if (filters.channel !== 'all' && chat.channel !== filters.channel) return false;
      if (filters.locationId !== 'all' && chat.locationId !== filters.locationId) return false;
      if (!matchesGradeBand(chat.grade?.overall ?? null, filters.gradeBand)) return false;
      if (
        !withinDateRange(chat.lastMessageAtUtc, timezoneFor(session.orgId, chat.locationId), filters.dateFrom, filters.dateTo)
      )
        return false;

      if (q) {
        const purpose = chatPurposeLabel(chat).toLowerCase();
        const hay = [purpose, chat.intent, chatCustomerDisplayName(chat), chat.linked.jobId ?? '']
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...rows].sort((a, b) => new Date(b.lastMessageAtUtc).getTime() - new Date(a.lastMessageAtUtc).getTime());
  }, [baseRows, filters, session.orgId]);

  const exportFilterParams = useMemo(() => filtersToParams({ ...filters, view: 'chats' }), [filters]);

  const handleExport = useCallback(() => {
    void runCsvExport(
      session,
      'chats',
      filtered.length,
      exportFilterParams,
      `chats-${new Date().toISOString().slice(0, 10)}.csv`,
      buildChatsCsv(filtered, session.orgId),
    ).then(setExportError);
  }, [session, filtered, exportFilterParams]);

  useEffect(() => {
    setPage(1);
  }, [filtered]);

  const selected = selectedId ? baseRows.find((c) => c.id === selectedId) ?? null : null;

  const handleFlag = (reason: string, context: string) => {
    if (!selected) return;
    submitFlag({
      orgId: session.orgId,
      interactionId: selected.id,
      submittedBy: session.actor,
      reason: context.trim() ? `${reason}: ${context.trim()}` : reason,
    });
  };

  if (isLoading && !gated) {
    return <TablePageSkeleton label="Loading support chats..." rows={8} />;
  }

  if (loadError) {
    return (
      <Banner variant="destructive" title="Could not load chats">
        {loadError}
      </Banner>
    );
  }

  if (gated?.kind === 'aggregate') {
    return (
      <div className="flex flex-col gap-4">
        <Banner variant="default" title="Aggregate view (restricted mode)">
          This workspace is in restricted mode, so chat-level threads and transcripts are not available. Only an aggregate
          count is shown.
        </Banner>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total chats in scope</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{gated.total}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (baseRows.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquareOff className="h-8 w-8" />}
        title="No chats yet"
        description="Customer conversations from Web Chat, SMS, and WhatsApp will appear here."
      />
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {exportError ? (
          <Banner variant="destructive" title="Export failed" onDismiss={() => setExportError(null)}>
            {exportError}
          </Banner>
        ) : null}
        {canExportRows ? (
          <ListExportRow>
            <ExportCsvButton onClick={handleExport} disabled />
          </ListExportRow>
        ) : null}
        <EmptyState
          icon={<MessageSquareOff className="h-8 w-8" />}
          title="No chats match these filters"
          description="Adjust or clear the filters above to see more chats."
        />
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      {exportError ? (
        <Banner variant="destructive" title="Export failed" onDismiss={() => setExportError(null)}>
          {exportError}
        </Banner>
      ) : null}

      {canExportRows ? (
        <ListExportRow>
          <ExportCsvButton onClick={handleExport} disabled={filtered.length === 0} />
        </ListExportRow>
      ) : null}

      <div className="rounded-lg border border-border bg-card">
        <Table caption="Chat threads, one row per session, most recent activity first.">
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Last Message</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Messages</TableHead>
              <TableHead>Linked Job</TableHead>
              <TableHead>Human Handoff</TableHead>
              {showLocationFilter ? <TableHead>Business Location</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((chat) => {
              const tz = timezoneFor(session.orgId, chat.locationId);
              const customer = chatCustomerDisplayName(chat);

              return (
                <TableRow key={chat.id} onClick={() => setSelectedId(chat.id)}>
                  <TableCell className="max-w-[220px]">
                    <RowOpenButton onClick={() => setSelectedId(chat.id)} ariaLabel={`Open chat thread with ${customer}`}>
                      <span className="flex flex-col">
                        <span>{customer}</span>
                        <span className="text-xs text-muted-foreground">{chatPurposeLabel(chat)}</span>
                      </span>
                    </RowOpenButton>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{CHAT_CHANNEL_LABELS[chat.channel]}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(chat.lastMessageAtUtc, tz)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{CHAT_OUTCOME_LABELS[chat.outcome]}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatCount(chat.messageCount)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {chat.linked.jobId ? (
                      <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                        <Link
                          href={`/jobs?jobId=${chat.linked.jobId}`}
                          className="text-foreground underline underline-offset-2 hover:no-underline"
                          aria-label={`Open the job created from this chat with ${customer}`}
                        >
                          Job
                        </Link>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {chat.humanHandoff ? <Badge variant="outline">Yes</Badge> : <span className="text-muted-foreground">No</span>}
                  </TableCell>
                  {showLocationFilter ? (
                    <TableCell className="whitespace-nowrap text-muted-foreground">{chat.locationId}</TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {`Showing ${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
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

      {selected ? (
        <ChatDrawer
          chat={selected}
          session={session}
          flagged={isFlagged(session.orgId, selected.id)}
          onFlag={handleFlag}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </div>
  );
}
