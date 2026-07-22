'use client';

/**
 * §14.2 CAMPAIGNS TAB (GROWTH section).
 *
 * The management surface for every outbound campaign type — reengagement, no-show recovery,
 * and recall. This is NOT an agent tab, so it does not render through the §2.6 agent template;
 * it is a bespoke list + detail surface.
 *
 * Degraded states:
 *   - Cedar (`campaigns: []`) → EmptyState, no crash.
 *   - Viewer → no request-audience button and no pause/resume controls.
 *   - restricted-access → the funnel and aggregate columns still render; per-contact rows are hidden
 *     inside the detail view (see CampaignDetail).
 */

import React, { useMemo, useState } from 'react';
import { Megaphone } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Drawer } from '@/components/ui/drawer';
import { CampaignStatusChip } from '@/components/ui/status-chip';
import {
  RowOpenButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCount, formatDate, formatPercent, timezoneFor } from '@/lib/format';
import { ratio } from '@/lib/format';
import { scopeToLocation } from '@/lib/metrics';
import { getFixture } from '@/mock/fixtures';
import { getLocationById } from '@/mock/orgs';
import type { Campaign, CustomerContact } from '@/mock/schema';
import type { CampaignStatus } from '@/shared/status-models';
import { useSession } from '@/shared/session-context';

import { CAMPAIGN_TYPE_LABELS } from './campaign-labels';
import { CampaignDetail } from './campaign-detail';
import { RequestAudienceForm } from './request-audience-form';
import { reengagementFunnel } from '../agents/reengagement/reengagement-analytics';

function pct(rate: number | null): string {
  return rate === null ? '—' : formatPercent(rate);
}

export function CampaignsClient(): React.JSX.Element {
  const { session, org } = useSession();
  const fixture = getFixture(org.id);

  const campaigns = useMemo(() => scopeToLocation(fixture.campaigns, session), [fixture.campaigns, session]);
  const contactsById = useMemo<ReadonlyMap<string, CustomerContact>>(
    () => new Map(fixture.contacts.map((c) => [c.id, c])),
    [fixture.contacts],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Readonly<Record<string, CampaignStatus>>>({});

  const effectiveStatus = (c: Campaign): CampaignStatus => statusOverrides[c.id] ?? c.status;

  const toggleStatus = (c: Campaign): void => {
    // §14.2 pause/resume — local state only; see CampaignDetail's audit note for why no audit
    // event is written (no truthful AuditEventType exists in the frozen §2.3 union).
    const current = effectiveStatus(c);
    const next: CampaignStatus | null =
      current === 'running' ? 'paused' : current === 'paused' ? 'running' : null;
    if (next === null) return;
    setStatusOverrides((prev) => ({ ...prev, [c.id]: next }));
  };

  const selected = selectedId ? campaigns.find((c) => c.id === selectedId) ?? null : null;
  const canRequest = session.role !== 'VIEWER';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Campaigns"
        description="Outbound campaign management across reengagement, seasonal maintenance, and follow-up. Audience creation is a request workflow."
        actions={canRequest ? <RequestAudienceForm /> : undefined}
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-8 w-8" />}
          title="No campaigns yet"
          description={
            canRequest
              ? 'This business has no outbound campaigns in the selected scope. Request an audience to get started.'
              : 'This business has no outbound campaigns in the selected scope.'
          }
        />
      ) : (
        <Table caption="Outbound campaigns">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Audience size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="text-right">Progress</TableHead>
              <TableHead className="text-right">Bookings to date</TableHead>
              <TableHead>Location</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => {
              const funnel = reengagementFunnel(c.contacts);
              const progress = ratio(funnel.contacted, funnel.audience);
              const timezone = timezoneFor(org.id, c.locationId);
              const locationName = getLocationById(org.id, c.locationId)?.name ?? c.locationId;
              return (
                <TableRow key={c.id} onClick={() => setSelectedId(c.id)}>
                  <TableCell>
                    <RowOpenButton
                      ariaLabel={`Open campaign ${c.name}`}
                      onClick={() => setSelectedId(c.id)}
                    >
                      {c.name}
                    </RowOpenButton>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{CAMPAIGN_TYPE_LABELS[c.type]}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(c.audienceSize)}</TableCell>
                  <TableCell>
                    <CampaignStatusChip status={effectiveStatus(c)} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.startedAtUtc ? formatDate(c.startedAtUtc, timezone) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{pct(progress)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCount(funnel.booked)}</TableCell>
                  <TableCell className="text-muted-foreground">{locationName}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <p className="text-xs text-muted-foreground">
        Progress is contacted ÷ contacts entered into the pipeline. Audience size is the configured target audience.
      </p>

      <Drawer
        open={selected !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedId(null);
        }}
        title={selected ? selected.name : 'Campaign'}
        description={selected ? CAMPAIGN_TYPE_LABELS[selected.type] : undefined}
      >
        {selected ? (
          <CampaignDetail
            campaign={selected}
            session={session}
            contactsById={contactsById}
            timezone={timezoneFor(org.id, selected.locationId)}
            effectiveStatus={effectiveStatus(selected)}
            onToggleStatus={() => toggleStatus(selected)}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
