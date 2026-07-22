'use client';

/**
 * §16.4 Usage and Billing (SETTINGS, Owner only).
 *
 *  - Minutes consumed vs plan allocation, current cycle, with projection to cycle end.
 *  - Consumption breakdown by agent and by location.
 *  - Chat sessions consumed, metered SEPARATELY from voice minutes — both meters shown.
 *  - Overage indicator + history of past cycles.
 *  - Invoice list with download.
 *
 * "No plan or price editing in the client dashboard; plan changes are an account-manager
 * workflow." — so this surface is strictly read-only reporting plus an invoice download.
 * There is no plan editor anywhere on this page, by design.
 */

import React, { useMemo } from 'react';
import { AlertTriangle, Download, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Tooltip } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart } from '@/components/charts/bar-chart';
import { cn } from '@/lib/utils';
import { formatCount, formatPercent, formatUsd } from '@/lib/format';
import { USAGE_BANNER_THRESHOLD } from '@/lib/metrics';
import { getFixture } from '@/mock/fixtures';
import { mockNow } from '@/mock/orgs';
import { useSession } from '@/shared/session-context';
import { AGENT_IDS, AGENT_LABELS } from '@/shared/status-models';

const CHART_1 = 'var(--chart-1)';

/** Linear run-rate projection to the end of the calendar-month billing cycle. */
function projectToCycleEnd(consumed: number): { projected: number; dayOfCycle: number; daysInCycle: number } {
  const now = mockNow();
  const dayOfCycle = now.getUTCDate();
  const daysInCycle = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const projected = dayOfCycle > 0 ? Math.round((consumed / dayOfCycle) * daysInCycle) : consumed;
  return { projected, dayOfCycle, daysInCycle };
}

interface MeterProps {
  readonly label: string;
  readonly consumed: number;
  readonly plan: number;
  readonly unit: string;
  readonly projected: number;
  readonly projectionTooltip: string;
}

