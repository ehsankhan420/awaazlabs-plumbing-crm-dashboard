'use client';

/**
 * §14.2 REQUEST-AUDIENCE STUB.
 *
 * Audience creation in v1 is a request-to-operations workflow (same pattern as knowledge
 * change requests); self-serve segment building is deliberately deferred.
 *
 * This is therefore intentionally a SHORT REQUEST FORM, not a segment builder. It captures a
 * plain-language description of the desired audience and shows a confirmation. Building an
 * actual self-serve segment builder would be a defect (the spec explicitly defers it).
 */

import React, { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Select } from '@/components/ui/select';
import { CAMPAIGN_TYPES, type CampaignType } from '@/mock/schema';

import { CAMPAIGN_TYPE_LABELS } from './campaign-labels';

export function RequestAudienceForm(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [type, setType] = useState<CampaignType>('reengagement');
  const [description, setDescription] = useState('');

  function reset(): void {
    setSubmitted(false);
    setType('reengagement');
    setDescription('');
  }

  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (!next) reset();
  }

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Request a new audience"
      description="Describe the audience you need. Our operations team builds and reviews it — self-serve segment building is not available in v1."
      trigger={
        <Button variant="default">
          <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Request audience
        </Button>
      }
    >
      {submitted ? (
        <div className="flex flex-col items-start gap-3">
          <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            Request sent
          </p>
          <p className="text-sm text-muted-foreground">
            Your audience request for a {CAMPAIGN_TYPE_LABELS[type].toLowerCase()} campaign has been submitted.
            The operations team will build the segment and follow up — you&apos;ll see it here once it&apos;s ready.
          </p>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Done
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="request-type" className="text-sm font-medium text-foreground">
              Campaign type
            </label>
            <Select
              aria-label="Campaign type"
              value={type}
              onValueChange={(v) => setType(v as CampaignType)}
              options={CAMPAIGN_TYPES.map((t) => ({ value: t, label: CAMPAIGN_TYPE_LABELS[t] }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="request-description" className="text-sm font-medium text-foreground">
              Describe the audience
            </label>
            <textarea
              id="request-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="e.g. Customers with no service in the last 12 months who had a water heater installed"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              Plain language is fine. The operations team translates this into the segment rules and validates consent and suppression.
            </p>
          </div>

          <div>
            <Button type="submit" disabled={description.trim() === ''}>
              Submit request
            </Button>
          </div>
        </form>
      )}
    </Drawer>
  );
}
