'use client';

/**
 * §5.5 Dispatch drawer. Sections in the spec's order:
 *  1. Job Summary            5. Outreach Attempts (recording + transcript when projected)
 *  2. Match Criteria         6. Assignment Summary
 *  3. Current Assignment     7. Status Timeline
 *  4. Eligible Plumbers      8. Notes
 *
 * Row actions (§5.5): Start Outreach / Retry Outreach, Assign Manually, Change Candidate,
 * Escalate, Add Note, Mark Exhausted, Open Job. The whole actions block is gated on
 * `canAct` — a Viewer sees none of it.
 */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, Flag } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { RecordingPlayer, validRecordingUrl } from '@/components/ui/recording-player';
import { Select, type SelectOption } from '@/components/ui/select';
import { AssignmentStatusChip, OutreachOutcomeChip, PriorityChip } from '@/components/ui/status-chip';
import { formatDateTime, formatDuration, formatPercent } from '@/lib/format';
import type { CallInteractionView, Session } from '@/mock/data-access';
import type { Plumber } from '@/mock/schema';
import { recordRecordingPlayback, recordTranscriptView } from '@/lib/audit-live';
import { submitFlag } from '@/shared/flag-store';
import {
  ISSUE_TYPE_LABELS,
  PLUMBER_AVAILABILITY_LABELS,
  SPECIALTY_LABELS,
} from '@/shared/status-models';
import { formatWindow } from '@/app/(dashboard)/jobs/types';
import type { DisplayTimelineEntry, DispatchOverride, DispatchRowVM } from './types';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}