function UsageMeter({ label, consumed, plan, unit, projected, projectionTooltip }: MeterProps) {
  const ratio = plan > 0 ? consumed / plan : 0;
  const projectedRatio = plan > 0 ? projected / plan : 0;
  const nearingLimit = ratio >= USAGE_BANNER_THRESHOLD;
  const projectedOverage = projected > plan;
  const currentOverage = consumed > plan;
  const fillPct = Math.min(100, ratio * 100);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <Tooltip label={`Projection method for ${label}`} content={projectionTooltip}>
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          </Tooltip>
        </div>

        <div className="text-3xl font-semibold tabular-nums text-foreground">
          {formatCount(consumed)}
          <span className="text-base font-normal text-muted-foreground"> / {formatCount(plan)} {unit}</span>
        </div>

        {/* Meter track. Fill wears a status token only when at/over the threshold; color is
            never the sole signal — the percentage and labels carry the meaning. */}
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${formatPercent(ratio)} of plan`}
        >
          <div
            className={cn('h-full rounded-full', currentOverage || nearingLimit ? 'bg-destructive' : 'bg-primary')}
            style={{ width: `${fillPct}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className={cn('font-medium tabular-nums', nearingLimit ? 'text-destructive' : 'text-foreground')}>
            {formatPercent(ratio)} of plan used
          </span>
          <span className="text-muted-foreground tabular-nums">
            Projected {formatCount(projected)} {unit} ({formatPercent(projectedRatio)})
          </span>
        </div>

        {(currentOverage || projectedOverage) ? (
          <div className="inline-flex items-center gap-1.5 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {currentOverage
              ? `Over plan by ${formatCount(consumed - plan)} ${unit} this cycle`
              : `Projected to exceed plan by ${formatCount(projected - plan)} ${unit}`}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Client-side CSV download — honest mock, never a link to a nonexistent PDF. */
function downloadCsv(filename: string, rows: readonly (readonly string[])[]): void {
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function BillingClient() {
  const { session, org } = useSession();
  const fixture = getFixture(session.orgId);

  const minutes = projectToCycleEnd(fixture.minutesConsumed);
  const chat = projectToCycleEnd(fixture.chatSessionsConsumed);

  const projectionTooltip = `Estimate only. Linear run-rate: usage so far (day ${minutes.dayOfCycle} of ${minutes.daysInCycle}) divided by days elapsed, multiplied by days in the cycle. Not a commitment.`;

  // Consumption breakdown by agent (from recorded call minutes this cycle).
  const minutesByAgent = useMemo(() => {
    const totals = new Map<string, number>(AGENT_IDS.map((id) => [id, 0]));
    for (const call of fixture.calls) {
      totals.set(call.agent, (totals.get(call.agent) ?? 0) + call.durationSeconds);
    }
    return AGENT_IDS.map((id) => ({ id, minutes: Math.round((totals.get(id) ?? 0) / 60) })).filter(
      (a) => a.minutes > 0,
    );
  }, [fixture.calls]);

  // Consumption breakdown by location (call minutes + chat sessions).
  const byLocation = useMemo(() => {
    const mins = new Map<string, number>();
    const sessions = new Map<string, number>();
    for (const call of fixture.calls) mins.set(call.locationId, (mins.get(call.locationId) ?? 0) + call.durationSeconds);
    for (const chatSession of fixture.chats) sessions.set(chatSession.locationId, (sessions.get(chatSession.locationId) ?? 0) + 1);
    return org.locations.map((l) => ({
      id: l.id,
      name: l.name,
      minutes: Math.round((mins.get(l.id) ?? 0) / 60),
      sessions: sessions.get(l.id) ?? 0,
    }));
  }, [fixture.calls, fixture.chats, org.locations]);

  const agentLabels = minutesByAgent.map((a) => AGENT_LABELS[a.id as (typeof AGENT_IDS)[number]] ?? a.id);
  const locationLabels = byLocation.map((l) => l.name);

  const overageInvoiceHistory = fixture.invoices;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usage and Billing"
        description="Current-cycle consumption against your plan, broken down by agent and location, with invoices. Plan and pricing changes are handled by your account manager, not here."
      />

      <Banner variant="default" title="Plan changes are an account-manager workflow">
        Plans and pricing cannot be edited in the client dashboard. To change your plan, contact
        your account manager. This page is read-only reporting.
      </Banner>

      {/* §16.4 — voice minutes and chat sessions are metered SEPARATELY: two distinct meters. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <UsageMeter
          label="Voice minutes this cycle"
          consumed={fixture.minutesConsumed}
          plan={org.planMinutes}
          unit="min"
          projected={minutes.projected}
          projectionTooltip={projectionTooltip}
        />
        <UsageMeter
          label="Chat sessions this cycle"
          consumed={fixture.chatSessionsConsumed}
          plan={org.planChatSessions}
          unit="sessions"
          projected={chat.projected}
          projectionTooltip={projectionTooltip}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Voice minutes and chat sessions are metered separately and are never combined into a single
        number. The overage indicator triggers at {formatPercent(USAGE_BANNER_THRESHOLD)} of plan,
        the same threshold that drives the Overview attention banner.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart
          title="Voice minutes by agent"
          description="Recorded call minutes this cycle, by agent."
          footnote="Derived from recorded call activity in this cycle; the plan meter above is the metered cycle total."
          variant="stacked"
          xLabels={agentLabels}
          series={[{ key: 'minutes', label: 'Minutes', color: CHART_1, values: minutesByAgent.map((a) => a.minutes) }]}
          formatValue={(v) => formatCount(v)}
          tableData={{
            columns: ['Agent', 'Minutes'],
            rows: minutesByAgent.map((a, i) => [agentLabels[i], formatCount(a.minutes)]),
          }}
        />
        <BarChart
          title="Voice minutes by location"
          description="Recorded call minutes this cycle, by location."
          footnote="Chat sessions per location are shown in the accompanying table."
          variant="stacked"
          xLabels={locationLabels}
          series={[{ key: 'minutes', label: 'Minutes', color: CHART_1, values: byLocation.map((l) => l.minutes) }]}
          formatValue={(v) => formatCount(v)}
          tableData={{
            columns: ['Location', 'Minutes', 'Chat sessions'],
            rows: byLocation.map((l) => [l.name, formatCount(l.minutes), formatCount(l.sessions)]),
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices and past cycles</CardTitle>
        </CardHeader>
        <CardContent>
          <Table caption="Invoice history with downloadable summaries">
            <TableHeader>
              <TableRow>
                <TableHead>Billing period</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overageInvoiceHistory.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium text-foreground">{inv.periodLabel}</TableCell>
                  <TableCell className="tabular-nums">{formatUsd(inv.amountUsd)}</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === 'due' ? 'warning' : 'secondary'}>
                      {inv.status === 'due' ? 'Due' : 'Paid'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Download invoice summary for ${inv.periodLabel} as CSV`}
                      onClick={() =>
                        downloadCsv(`invoice-${inv.periodLabel.replace(/\s+/g, '-').toLowerCase()}.csv`, [
                          ['Billing period', 'Amount (USD)', 'Status'],
                          [inv.periodLabel, String(inv.amountUsd), inv.status],
                        ])
                      }
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Download className="h-4 w-4" aria-hidden="true" />
                        CSV
                      </span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Invoice downloads are generated as CSV summaries in this demo; there is no billing PDF
            service connected.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
