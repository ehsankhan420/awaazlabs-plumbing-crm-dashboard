'use client';

/**
 * §14.2 CAMPAIGN DETAIL — the per-campaign management surface, shown in a slide-over.
 *
 * Contents (spec §14.2):
 *   - Funnel identical to §14.1, scoped to this campaign (same `reengagementFunnel` builder).
 *   - Audience definition summary (segment rules).
 *   - Per-contact rows: name, phone masked, attempts, last outcome, booked link, opt-out flag.
 *   - Pacing settings display (read-only).
 *   - Guardrails, displayed read-only.
 *   - Pause / resume controls (Owner and Manager) — see the audit note below.
 *
 * AUDIT NOTE: §2.3 enumerates exactly twelve audit event types and none covers pausing or
 * resuming a campaign. Per the task and BUILD_NOTES.md B14 (the Flag button), we do NOT add a
 * thirteenth `AuditEventType` — the frozen union would not compile and it would contradict
 * §2.3's explicit list. There is also no *truthful* existing type for "pause campaign", so
 * writing one would be a fabricated audit row (worse than none, per audit.ts's own principle).
 * The controls therefore change local state only and write no audit event; this gap is
 * recorded in progress/reengagement_campaigns_audit.md.
 */

import React from 'react';
import Link from 'next/link';
import { PauseCircle, PlayCircle, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MaskedValue } from '@/components/ui/masked-value';
import { CampaignStatusChip } from '@/components/ui/status-chip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Funnel } from '@/components/charts/funnel';
import { formatCount } from '@/lib/format';
import {
  canControlCampaigns,
  canRevealPhone,
  maskPhone,
  type CustomerIdentityView,
  type Session,
} from '@/mock/data-access';
import type { Campaign, CustomerContact } from '@/mock/schema';
import type { CampaignStatus } from '@/shared/status-models';

import { funnelTableData, reengagementFunnel } from '../agents/reengagement/reengagement-analytics';

/** Mirror of the data-access projection, using only its exported gating predicates. */
function identityView(contact: CustomerContact | undefined, session: Session): CustomerIdentityView | null {
  if (!contact?.identity) return null;
  return {
    firstName: contact.identity.firstName,
    lastName: contact.identity.lastName,
    phoneMasked: maskPhone(contact.identity.phoneE164),
    // Raw number withheld unless the role may reveal it — same boundary as data-access.
    phoneE164: canRevealPhone(session) ? contact.identity.phoneE164 : null,
  };
}

function DefinitionRow({ label, value }: { label: string; value: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h3 className="text-sm font-semibold tracking-tight text-foreground">{children}</h3>;
}

export function CampaignDetail({
  campaign,
  session,
  contactsById,
  timezone,
  effectiveStatus,
  onToggleStatus,
}: {
  campaign: Campaign;
  session: Session;
  contactsById: ReadonlyMap<string, CustomerContact>;
  timezone: string;
  effectiveStatus: CampaignStatus;
  onToggleStatus: () => void;
}): React.JSX.Element {
  const funnel = reengagementFunnel(campaign.contacts);
  const showRows = true;
  const showControls = canControlCampaigns(session);

  return (
    <div className="flex flex-col gap-8">
      {/* Funnel — identical builder to §14.1, scoped to this campaign */}
      <section className="flex flex-col gap-3">
        <SectionHeading>Funnel</SectionHeading>
        <Funnel
          title="Campaign funnel"
          description="Audience through to booked for this campaign. Identical to the Reengagement tab funnel."
          stages={funnel.stages}
          formatCount={formatCount}
          tableData={funnelTableData(funnel.stages)}
        />
      </section>

      {/* Audience definition summary */}
      <section className="flex flex-col gap-3">
        <SectionHeading>Audience definition</SectionHeading>
        <ul className="flex flex-col gap-1.5">
          {campaign.audienceDefinition.map((rule) => (
            <li key={rule} className="flex items-start gap-2 text-sm text-foreground">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
              {rule}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Configured audience size: {formatCount(campaign.audienceSize)} contacts.
        </p>
      </section>

      {/* Pacing settings — read-only */}
      <section className="flex flex-col gap-3">
        <SectionHeading>Pacing settings</SectionHeading>
        <dl className="rounded-lg border border-border bg-card p-4">
          <DefinitionRow
            label="Calling window"
            value={`${campaign.pacing.callingWindowLocal} · ${timezone}`}
          />
          <DefinitionRow label="Max attempts per contact" value={formatCount(campaign.pacing.maxAttempts)} />
          <DefinitionRow label="Retry spacing" value={`${campaign.pacing.retrySpacingHours}h`} />
        </dl>
        <p className="text-xs text-muted-foreground">
          Read-only. The calling window is enforced in the location&apos;s timezone and respects configured quiet hours.
        </p>
      </section>

      {/* Guardrails — read-only */}
      <section className="flex flex-col gap-3">
        <SectionHeading>
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Platform guardrails
          </span>
        </SectionHeading>
        <ul className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground">
          <li>Suppression list checked before every dial.</li>
          <li>TCPA calling-window enforcement.</li>
          <li>Per-contact attempt cap ({formatCount(campaign.pacing.maxAttempts)} attempts).</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Enforced by the platform and shown read-only — these cannot be edited from the dashboard.
        </p>
      </section>

      {/* Per-contact rows — customer-level, so gated on standard mode */}
      <section className="flex flex-col gap-3">
        <SectionHeading>Contacts</SectionHeading>
        {showRows ? (
          campaign.contacts.length === 0 ? (
            <EmptyState title="No contacts in this campaign" />
          ) : (
            <Table caption={`Contacts for ${campaign.name}`}>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Last outcome</TableHead>
                  <TableHead>Booked</TableHead>
                  <TableHead>Opt-out</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaign.contacts.map((cc) => {
                  const identity = identityView(contactsById.get(cc.contactId), session);
                  return (
                    <TableRow key={cc.id}>
                      <TableCell className="font-medium text-foreground">
                        {identity ? `${identity.firstName} ${identity.lastName}` : '—'}
                      </TableCell>
                      <TableCell>
                        {identity ? (
                          <MaskedValue identity={identity} session={session} objectRef={`campaign_contact:${cc.id}`} />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCount(cc.attempts)}</TableCell>
                      <TableCell className="text-muted-foreground">{cc.lastOutcome ?? '—'}</TableCell>
                      <TableCell>
                        {cc.createdJobId ? (
                          <Link
                            href={`/jobs?jobId=${cc.createdJobId}`}
                            className="font-medium text-foreground hover:underline"
                            aria-label={`View the job created for this contact in ${campaign.name}`}
                          >
                            View job
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {cc.optOut ? <Badge variant="destructive">Opted out</Badge> : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )
        ) : (
          <EmptyState
            title="Per-contact rows hidden in restricted mode"
            description={`This campaign has ${formatCount(campaign.contacts.length)} contacts. Detailed rows appear below; aggregate counts appear in the funnel above.`}
          />
        )}
      </section>

      {/* Pause / resume controls — Owner and Manager only */}
      {showControls ? (
        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <SectionHeading>Campaign controls</SectionHeading>
          <div className="flex items-center gap-3">
            <CampaignStatusChip status={effectiveStatus} />
            {effectiveStatus === 'running' ? (
              <Button variant="outline" onClick={onToggleStatus}>
                <PauseCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Pause campaign
              </Button>
            ) : effectiveStatus === 'paused' ? (
              <Button variant="outline" onClick={onToggleStatus}>
                <PlayCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Resume campaign
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">
                Pause and resume apply only to running or paused campaigns.
              </span>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
