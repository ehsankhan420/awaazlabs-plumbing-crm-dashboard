'use client';

/**
 * §16.5 Organization and Locations (SETTINGS).
 *
 *  - Organization profile.
 *  - Average job value configuration — FEEDS THE REVENUE CARDS. This is the value
 *    `revenueInfluencedEstimate()` in src/lib/metrics.ts multiplies by, so it drives the
 *    Overview §4.3 "revenue recovered" estimate. When it is null (as for Cedar), that card
 *    hides entirely. Editing here is optimistic local state only — the fixtures are
 *    read-only, so a change is not persisted and does not mutate the shared metric.
 *  - Location list with timezone, business hours, and holiday calendar per location.
 *    `businessHours` are minutes-from-midnight and are rendered as readable clock times.
 *
 * Viewer sees this surface read-only (no config edits).
 */

import React, { useMemo, useState } from 'react';
import { Building2, CalendarDays, Clock, DollarSign, MapPin, Save } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { formatDate, formatUsd } from '@/lib/format';
import { canPerformWorkflowActions } from '@/mock/data-access';
import { useSession } from '@/shared/session-context';
import type { BusinessHours, MockLocation } from '@/mock/schema';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Minutes-from-midnight (local clock, no timezone) -> "8:00 AM". */
function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

function BusinessHoursList({ hours }: { hours: readonly BusinessHours[] }) {
  const byDay = new Map<number, BusinessHours>(hours.map((h) => [h.day, h]));
  return (
    <dl className="grid gap-1 text-sm">
      {WEEKDAYS.map((name, day) => {
        const h = byDay.get(day);
        return (
          <div key={name} className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">{name}</dt>
            <dd className="tabular-nums text-foreground">
              {h ? `${formatClock(h.openMinute)} – ${formatClock(h.closeMinute)}` : 'Closed'}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function LocationCard({ location }: { location: MockLocation }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {location.name}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Timezone</span>
          <span className="font-medium text-foreground">{location.timezone}</span>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Business hours</p>
          <BusinessHoursList hours={location.businessHours} />
        </div>

        <div>
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Holiday calendar
          </p>
          <div className="flex flex-wrap gap-2">
            {location.holidays.length === 0 ? (
              <span className="text-sm text-muted-foreground">No holidays configured.</span>
            ) : (
              location.holidays.map((h) => (
                <Badge key={h} variant="outline">
                  {formatDate(`${h}T12:00:00.000Z`, 'UTC')}
                </Badge>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrganizationClient() {
  const { session, org } = useSession();
  const canEdit = canPerformWorkflowActions(session);

  const [avgValue, setAvgValue] = useState<number | null>(org.avgJobValueUsd);
  const [draft, setDraft] = useState<string>(org.avgJobValueUsd?.toString() ?? '');

  const revenueHelp = useMemo(
    () =>
      avgValue === null
        ? 'No Average Job Value is set, so the Overview Revenue Influenced estimate is hidden.'
        : 'This value drives the Overview Revenue Influenced estimate: it is multiplied by completed AI-created jobs this month.',
    [avgValue],
  );

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = Number.parseFloat(draft);
    setAvgValue(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Organization and Locations"
        description="Organization profile, the Average Job Value that feeds the revenue cards, and per-location timezone, hours, and holidays."
      />

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Organization profile
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex flex-col">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium text-foreground">{org.name}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-muted-foreground">Locations</dt>
              <dd className="font-medium text-foreground tabular-nums">{org.locations.length}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Average job value
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            Current value:{' '}
            <span className="font-medium text-foreground tabular-nums">
              {avgValue === null ? 'Not set' : formatUsd(avgValue)}
            </span>
          </p>
          <Banner variant="default" title="This feeds the Overview revenue card">
            {revenueHelp}
          </Banner>

          {canEdit ? (
            <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={handleSave}>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">Average Job Value (USD)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="e.g. 285"
                  className="w-48 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground tabular-nums"
                />
              </label>
              <Button type="submit">
                <span className="inline-flex items-center gap-1.5">
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save
                </span>
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              You have read-only access to organization settings.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Editing here updates local state only for this demo — the mock fixtures are read-only,
            so the change is not persisted.
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Locations</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {org.locations.map((l) => (
            <LocationCard key={l.id} location={l} />
          ))}
        </div>
      </div>
    </div>
  );
}
