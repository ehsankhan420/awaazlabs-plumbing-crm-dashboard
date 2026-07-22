'use client';

/**
 * §5.4 Escalation drawer. Sections in the spec's order:
 *  1. Escalation Summary   4. Dispatch Context
 *  2. Customer and Job     5. Ownership
 *  3. Source Interaction   6. Resolution
 *
 * Actions: Acknowledge · Assign Owner · Open Source · Open Job · Open Dispatch Record ·
 * Add Resolution Note · Resolve Escalation. The whole action surface renders only when
 * `canAck` (a Viewer never sees it).
 */

import React, { useState } from 'react';
import { Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { MaskedValue } from '@/components/ui/masked-value';
import { AgingBadge } from '@/components/ui/aging-badge';
import { AssignmentStatusChip, EscalationStatusChip, SeverityChip } from '@/components/ui/status-chip';
import { formatDateTime } from '@/lib/format';
import type { Session } from '@/mock/data-access';
import {
  ESCALATION_TRIGGER_LABELS,
  ISSUE_TYPE_LABELS,
  JOB_PRIORITY_LABELS,
  SPECIALTY_LABELS,
} from '@/shared/status-models';
import type { DispatchRecord } from '@/mock/schema';

import type { EscalationRowVM } from './types';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}

export function EscalationDetailDrawer({
  row,
  dispatch,
  open,
  onOpenChange,
  session,
  canAck,
  members,
  onAcknowledge,
  onAssignOwner,
  onSaveNote,
  onResolve,
}: {
  row: EscalationRowVM;
  dispatch: DispatchRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session;
  canAck: boolean;
  members: readonly string[];
  onAcknowledge: (id: string) => void;
  onAssignOwner: (id: string, owner: string) => void;
  onSaveNote: (id: string, note: string) => void;
  onResolve: (id: string, note: string) => void;
}): React.JSX.Element {
  const [note, setNote] = useState(row.resolutionNote ?? '');
  const [ownerDraft, setOwnerDraft] = useState('');
  const record = row.record;
  const isOpen = row.effectiveStatus === 'open';
  const isResolved = row.effectiveStatus === 'resolved';
  const identity = record.contact?.identity ?? null;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`${record.reference} — ${row.customerName}`}
      description={ESCALATION_TRIGGER_LABELS[record.trigger]}
    >
      <div className="flex flex-col gap-6">
        {/* 1. Escalation Summary */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Escalation summary</SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            <EscalationStatusChip status={row.effectiveStatus} />
            <SeverityChip severity={row.severity} />
            {row.pastThreshold ? <AgingBadge level="red" minutes={row.ageMinutes} label="past threshold" /> : null}
          </div>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Reference">{record.reference}</Field>
            <Field label="Created">{row.timestampLabel}</Field>
            <Field label="Trigger">{row.triggerLabel}</Field>
            <Field label="Acknowledgement threshold">
              {row.thresholdMinutes >= 60 ? `${row.thresholdMinutes / 60} hours` : `${row.thresholdMinutes} minutes`}
            </Field>
            <Field label="Current age">
              {row.ageMinutes < 90 ? `${Math.round(row.ageMinutes)} minutes` : `${(row.ageMinutes / 60).toFixed(1)} hours`}
            </Field>
            <Field label="Business location">{row.locationName}</Field>
          </dl>
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Reason</p>
            <p className="mt-1 text-sm text-foreground">{record.reason}</p>
          </div>
        </section>

        {/* 2. Customer and Job */}
        <section className="flex flex-col gap-3 border-t border-border pt-4">
          <SectionTitle>Customer and job</SectionTitle>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Customer">{row.customerName}</Field>
            <Field label="Phone">
              {identity ? (
                <MaskedValue identity={identity} session={session} objectRef={`escalation:${record.id}`} />
              ) : (
                '—'
              )}
            </Field>
            <Field label="Job reference">
              {record.job ? (
                <Link href={`/jobs?jobId=${record.job.id}`} className="font-medium text-foreground underline underline-offset-2 hover:no-underline">
                  {record.job.reference}
                </Link>
              ) : (
                '—'
              )}
            </Field>
            <Field label="Issue type">{record.job ? ISSUE_TYPE_LABELS[record.job.issueType] : '—'}</Field>
            <Field label="Priority">{record.job ? JOB_PRIORITY_LABELS[record.job.priority] : '—'}</Field>
            <Field label="Service address">{record.contact?.serviceAddress ?? '—'}</Field>
          </dl>
        </section>

        {/* 3. Source Interaction */}
        <section className="flex flex-col gap-3 border-t border-border pt-4">
          <SectionTitle>Source interaction</SectionTitle>
          {row.source ? (
            <Link
              href={row.source.href}
              className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2 hover:no-underline"
            >
              <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Open {row.source.label}
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">No source interaction is linked to this escalation.</p>
          )}
        </section>

        {/* 4. Dispatch Context */}
        {dispatch ? (
          <section className="flex flex-col gap-3 border-t border-border pt-4">
            <SectionTitle>Dispatch context</SectionTitle>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Assignment status">
                <AssignmentStatusChip status={dispatch.status} />
              </Field>
              <Field label="Required specialty">{SPECIALTY_LABELS[dispatch.requiredSpecialty]}</Field>
              <Field label="Attempts">{dispatch.attempts.length}</Field>
              <Field label="Last outcome">
                {dispatch.attempts.length > 0 ? dispatch.attempts[dispatch.attempts.length - 1].outcome : '—'}
              </Field>
            </dl>
            <Link
              href={`/dispatch-queue?dispatchId=${dispatch.id}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-2 hover:no-underline"
            >
              <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Open Dispatch Record
            </Link>
          </section>
        ) : null}

        {/* 5. Ownership */}
        <section className="flex flex-col gap-3 border-t border-border pt-4">
          <SectionTitle>Ownership</SectionTitle>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Escalation owner">{row.owner ?? <Badge variant="outline">Unowned</Badge>}</Field>
            <Field label="Acknowledged">
              {row.acknowledgedAtUtc ? (
                <span>
                  {row.ackTimestampLabel}
                  {row.acknowledgedBy ? ` · ${row.acknowledgedBy}` : ''}
                </span>
              ) : (
                <Badge variant="outline">Not yet</Badge>
              )}
            </Field>
          </dl>
          {canAck ? (
            <div className="flex flex-wrap items-center gap-2">
              {isOpen ? <Button onClick={() => onAcknowledge(record.id)}>Acknowledge</Button> : null}
              <select
                aria-label="Assign owner"
                value={ownerDraft}
                onChange={(e) => setOwnerDraft(e.target.value)}
                className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm text-foreground"
              >
                <option value="">Assign owner…</option>
                {members.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                disabled={ownerDraft === ''}
                onClick={() => {
                  onAssignOwner(record.id, ownerDraft);
                  setOwnerDraft('');
                }}
              >
                Assign Owner
              </Button>
            </div>
          ) : null}
        </section>

        {/* 6. Resolution */}
        <section className="flex flex-col gap-3 border-t border-border pt-4">
          <SectionTitle>Resolution</SectionTitle>
          {isResolved ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="text-foreground">{row.resolutionNote ?? 'Resolved.'}</p>
              {record.resolvedAtUtc ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Resolved {formatDateTime(record.resolvedAtUtc, row.timezone)}
                </p>
              ) : null}
            </div>
          ) : canAck ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="escalation-note" className="text-sm font-medium text-foreground">
                Resolution note
              </label>
              <textarea
                id="escalation-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Describe how this escalation was handled…"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={note.trim() === '' || note.trim() === (row.resolutionNote ?? '')}
                  onClick={() => onSaveNote(record.id, note.trim())}
                >
                  Add Resolution Note
                </Button>
                <Button disabled={note.trim() === ''} onClick={() => onResolve(record.id, note.trim())}>
                  Resolve Escalation
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No resolution recorded yet.</p>
          )}
        </section>
      </div>
    </Drawer>
  );
}
