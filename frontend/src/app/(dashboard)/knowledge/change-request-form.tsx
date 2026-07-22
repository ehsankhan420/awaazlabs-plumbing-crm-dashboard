'use client';

/**
 * §15.2 change-request workflow — the "Request an update" control that sits on EVERY
 * knowledge block.
 *
 * A "Request an update" button on every knowledge block captures a proposed change plus a
 * reason, submitted to the operations team. Submitting calls `submitKnowledgeChangeRequest`
 * (dashboard-live), which persists the request to the in-memory mock overlay and writes the
 * `knowledge_change_request` audit event. Every state change notifies the requester —
 * surfaced here as a plain notification stub, not a real notification system.
 *
 * There is deliberately NO self-serve editing: this form proposes a change for review;
 * it never mutates the knowledge value. The only <textarea>s in the Knowledge tab are the
 * two fields below.
 */

import React, { useId, useState } from 'react';
import { Bell, ClipboardList } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { KnowledgeRequestStatusChip } from '@/components/ui/status-chip';
import { submitKnowledgeChangeRequest } from '@/lib/dashboard-live';
import type { LiveKnowledgeChangeRequest } from '@/lib/dashboard-live';
import type { KnowledgeCategory } from '@/mock/schema';
import { KNOWLEDGE_REQUEST_STATUSES } from '@/shared/status-models';
import { useSession } from '@/shared/session-context';

export function ChangeRequestForm({
  category,
  categoryLabel,
  blockLabel,
  onSubmitted,
}: {
  category: KnowledgeCategory;
  categoryLabel: string;
  blockLabel: string;
  onSubmitted?: (request: LiveKnowledgeChangeRequest) => void;
}): React.JSX.Element {
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [proposed, setProposed] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proposedId = useId();
  const reasonId = useId();

  const canSubmit = proposed.trim() !== '' && reason.trim() !== '' && !submitting;

  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (!next) {
      // Reset on close so the next block's request starts clean.
      setProposed('');
      setReason('');
      setSubmitted(false);
      setError(null);
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // Writes the real §2.3 `knowledge_change_request` audit event and a tracked request row.
      // No knowledge value is mutated.
      const request = await submitKnowledgeChangeRequest(session, category, proposed.trim(), reason.trim());
      onSubmitted?.(request);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit the request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Request a knowledge update"
      description={`${categoryLabel} · ${blockLabel}`}
      trigger={
        <Button variant="outline" size="sm" aria-label={`Request an update to ${categoryLabel} — ${blockLabel}`}>
          Request an update
        </Button>
      }
      footer={
        submitted ? (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </Button>
          </div>
        )
      }
    >
      {submitted ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4">
            <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">Request submitted</p>
              <p className="text-sm text-muted-foreground">
                Nothing has changed in the knowledge base yet. Every change passes review before it
                goes live; this request now enters the review workflow.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Status pipeline</p>
            <div className="flex flex-wrap items-center gap-2">
              {KNOWLEDGE_REQUEST_STATUSES.map((status, i) => (
                <React.Fragment key={status}>
                  {i > 0 ? <span className="text-muted-foreground" aria-hidden="true">→</span> : null}
                  <KnowledgeRequestStatusChip status={status} />
                </React.Fragment>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">This request is currently at “Requested”.</p>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border p-4">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Notification stub: in production a notification would be sent to you at each state change
              (Requested → Scheduled → Live). No notification is actually delivered in this demo.
            </p>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor={proposedId} className="text-sm font-medium text-foreground">
              Proposed change
            </label>
            <textarea
              id={proposedId}
              value={proposed}
              onChange={(e) => setProposed(e.target.value)}
              rows={4}
              placeholder="Describe the exact change you would like the agents to reflect."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor={reasonId} className="text-sm font-medium text-foreground">
              Reason
            </label>
            <textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why is this change needed? Our operations team uses this to review the request."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            This is a change request, not an edit. The knowledge value stays read-only until review
            takes it live.
          </p>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </form>
      )}
    </Drawer>
  );
}
