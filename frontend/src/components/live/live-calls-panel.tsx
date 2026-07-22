'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { LiveTranscriptTurnList } from '@/components/live/live-transcript-turns';
import { LiveTranscriptPreview } from '@/components/live/live-transcript-preview';
import { type LiveTranscriptTurn } from '@/components/live/live-transcript';
import { formatDateTime, displayTimezone, formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CallInteractionView, GatedRows, Session } from '@/mock/data-access';
import { recordTranscriptView } from '@/lib/audit-live';
import { useSession } from '@/shared/session-context';
import { AGENT_LABELS } from '@/shared/status-models';

type TranscriptTurn = LiveTranscriptTurn;

function callerName(call: CallInteractionView): string {
  if (call.partyType === 'plumber' && call.plumber) return call.plumber.name;
  const identity = call.contact?.identity;
  if (!identity) return 'Unknown caller';
  return `${identity.firstName} ${identity.lastName}`.trim();
}

function getActiveCalls(snapshot: GatedRows<CallInteractionView> | null): readonly CallInteractionView[] {
  if (!snapshot || snapshot.kind !== 'rows') return [];
  return [...snapshot.rows]
    .filter((call) => call.disposition === 'in_progress')
    .sort((a, b) => new Date(b.atUtc).getTime() - new Date(a.atUtc).getTime());
}

function findCallById(snapshot: GatedRows<CallInteractionView> | null, callId: string): CallInteractionView | null {
  if (!snapshot || snapshot.kind !== 'rows') return null;
  return snapshot.rows.find((call) => call.id === callId) ?? null;
}

