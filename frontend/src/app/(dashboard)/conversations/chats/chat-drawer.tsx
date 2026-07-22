'use client';

/**
 * §5.3 Chat drawer. Sections: customer and channel summary, full timestamped message
 * thread with agent/customer speaker treatment and human-handoff marker, extracted
 * intake summary, linked job and escalation, QA grade, and Flag Interaction.
 *
 * Gating is structural — a Viewer receives `messages: null`, so there is no transcript
 * to reach and none is rendered.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ExternalLink, Flag, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Select, type SelectOption } from '@/components/ui/select';
import { GradeBreakdown } from '@/components/quality/grade-breakdown';
import { formatDateTime, timezoneFor } from '@/lib/format';
import type { ChatInteractionView, Session } from '@/mock/data-access';
import { recordTranscriptView } from '@/lib/audit-live';
import { CHAT_CHANNEL_LABELS, LANGUAGE_LABELS } from '@/shared/status-models';

import { CHAT_OUTCOME_LABELS, chatCustomerDisplayName, chatPurposeLabel, speakerLabel } from './chat-display';

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

const FLAG_REASONS: readonly SelectOption[] = [
  { value: 'wrong_details', label: 'Captured details were wrong' },
  { value: 'missed_emergency', label: 'Missed or mishandled an emergency' },
  { value: 'pricing_error', label: 'Quoted the wrong fee or price' },
  { value: 'tone', label: 'Tone or conversation quality' },
  { value: 'other', label: 'Other' },
];

export function ChatDrawer({
  chat,
  session,
  flagged,
  onFlag,
  onClose,
}: {
  chat: ChatInteractionView;
  session: Session;
  flagged: boolean;
  onFlag: (reason: string, context: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [flagReason, setFlagReason] = useState('wrong_details');
  const [flagContext, setFlagContext] = useState('');
  const tz = timezoneFor(session.orgId, chat.locationId);
  const name = chatCustomerDisplayName(chat);
  const purpose = chatPurposeLabel(chat);
  const messages = chat.messages;

  // Opening the transcript is an audited event.
  useEffect(() => {
    if (!messages) return;
    void recordTranscriptView(chat.id, 'chat').catch(() => undefined);
  }, [chat.id, messages]);

  return (
    <Drawer
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={name}
      description={`${purpose} · ${CHAT_CHANNEL_LABELS[chat.channel]} · ${CHAT_OUTCOME_LABELS[chat.outcome]}`}
    >
      {/* Customer and channel summary. */}
      <Section title="Session summary">
        <dl className="grid grid-cols-2 gap-4">
          <Field label="Customer">{name}</Field>
          <Field label="Channel">{CHAT_CHANNEL_LABELS[chat.channel]}</Field>
          <Field label="Started">{formatDateTime(chat.atUtc, tz)}</Field>
          <Field label="Last message">{formatDateTime(chat.lastMessageAtUtc, tz)}</Field>
          <Field label="Outcome">{CHAT_OUTCOME_LABELS[chat.outcome]}</Field>
          <Field label="Language">{LANGUAGE_LABELS[chat.language]}</Field>
          <Field label="Human handoff">{chat.humanHandoff ? 'Yes' : 'No'}</Field>
          <Field label="Messages">{chat.messageCount}</Field>
        </dl>
      </Section>

      {/* Full timestamped message thread with handoff markers. */}
      {messages ? (
        <Section title="Message thread">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages in this thread.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {messages.map((msg, i) => (
                <React.Fragment key={`${msg.at}-${i}`}>
                  {msg.isHandoffMarker ? (
                    <li className="flex items-center gap-3 py-1" aria-label="Handed off to staff">
                      <span className="h-px flex-1 bg-border" aria-hidden="true" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Handed off to staff
                      </span>
                      <span className="h-px flex-1 bg-border" aria-hidden="true" />
                    </li>
                  ) : null}
                  <li className="flex flex-col gap-0.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {speakerLabel(msg.speaker)}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">{formatDateTime(msg.at, tz)}</span>
                    </div>
                    <p className="text-sm text-foreground">{msg.text}</p>
                  </li>
                </React.Fragment>
              ))}
            </ol>
          )}
        </Section>
      ) : (
        <Section title="Message thread">
          <p className="text-sm text-muted-foreground">
            Chat transcripts require Dispatcher, Manager, or Owner access.
          </p>
        </Section>
      )}

      {/* QA grade. */}
      {chat.grade ? (
        <Section title="Quality grade">
          <GradeBreakdown grade={chat.grade} />
        </Section>
      ) : null}

      {/* Linked job and escalation. */}
      <Section title="Linked records">
        {chat.linked.jobId || chat.linked.escalationId ? (
          <ul className="flex flex-col gap-2">
            {chat.linked.jobId ? (
              <li>
                <Link
                  href={`/jobs?jobId=${chat.linked.jobId}`}
                  className="inline-flex items-center gap-1.5 text-sm text-foreground hover:underline"
                >
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  Job created
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ) : null}
            {chat.linked.escalationId ? (
              <li>
                <Link
                  href={`/escalations?escalationId=${chat.linked.escalationId}`}
                  className="inline-flex items-center gap-1.5 text-sm text-foreground hover:underline"
                >
                  <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                  Escalation
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ) : null}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No linked records for this chat.</p>
        )}
      </Section>

      {/* Flag Interaction. */}
      <Section title="Flag for review">
        {flagged ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-foreground">
            <Flag className="h-4 w-4" aria-hidden="true" />
            Flagged for quality review.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <Select aria-label="Flag reason" value={flagReason} onValueChange={setFlagReason} options={FLAG_REASONS} />
            <label htmlFor="chat-flag-context" className="sr-only">
              Additional context
            </label>
            <textarea
              id="chat-flag-context"
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
