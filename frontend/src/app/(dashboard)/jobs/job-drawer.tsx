'use client';

/**
 * §5.2 Job detail drawer. Sections in the spec's order:
 *  1. Job Record
 *  2. Originating Interaction
 *  3. Dispatch and Assignment
 *  4. Customer Communication
 *  5. Timeline
 *  6. Outcome (Mark En Route / In Progress / Completed / Cancel — only valid transitions)
 *  7. Staff Notes
 *  8. Flag for Review (reason selector + additional context)
 *
 * Built on the Drawer primitive (Radix Dialog: focus trap, Escape, ARIA). Drawer state is
 * local to the parent client.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Flag } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { MaskedValue } from '@/components/ui/masked-value';
import { Select, type SelectOption } from '@/components/ui/select';
import { AssignmentStatusChip, JobStatusChip, PriorityChip } from '@/components/ui/status-chip';
import { formatDateTime, timezoneFor } from '@/lib/format';
import { getLocationById } from '@/mock/orgs';
import { canPerformWorkflowActions, type JobView, type Session } from '@/mock/data-access';
import {
  INTAKE_CHANNEL_LABELS,
  ISSUE_TYPE_LABELS,
  JOB_CREATOR_LABELS,
  JOB_STATUS_LABELS,
  JOB_TRANSITIONS,
  LANGUAGE_LABELS,
  NOTIFICATION_DELIVERY_STATUS_LABELS,
  SPECIALTY_LABELS,
  type JobStatus,
} from '@/shared/status-models';

import { formatWindow } from './types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-4 first:border-t-0 first:pt-0">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

const NOTIFICATION_KIND_LABELS: Readonly<Record<string, string>> = {
  job_created_confirmation: 'Job-created confirmation',
  assignment_confirmation: 'Assignment confirmation',
  arrival_window_notification: 'Arrival-window notification',
  reschedule_notice: 'Reschedule notice',
  cancellation_notice: 'Cancellation notice',
};

const FLAG_REASONS: readonly SelectOption[] = [
  { value: 'wrong_details', label: 'Captured details were wrong' },
  { value: 'missed_emergency', label: 'Missed or mishandled an emergency' },
  { value: 'pricing_error', label: 'Quoted the wrong fee or price' },
  { value: 'tone', label: 'Tone or conversation quality' },
  { value: 'other', label: 'Other' },
];

export function JobDrawer({
  job,
  session,
  flagged,
  onStatusChange,
  onAddNote,
  onFlag,
  onClose,
}: {
  job: JobView;
  session: Session;
  flagged: boolean;
  onStatusChange: (to: JobStatus) => void;
  onAddNote: (body: string) => void;
  onFlag: (reason: string, context: string) => void;
  onClose: () => void;
}) {
  const [noteDraft, setNoteDraft] = useState('');
  const [flagReason, setFlagReason] = useState('wrong_details');
  const [flagContext, setFlagContext] = useState('');

  const tz = timezoneFor(session.orgId, job.locationId);
  const identity = job.contact.identity;
  const name = identity ? `${identity.firstName} ${identity.lastName}` : 'Customer';
  const locationName = job.locationName ?? getLocationById(session.orgId, job.locationId)?.name ?? job.locationId;
  const canAct = canPerformWorkflowActions(session);
  const dispatch = job.dispatch ?? null;

  // §5.2 Outcome: "Status actions are displayed only when valid for the current status."
  const legalNext = JOB_TRANSITIONS[job.status];
  const outcomeActions = (
    [
      { to: 'en_route', label: 'Mark En Route' },
      { to: 'in_progress', label: 'Mark In Progress' },
      { to: 'completed', label: 'Mark Completed' },
      { to: 'canceled', label: 'Cancel Job' },
    ] as const
  ).filter((a) => legalNext.includes(a.to));

  const submitNote = () => {
    const body = noteDraft.trim();
    if (body === '') return;
    onAddNote(body);
    setNoteDraft('');
  };

  return (
    <Drawer
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={name}
      description={`${job.jobType} · ${JOB_STATUS_LABELS[job.status]} · ${job.reference}`}
    >
      {/* 1. Job Record */}
      <Section title="Job record">
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Job reference">{job.reference}</Field>
          <Field label="Status">
            <JobStatusChip status={job.status} />
          </Field>
          <Field label="Customer">{name}</Field>
          <Field label="Phone">
            {identity ? <MaskedValue identity={identity} session={session} objectRef={`job:${job.id}`} /> : '—'}
          </Field>
          <Field label="Service address">{job.contact.serviceAddress}</Field>
          <Field label="ZIP code">{job.contact.zip}</Field>
          <Field label="Issue type">{ISSUE_TYPE_LABELS[job.issueType]}</Field>
          <Field label="Job type">{job.jobType}</Field>
          <Field label="Priority">
            <PriorityChip priority={job.priority} />
          </Field>
          <Field label="Intake channel">{INTAKE_CHANNEL_LABELS[job.intakeChannel]}</Field>
          <Field label="Requested service window">
            {job.requestedWindow ? formatWindow(job.requestedWindow, tz) : '—'}
          </Field>
          <Field label="Scheduled arrival window">
            {job.scheduledWindow ? formatWindow(job.scheduledWindow, tz) : 'Not yet confirmed'}
          </Field>
          <Field label="Language">{LANGUAGE_LABELS[job.language]}</Field>
          <Field label="Business location">{locationName}</Field>
        </dl>
        <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer description</p>
          <p className="mt-1 text-sm text-foreground">{job.customerDescription}</p>
        </div>
      </Section>

      {/* 2. Originating Interaction */}
      <Section title="Originating interaction">
        {job.originatingInteractionId ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">
              Created by {JOB_CREATOR_LABELS[job.createdBy]} · {formatDateTime(job.createdAtUtc, tz)}
            </p>
            <Link
              href={`/conversations/calls?interaction=${job.originatingInteractionId}`}
              className="inline-flex items-center gap-1.5 text-foreground hover:underline"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open Conversation — recording, transcript, and QA grade
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Created by {JOB_CREATOR_LABELS[job.createdBy]} · {formatDateTime(job.createdAtUtc, tz)}. No source call or
            chat is linked to this job.
          </p>
        )}
      </Section>

      {/* 3. Dispatch and Assignment */}
      <Section title="Dispatch and assignment">
        {dispatch ? (
          <>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Assignment status">
                <AssignmentStatusChip status={dispatch.status} />
              </Field>
              <Field label="Required specialty">{SPECIALTY_LABELS[dispatch.requiredSpecialty]}</Field>
              <Field label="Service area">{job.serviceAreaName ?? job.serviceAreaId}</Field>
              <Field label="Assigned plumber">{job.assignedPlumberName ?? 'Unassigned'}</Field>
              <Field label="Assignment timestamp">
                {dispatch.acceptedAtUtc ? formatDateTime(dispatch.acceptedAtUtc, tz) : '—'}
              </Field>
              <Field label="Outreach attempts">{dispatch.attempts.length}</Field>
            </dl>
            <Link
              href={`/dispatch-queue?dispatchId=${dispatch.id}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-foreground hover:underline"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open Dispatch Record
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">This job has not entered the Dispatch Queue.</p>
        )}
      </Section>

      {/* 4. Customer Communication */}
      <Section title="Customer communication">
        {job.notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No customer notifications have been sent for this job.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {job.notifications.map((n, i) => (
              <li key={`${n.at}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">{NOTIFICATION_KIND_LABELS[n.kind] ?? n.kind}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{formatDateTime(n.at, tz)}</span>
                  <Badge variant={n.deliveryStatus === 'sent' ? 'outline' : 'destructive'}>
                    {NOTIFICATION_DELIVERY_STATUS_LABELS[n.deliveryStatus]}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 5. Timeline */}
      <Section title="Timeline">
        <ol className="flex flex-col gap-3">
          {job.timeline.map((event, i) => (
            <li key={`${event.at}-${i}`} className="flex flex-col gap-0.5 border-l-2 border-border pl-3">
              <span className="text-sm font-medium text-foreground">{event.label}</span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(event.at, tz)} · {event.actor}
              </span>
            </li>
          ))}
        </ol>
      </Section>

      {/* 6. Outcome — only transitions legal from the current status. */}
      <Section title="Outcome">
        {canAct ? (
          outcomeActions.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {outcomeActions.map((action) => (
                  <Button key={action.to} variant="outline" size="sm" onClick={() => onStatusChange(action.to)}>
                    {action.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Status actions are shown only when valid for the current job status.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This job is {JOB_STATUS_LABELS[job.status]} — no further status actions are available.
            </p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Outcome actions require Dispatcher, Manager, or Owner access.</p>
        )}
      </Section>

      {/* 7. Staff Notes */}
      <Section title="Staff notes">
        {job.staffNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No staff notes yet.</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-3">
            {job.staffNotes.map((note, i) => (
              <li key={`${note.at}-${i}`} className="rounded-md border border-border p-3 text-sm">
                <p className="text-foreground">{note.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {note.author} · {formatDateTime(note.at, tz)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {canAct ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="staff-note" className="sr-only">
              Add a staff note
            </label>
            <textarea
              id="staff-note"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              placeholder="Add an append-only note…"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div>
              <Button size="sm" disabled={noteDraft.trim() === ''} onClick={submitNote}>
                Add note
              </Button>
            </div>
          </div>
        ) : null}
      </Section>

      {/* 8. Flag for Review — flags the originating interaction, not the job itself. */}
      <Section title="Flag for review">
        {flagged ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-foreground">
            <Flag className="h-4 w-4" aria-hidden="true" />
            Flagged for quality review.
          </p>
        ) : job.originatingInteractionId ? (
          <div className="flex flex-col gap-2">
            <Select
              aria-label="Flag reason"
              value={flagReason}
              onValueChange={setFlagReason}
              options={FLAG_REASONS}
            />
            <label htmlFor="flag-context" className="sr-only">
              Additional context
            </label>
            <textarea
              id="flag-context"
              value={flagContext}
              onChange={(e) => setFlagContext(e.target.value)}
              rows={2}
              placeholder="Additional context (optional)…"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div>
              <Button variant="outline" size="sm" onClick={() => onFlag(flagReason, flagContext)}>
                <Flag className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Flag Interaction
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This job has no originating call or chat, so there is no interaction to flag.
          </p>
        )}
      </Section>
    </Drawer>
  );
}
