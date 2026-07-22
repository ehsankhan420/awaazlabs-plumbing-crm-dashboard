'use client';

/**
 * §5.3 Call drawer. Sections in the spec's order:
 *  1. Call Record          5. Quality Grade (five-dimension breakdown)
 *  2. Recording            6. Linked Records (Job / Dispatch / Escalation / Review / Campaign)
 *  3. Transcript           7. Flag for Review (reason + additional context)
 *  4. Extracted Intake or Dispatch Data
 *
 * Gating is structural: a Viewer receives `media: null` from the data-access layer, so
 * there is no recordingUrl and no transcript to reach — the audio player and transcript
 * simply are not rendered (no disabled player, no faked waveform).
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ClipboardCheck, ExternalLink, Flag, Megaphone, Star, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Select, type SelectOption } from '@/components/ui/select';
import { RecordingPlayer, validRecordingUrl } from '@/components/ui/recording-player';
import { CallDispositionChip, PriorityChip } from '@/components/ui/status-chip';
import { formatDateTime, formatDuration, timezoneFor } from '@/lib/format';
import { getLocationById } from '@/mock/orgs';
import type { CallInteractionView, Session } from '@/mock/data-access';
import { recordRecordingPlayback, recordTranscriptView } from '@/lib/audit-live';
import {
  AGENT_LABELS,
  CALL_DISPOSITION_LABELS,
  ISSUE_TYPE_LABELS,
  OUTREACH_OUTCOME_LABELS,
  PARTY_TYPE_LABELS,
  SPECIALTY_LABELS,
} from '@/shared/status-models';
import { GradeBreakdown } from '@/components/quality/grade-breakdown';
import { LiveTranscriptLines } from '@/components/live/live-transcript';

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

interface LinkedObject {
  readonly href: string;
  readonly label: string;
  readonly icon: React.ReactNode;
}

const FLAG_REASONS: readonly SelectOption[] = [
  { value: 'wrong_details', label: 'Captured details were wrong' },
  { value: 'missed_emergency', label: 'Missed or mishandled an emergency' },
  { value: 'pricing_error', label: 'Quoted the wrong fee or price' },
  { value: 'tone', label: 'Tone or conversation quality' },
  { value: 'other', label: 'Other' },
];

export function CallDrawer({
  call,
  session,
  flagged,
  onFlag,
  onClose,
}: {
  call: CallInteractionView;
  session: Session;
  flagged: boolean;
  onFlag: (reason: string, context: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [flagReason, setFlagReason] = useState('wrong_details');
  const [flagContext, setFlagContext] = useState('');
  const tz = timezoneFor(session.orgId, call.locationId);
  const identity = call.contact?.identity ?? null;
  const name =
    call.partyType === 'plumber'
      ? call.plumber?.name ?? 'Plumber'
      : identity
        ? `${identity.firstName} ${identity.lastName}`
        : 'Unmatched caller';
  const locationName = call.locationName ?? getLocationById(session.orgId, call.locationId)?.name ?? call.locationId;
  const media = call.media;
  const recordingUrl = validRecordingUrl(media?.recordingUrl);
  const hasRecording = recordingUrl !== null;

  // Opening the drawer surfaces the transcript, which is an audited event.
  // Guarded on `media` (present only when the session may access it).
  useEffect(() => {
    if (!media) return;
    void recordTranscriptView(call.id).catch(() => undefined);
  }, [call.id, media]);

  const linkedCandidates: readonly (LinkedObject | null)[] = [
    call.linked.jobId
      ? { href: `/jobs?jobId=${call.linked.jobId}`, label: 'Job', icon: <CalendarDays className="h-4 w-4" aria-hidden="true" /> }
      : null,
    call.linked.dispatchId
      ? { href: `/dispatch-queue?dispatchId=${call.linked.dispatchId}`, label: 'Dispatch record', icon: <ClipboardCheck className="h-4 w-4" aria-hidden="true" /> }
      : null,
    call.linked.escalationId
      ? { href: `/escalations?escalationId=${call.linked.escalationId}`, label: 'Escalation', icon: <TriangleAlert className="h-4 w-4" aria-hidden="true" /> }
      : null,
    call.linked.reviewRequestId
      ? { href: '/reviews', label: 'Review request', icon: <Star className="h-4 w-4" aria-hidden="true" /> }
      : null,
    call.linked.campaignId
      ? { href: '/campaigns', label: 'Campaign', icon: <Megaphone className="h-4 w-4" aria-hidden="true" /> }
      : null,
  ];
  const linkedObjects: readonly LinkedObject[] = linkedCandidates.filter((o): o is LinkedObject => o !== null);

  const extracted = call.extracted;

  return (
    <Drawer
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={name}
      description={`${call.direction === 'inbound' ? 'Inbound' : 'Outbound'} · ${AGENT_LABELS[call.agent]} · ${CALL_DISPOSITION_LABELS[call.disposition]}`}
    >
      {/* 1. Call Record */}
      <Section title="Call record">
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Direction">{call.direction === 'inbound' ? 'Inbound' : 'Outbound'}</Field>
          <Field label="Agent">{AGENT_LABELS[call.agent]}</Field>
          <Field label="Party type">{PARTY_TYPE_LABELS[call.partyType]}</Field>
          <Field label="Phone">
            {identity ? (
              <span className="tabular-nums">{identity.phoneMasked}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </Field>
          <Field label="Start time">{formatDateTime(call.atUtc, tz)}</Field>
          <Field label="Duration">{formatDuration(call.durationSeconds)}</Field>
          <Field label="Disposition">
            <CallDispositionChip status={call.disposition} />
          </Field>
          <Field label="Priority">
            <PriorityChip priority={call.priority} />
          </Field>
          <Field label="Business location">{locationName}</Field>
          <Field label="QA grade">
            {call.grade ? (
              <span className="tabular-nums font-semibold text-foreground">{call.grade.overall}</span>
            ) : (
              <span className="text-muted-foreground">Not graded</span>
            )}
          </Field>
        </dl>
      </Section>

      {/* 2. Recording — player with speed control; graceful unavailable state. */}
      {hasRecording ? (
        <Section title="Recording">
          <RecordingPlayer
            recordingUrl={recordingUrl}
            label={`recording of the call with ${name}`}
            onPlay={() => void recordRecordingPlayback(call.id).catch(() => undefined)}
          />
          {media?.consentDisclosureAtUtc ? (
            <div className="mt-3 flex flex-col gap-0.5 border-l-2 border-border pl-3">
              <span className="text-sm font-medium text-foreground">Recording disclosure delivered to caller</span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(media.consentDisclosureAtUtc, tz)} · two-party consent location
              </span>
            </div>
          ) : null}
        </Section>
      ) : media ? (
        <Section title="Recording">
          <p className="text-sm text-muted-foreground">
            Recording unavailable. The call record and transcript remain available.
          </p>
        </Section>
      ) : null}

      {/* 3. Transcript with speaker labels, timestamps, and redaction markers. */}
      {media ? (
        <Section title="Transcript">
          {media.transcript.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Transcript unavailable. The call record and recording remain available.
            </p>
          ) : (
            <LiveTranscriptLines
              turns={media.transcript}
              timeZone={tz}
              callId={call.id}
              finalizePending={call.disposition !== 'in_progress'}
              playbackMode={call.disposition === 'in_progress' ? 'live' : 'settled'}
            />
          )}
        </Section>
      ) : (
        <Section title="Recording and transcript">
          <p className="text-sm text-muted-foreground">
            Recordings and transcripts require Dispatcher, Manager, or Owner access.
          </p>
        </Section>
      )}

      {/* 4. Extracted Intake or Dispatch Data */}
      {extracted ? (
        <Section title={call.partyType === 'plumber' ? 'Extracted dispatch data' : 'Extracted intake data'}>
          <dl className="grid grid-cols-2 gap-4">
            {call.partyType === 'customer' && identity ? <Field label="Customer name">{name}</Field> : null}
            {call.partyType === 'customer' && call.contact ? (
              <Field label="Service address">{call.contact.serviceAddress}</Field>
            ) : null}
            <Field label="Issue type">
              {extracted.issueType ? ISSUE_TYPE_LABELS[extracted.issueType] : <span className="text-muted-foreground">—</span>}
            </Field>
            <Field label="Job type">{extracted.jobType ?? <span className="text-muted-foreground">—</span>}</Field>
            <Field label="Required specialty">
              {extracted.requiredSpecialty ? (
                SPECIALTY_LABELS[extracted.requiredSpecialty]
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Preferred service window">
              {extracted.preferredWindowLabel ?? <span className="text-muted-foreground">—</span>}
            </Field>
            {extracted.plumberResponse ? (
              <Field label="Plumber response">{OUTREACH_OUTCOME_LABELS[extracted.plumberResponse]}</Field>
            ) : null}
          </dl>
        </Section>
      ) : null}

      {/* 5. Quality Grade — overall plus the five dimensions. */}
      {call.grade ? (
        <Section title="Quality grade">
          <GradeBreakdown grade={call.grade} />
        </Section>
      ) : null}

      {/* 6. Linked Records */}
      <Section title="Linked records">
        {linkedObjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No linked records for this call.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {linkedObjects.map((o) => (
              <li key={o.href}>
                <Link
                  href={o.href}
                  className="inline-flex items-center gap-1.5 text-sm text-foreground hover:underline"
                >
                  {o.icon}
                  {o.label}
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* 7. Flag for Review */}
      <Section title="Flag for review">
        {flagged ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-foreground">
            <Flag className="h-4 w-4" aria-hidden="true" />
            Flagged for quality review.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <Select aria-label="Flag reason" value={flagReason} onValueChange={setFlagReason} options={FLAG_REASONS} />
            <label htmlFor="call-flag-context" className="sr-only">
              Additional context
            </label>
            <textarea
              id="call-flag-context"
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
        )}
      </Section>
    </Drawer>
  );
}