export function LiveCallsPanel({
  snapshot,
  session,
  title = 'Active calls',
  description = 'Live calls and the latest complete transcript turns.',
  refreshedAtLabel,
  className,
  cardHref,
}: {
  snapshot: GatedRows<CallInteractionView> | null;
  session: Session;
  title?: string;
  description?: string;
  refreshedAtLabel?: string;
  className?: string;
  cardHref?: string;
}): React.JSX.Element {
  const { org } = useSession();
  const displayTimeZone = displayTimezone(session, org);
  const [open, setOpen] = useState(false);
  const [completedDrainIds, setCompletedDrainIds] = useState<ReadonlySet<string>>(() => new Set());
  const auditedIdsRef = useRef<Set<string>>(new Set());
  const heldLiveCallIdRef = useRef<string | null>(null);

  const activeCalls = useMemo(() => getActiveCalls(snapshot), [snapshot]);
  const totalLive = snapshot?.kind === 'aggregate' ? snapshot.total : activeCalls.length;
  const latestCall = activeCalls[0] ?? null;

  if (latestCall) {
    heldLiveCallIdRef.current = latestCall.id;
  }

  const drainCallId =
    latestCall === null &&
    heldLiveCallIdRef.current !== null &&
    !completedDrainIds.has(heldLiveCallIdRef.current)
      ? heldLiveCallIdRef.current
      : null;

  const previewCall = latestCall ?? (drainCallId ? findCallById(snapshot, drainCallId) : null);
  const previewTranscript = (previewCall?.media?.transcript ?? []) as readonly TranscriptTurn[];
  const isDrainingTranscript = drainCallId !== null && latestCall === null;

  const handleDrainComplete = useCallback(() => {
    if (!drainCallId) return;
    setCompletedDrainIds((prev) => new Set([...prev, drainCallId]));
    heldLiveCallIdRef.current = null;
  }, [drainCallId]);

  useEffect(() => {
    if (!open) {
      auditedIdsRef.current = new Set();
      return;
    }

    for (const call of activeCalls) {
      if (auditedIdsRef.current.has(call.id)) continue;
      auditedIdsRef.current.add(call.id);
      // Gated transcript access is expected to fail (403) quietly outside role access.
      void recordTranscriptView(call.id).catch(() => undefined);
    }
  }, [activeCalls, open]);

  return (
    <>
      <Card className={cn('overflow-hidden border-border/80 shadow-sm', className)}>
        {cardHref ? (
          <Link
            href={cardHref}
            aria-label={`${title} - open calls`}
            className="block w-full text-left outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-muted-foreground">{title}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-semibold tabular-nums text-foreground">{totalLive.toLocaleString()}</span>
                    <Badge variant="outline" className="gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground" aria-hidden="true" />
                      Live
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="mt-1 h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-4">
                {!snapshot ? (
                  <p className="text-sm text-muted-foreground">Loading live calls…</p>
                ) : snapshot.kind === 'aggregate' ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">Transcript preview unavailable</p>
                    <p className="text-sm text-muted-foreground">
                      This workspace is in restricted mode, so only the live count is available.
                    </p>
                  </div>
                ) : previewCall ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{callerName(previewCall)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{AGENT_LABELS[previewCall.agent]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDuration(previewCall.durationSeconds)}</span>
                      {isDrainingTranscript ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Wrapping up</span>
                        </>
                      ) : null}
                    </div>
                    {previewTranscript.length > 0 ? (
                      <LiveTranscriptPreview
                        turns={previewTranscript}
                        callId={previewCall.id}
                        finalizePending={isDrainingTranscript}
                        onDrainComplete={handleDrainComplete}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Waiting for the first transcript turns.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No calls are currently in progress.</p>
                )}
              </div>

              {refreshedAtLabel ? <p className="text-xs text-muted-foreground">Updated {refreshedAtLabel}</p> : null}
            </div>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="block w-full text-left outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-muted-foreground">{title}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-semibold tabular-nums text-foreground">{totalLive.toLocaleString()}</span>
                    <Badge variant="outline" className="gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-foreground" aria-hidden="true" />
                      Live
                    </Badge>
                  </div>
                </div>
                <ChevronRight className="mt-1 h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-4">
                {!snapshot ? (
                  <p className="text-sm text-muted-foreground">Loading live calls…</p>
                ) : snapshot.kind === 'aggregate' ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-foreground">Transcript preview unavailable</p>
                    <p className="text-sm text-muted-foreground">
                      This workspace is in restricted mode, so only the live count is available.
                    </p>
                  </div>
                ) : previewCall ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{callerName(previewCall)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{AGENT_LABELS[previewCall.agent]}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDuration(previewCall.durationSeconds)}</span>
                      {isDrainingTranscript ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Wrapping up</span>
                        </>
                      ) : null}
                    </div>
                    {previewTranscript.length > 0 ? (
                      <LiveTranscriptPreview
                        turns={previewTranscript}
                        callId={previewCall.id}
                        finalizePending={isDrainingTranscript}
                        onDrainComplete={handleDrainComplete}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Waiting for the first transcript turns.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No calls are currently in progress.</p>
                )}
              </div>

              {refreshedAtLabel ? <p className="text-xs text-muted-foreground">Updated {refreshedAtLabel}</p> : null}
            </div>
          </button>
        )}
      </Card>

      <Drawer
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        className="max-w-[760px]"
      >
        {!snapshot ? (
          <p className="text-sm text-muted-foreground">Loading live calls…</p>
        ) : snapshot.kind === 'aggregate' ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              This workspace is in restricted mode, so live transcript text is not available.
            </p>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Active calls</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{totalLive.toLocaleString()}</p>
            </div>
          </div>
        ) : activeCalls.length === 0 && !drainCallId ? (
          <p className="text-sm text-muted-foreground">There are no active calls right now.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {[
              ...activeCalls,
              ...(drainCallId && !activeCalls.some((call) => call.id === drainCallId)
                ? [findCallById(snapshot, drainCallId)].filter((call): call is CallInteractionView => call !== null)
                : []),
            ].map((call) => {
              const transcript = (call.media?.transcript ?? []) as readonly TranscriptTurn[];
              const isDraining = call.id === drainCallId && call.disposition !== 'in_progress';

              return (
                <section key={call.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-base font-semibold tracking-tight text-foreground">{callerName(call)}</h3>
                      <p className="text-sm text-muted-foreground">
                        {AGENT_LABELS[call.agent]} · {call.direction === 'inbound' ? 'Inbound' : 'Outbound'} ·{' '}
                        {formatDateTime(call.atUtc, displayTimeZone)}
                      </p>
                    </div>
                    <Link
                      href={`/conversations/calls?interaction=${call.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
                    >
                      Open in Calls
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </div>

                  <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs text-muted-foreground">Live duration</dt>
                      <dd className="text-sm font-medium text-foreground">{formatDuration(call.durationSeconds)}</dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs text-muted-foreground">Location</dt>
                      <dd className="text-sm font-medium text-foreground">{call.locationName ?? call.locationId}</dd>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-xs text-muted-foreground">Transcript status</dt>
                      <dd className="text-sm font-medium text-foreground">
                        {transcript.length > 0 ? `${transcript.length} turns captured` : 'Waiting for transcript turns'}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4">
                    {call.media ? (
                      transcript.length > 0 ? (
                        <LiveTranscriptTurnList
                          turns={transcript}
                          timeZone={displayTimeZone}
                          finalizePending={isDraining}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">Transcript is still streaming in.</p>
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">Transcript is not available for this role or mode.</p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </Drawer>
    </>
  );
}