function OutreachAttemptLog({
  row,
  session,
  plumbersById,
  resolveCall,
}: {
  row: DispatchRowVM;
  session: Session;
  plumbersById: ReadonlyMap<string, Plumber>;
  resolveCall: (interactionId: string) => CallInteractionView | undefined;
}) {
  const [transcripts, setTranscripts] = useState<Record<string, boolean>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});

  const attempts = row.record.attempts;
  if (attempts.length === 0) {
    return <p className="text-sm text-muted-foreground">No outreach attempts yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {attempts.map((attempt, i) => {
        const call = attempt.interactionId ? resolveCall(attempt.interactionId) : undefined;
        const media = call?.media ?? null;
        const recordingUrl = validRecordingUrl(media?.recordingUrl);
        const showTranscript = attempt.interactionId ? transcripts[attempt.interactionId] : false;
        const plumberName = plumbersById.get(attempt.plumberId)?.name ?? 'Plumber';

        const handleTranscript = () => {
          if (!attempt.interactionId) return;
          setTranscripts((t) => ({ ...t, [attempt.interactionId as string]: true }));
          void recordTranscriptView(attempt.interactionId).catch(() => undefined);
        };

        return (
          <li key={`${attempt.at}-${i}`} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">
                Attempt {attempt.attemptNumber} · {plumberName}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatDateTime(attempt.at, row.timezone)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <OutreachOutcomeChip outcome={attempt.outcome} />
              {attempt.callDurationSeconds !== null ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDuration(attempt.callDurationSeconds)}
                </span>
              ) : null}
            </div>

            {attempt.interactionId ? (
              <div className="mt-2">
                {flagged[attempt.interactionId] ? (
                  <p className="inline-flex items-center gap-1.5 text-xs text-foreground">
                    <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                    Flagged for quality review.
                  </p>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Flag the outreach call to ${plumberName} for review`}
                    onClick={() => {
                      const interactionId = attempt.interactionId;
                      if (!interactionId) return;
                      submitFlag({
                        orgId: session.orgId,
                        interactionId,
                        submittedBy: session.actor,
                        reason: `Flagged from dispatch record ${row.record.id} by ${session.actor}`,
                      });
                      setFlagged((f) => ({ ...f, [interactionId]: true }));
                    }}
                  >
                    <Flag className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    Flag this interaction
                  </Button>
                )}
              </div>
            ) : null}

            {media ? (
              <div className="mt-3 flex flex-col gap-2">
                {recordingUrl ? (
                  <RecordingPlayer
                    recordingUrl={recordingUrl}
                    label={`Outreach recording, attempt ${attempt.attemptNumber}`}
                    onPlay={() => void recordRecordingPlayback(attempt.interactionId ?? row.record.id).catch(() => undefined)}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Recording unavailable. The transcript remains available.</p>
                )}
                <Button variant="outline" size="sm" onClick={handleTranscript} className="w-fit">
                  <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  View transcript
                </Button>
                {showTranscript ? (
                  <div className="max-h-48 overflow-y-auto rounded-md bg-muted p-3 text-xs">
                    {media.transcript.map((turn, ti) => (
                      <p key={ti} className="mb-1.5 last:mb-0">
                        <span className="font-semibold text-foreground">
                          {turn.speaker === 'agent' ? 'Agent: ' : 'Plumber: '}
                        </span>
                        <span className="text-muted-foreground">{turn.text}</span>
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function StatusTimeline({ entries, timezone }: { entries: readonly DisplayTimelineEntry[]; timezone: string }) {
  return (
    <ol className="flex flex-col gap-2 border-l border-border pl-4">
      {entries.map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-border" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-2">
            <AssignmentStatusChip status={e.status} />
            <span className="text-xs text-muted-foreground tabular-nums">{formatDateTime(e.at, timezone)}</span>
            <span className="text-xs text-muted-foreground">· {e.actor}</span>
          </div>
          {e.note ? <p className="mt-0.5 text-xs text-muted-foreground">{e.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function DispatchDrawer({
  row,
  override,
  open,
  onOpenChange,
  session,
  canAct,
  plumbers,
  resolveCall,
  onRetry,
  onAssignManually,
  onChangeCandidate,
  onEscalate,
  onMarkExhausted,
  onAddNote,
}: {
  row: DispatchRowVM;
  override: DispatchOverride | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session;
  canAct: boolean;
  plumbers: readonly Plumber[];
  resolveCall: (interactionId: string) => CallInteractionView | undefined;
  onRetry: (id: string) => void;
  onAssignManually: (id: string, plumberId: string) => void;
  onChangeCandidate: (id: string, plumberId: string) => void;
  onEscalate: (id: string, assignee: string) => void;
  onMarkExhausted: (id: string) => void;
  onAddNote: (id: string, body: string) => void;
}) {
  const [manualPlumberId, setManualPlumberId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [assignee, setAssignee] = useState('');
  const [note, setNote] = useState('');

  const rec = row.record;
  const job = rec.job;
  const plumbersById = useMemo(() => new Map(plumbers.map((p) => [p.id, p])), [plumbers]);

  const eligiblePlumbers = useMemo(
    () => rec.eligiblePlumberIds.map((id) => plumbersById.get(id)).filter((p): p is Plumber => Boolean(p)),
    [rec.eligiblePlumberIds, plumbersById],
  );

  const eligibleOptions: readonly SelectOption[] = eligiblePlumbers.map((p) => ({ value: p.id, label: p.name }));

  const timeline = useMemo<DisplayTimelineEntry[]>(() => {
    const base: DisplayTimelineEntry[] = rec.statusTimeline.map((t) => ({
      at: t.at,
      status: t.status,
      actor: t.actor,
    }));
    const extra = override?.extraTimeline ?? [];
    return [...base, ...extra].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [rec.statusTimeline, override?.extraTimeline]);

  const notes = useMemo(() => {
    const server = rec.notes.map((n) => ({ at: n.at, body: n.body }));
    const extra = override?.extraNotes ?? [];
    return [...server, ...extra].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [rec.notes, override?.extraNotes]);

  const isActive = ['unassigned', 'matching', 'contacting', 'awaiting_response'].includes(row.effectiveStatus);
  const acceptedBy = row.effectivePlumberName;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={row.customerName}
      description={`${row.jobReference} · ${row.issueJobType}`}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <AssignmentStatusChip status={row.effectiveStatus} />
          <PriorityChip priority={row.priority} />
          {rec.escalationId ? <Badge variant="destructive">Linked escalation</Badge> : null}
        </div>

        {/* 1. Job Summary */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Job summary</SectionTitle>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Job reference" value={row.jobReference} />
            <Field label="Customer" value={row.customerName} />
            <Field label="Issue type" value={job ? ISSUE_TYPE_LABELS[job.issueType] : '—'} />
            <Field label="Job type" value={job?.jobType ?? '—'} />
            <Field label="Service address" value={rec.contact.serviceAddress} />
            <Field label="Requested service window" value={row.requestedWindowLabel} />
          </dl>
          {job ? (
            <Link
              href={`/jobs?jobId=${job.id}`}
              className="inline-flex items-center gap-1.5 text-sm text-foreground hover:underline"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open Job
            </Link>
          ) : null}
        </section>

        {/* 2. Match Criteria */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Match criteria</SectionTitle>
          <dl className="grid grid-cols-2 gap-3">
            <Field label="Required specialty" value={SPECIALTY_LABELS[rec.requiredSpecialty]} />
            <Field label="Service area" value={row.serviceAreaName} />
            <Field label="ZIP code" value={rec.zip} />
            <Field label="Business location" value={row.locationName} />
          </dl>
        </section>

        {/* 3. Current Assignment */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Current assignment</SectionTitle>
          <dl className="grid grid-cols-2 gap-3">
            <Field label="Assignment status" value={<AssignmentStatusChip status={row.effectiveStatus} />} />
            <Field label="Current candidate" value={row.effectiveCandidateName ?? '—'} />
            <Field label="Assigned plumber" value={acceptedBy ?? '—'} />
            <Field label="Started" value={formatDateTime(rec.startedAtUtc, row.timezone)} />
          </dl>
        </section>

        {/* 4. Eligible Plumbers */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Eligible plumbers</SectionTitle>
          {eligiblePlumbers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No eligible plumbers found. Review the required specialty and service area, then escalate for manual
              handling.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {eligiblePlumbers.map((p) => (
                <li key={p.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                    <Badge variant={p.availability === 'available' ? 'outline' : 'secondary'}>
                      {PLUMBER_AVAILABILITY_LABELS[p.availability]}
                    </Badge>
                  </div>
                  <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
                    <div>
                      <dt className="inline">Specialty match: </dt>
                      <dd className="inline font-medium text-foreground">
                        {p.specialties.includes(rec.requiredSpecialty) ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Area match: </dt>
                      <dd className="inline font-medium text-foreground">
                        {p.serviceAreaIds.includes(rec.serviceAreaId) ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Active jobs: </dt>
                      <dd className="inline font-medium tabular-nums text-foreground">{p.activeJobs}</dd>
                    </div>
                    <div>
                      <dt className="inline">Acceptance: </dt>
                      <dd className="inline font-medium tabular-nums text-foreground">
                        {formatPercent(p.acceptanceRate)}
                      </dd>
                    </div>
                  </dl>
                  {p.lastContactedUtc ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last contacted {formatDateTime(p.lastContactedUtc, row.timezone)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 5. Outreach Attempts */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Outreach attempts</SectionTitle>
          <OutreachAttemptLog row={row} session={session} plumbersById={plumbersById} resolveCall={resolveCall} />
        </section>

        {/* 6. Assignment Summary */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Assignment summary</SectionTitle>
          {acceptedBy && rec.acceptedAtUtc ? (
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Accepted by" value={acceptedBy} />
              <Field label="Acceptance time" value={formatDateTime(rec.acceptedAtUtc, row.timezone)} />
              <Field
                label="Scheduled arrival window"
                value={rec.scheduledWindow ? formatWindow(rec.scheduledWindow, row.timezone) : 'Not yet confirmed'}
              />
              <Field
                label="Resolution"
                value={`Assigned after ${row.attemptsCount} outreach attempt${row.attemptsCount === 1 ? '' : 's'}.`}
              />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              {row.effectiveStatus === 'exhausted'
                ? 'Dispatch exhausted — no eligible plumber accepted within the attempt window. A linked escalation requires human ownership.'
                : 'No plumber has accepted this job yet.'}
            </p>
          )}
        </section>

        {/* 7. Status Timeline */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Status timeline</SectionTitle>
          <StatusTimeline entries={timeline} timezone={row.timezone} />
        </section>

        {/* 8. Notes */}
        <section className="flex flex-col gap-2">
          <SectionTitle>Notes</SectionTitle>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            notes.map((n, i) => (
              <div key={`${n.at}-${i}`} className="rounded-md border border-border p-3 text-sm">
                <p className="text-xs text-muted-foreground tabular-nums">{formatDateTime(n.at, row.timezone)}</p>
                <p className="mt-1 text-foreground">{n.body}</p>
              </div>
            ))
          )}
        </section>

        {canAct ? (
          <section className="flex flex-col gap-4 border-t border-border pt-4">
            <SectionTitle>Actions</SectionTitle>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => onRetry(rec.id)}>
                {row.attemptsCount === 0 ? 'Start Outreach' : 'Retry Outreach'}
              </Button>
              {isActive ? (
                <Button variant="outline" onClick={() => onMarkExhausted(rec.id)}>
                  Mark Exhausted
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" id={`assign-${rec.id}`}>
                Assign Manually
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Plumber to assign"
                  value={manualPlumberId}
                  onValueChange={setManualPlumberId}
                  options={[{ value: '', label: 'Choose a plumber…' }, ...eligibleOptions]}
                />
                <Button
                  variant="secondary"
                  disabled={manualPlumberId === ''}
                  onClick={() => {
                    onAssignManually(rec.id, manualPlumberId);
                    setManualPlumberId('');
                  }}
                >
                  Assign Manually
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" id={`candidate-${rec.id}`}>
                Change Candidate
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label="Next candidate to contact"
                  value={candidateId}
                  onValueChange={setCandidateId}
                  options={[{ value: '', label: 'Choose a candidate…' }, ...eligibleOptions]}
                />
                <Button
                  variant="secondary"
                  disabled={candidateId === ''}
                  onClick={() => {
                    onChangeCandidate(rec.id, candidateId);
                    setCandidateId('');
                  }}
                >
                  Change Candidate
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`escalate-${rec.id}`}>
                Escalate to a team member
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id={`escalate-${rec.id}`}
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="Team member"
                  className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                />
                <Button
                  variant="secondary"
                  disabled={assignee.trim() === ''}
                  onClick={() => {
                    onEscalate(rec.id, assignee.trim());
                    setAssignee('');
                  }}
                >
                  Escalate
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`note-${rec.id}`}>
                Add Note
              </label>
              <textarea
                id={`note-${rec.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                placeholder="Append a note to this dispatch record…"
              />
              <div>
                <Button
                  variant="secondary"
                  disabled={note.trim() === ''}
                  onClick={() => {
                    onAddNote(rec.id, note.trim());
                    setNote('');
                  }}
                >
                  Add Note
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}
