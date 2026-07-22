'use client';

/**
 * §4.5 Section E — Operational telemetry.
 *
 * Every headline number and every chart bucket comes from the backend
 * `?resource=telemetry_stats` aggregate (via `useLiveTelemetry`): calls/minutes
 * today, avg duration/cost/first-audio, success rate, per-agent interaction
 * counts, and the server-computed daily series. The front end no longer
 * re-aggregates a capped row list — it only slices the trailing 7/30 days out of
 * the 30-day server window and renders. Calls over time and minutes over time are
 * TWO SEPARATE LineCharts (never a dual axis, per THEME_NOTES §8); first-audio
 * response is a third LineChart carrying the 800 ms target line. All three share
 * one 7D/30D toggle.
 *
 * Agents with no live source (verifier / review_taker / reengagement) honestly
 * report 0; `chat` is chat-session count. "Overall" = voice calls; "All" = every
 * interaction across channels.
 */

import React, { useState } from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { StatGridSkeleton } from '@/components/ui/skeleton';
import { LineChart } from '@/components/charts/line-chart';
import { AGENT_IDS, AGENT_LABELS } from '@/shared/status-models';
import { formatCount, formatDuration, formatMs, formatPercent, formatUsdPrecise } from '@/lib/format';
import { FIRST_AUDIO_TARGET_MS } from '@/lib/metrics';
import type { TelemetryStatsDto } from '@/lib/dashboard-live';
import type { GatedRows, Session } from '@/mock/data-access';
import type { CallInteractionView } from '@/mock/data-access';
import { LiveCallsPanel } from '@/components/live/live-calls-panel';
import { RangeTabs, type RangeDays } from '../range-tabs';

const CONVERSATIONS_HREF = '/conversations/calls';

/** "Jul 5" label from a server YYYY-MM-DD bucket key (rendered date-only, no tz shift). */
function dayLabelFromIso(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

function InteractionTile({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }): React.JSX.Element {
  return (
    <div className={emphasize ? 'rounded-md border border-border bg-muted/40 p-3' : 'rounded-md border border-border p-3'}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function TelemetrySection({
  telemetry,
  refreshedAtLabel,
  session,
  liveCalls,
  loading = false,
}: {
  telemetry: TelemetryStatsDto | null;
  refreshedAtLabel: string;
  session: Session;
  liveCalls: GatedRows<CallInteractionView>;
  loading?: boolean;
}): React.JSX.Element {
  const [days, setDays] = useState<RangeDays>(7);

  const perAgent = AGENT_IDS.map((id) => ({
    id,
    label: AGENT_LABELS[id],
    count: telemetry?.interactionsByAgent[id] ?? 0,
  }));
  const overall = telemetry?.overallVoice ?? 0;
  const all = telemetry?.allChannels ?? 0;

  // Slice the trailing `days` out of the 30-day server window; the server owns
  // the buckets, so lengths stay aligned across labels and every series.
  const series = telemetry?.series;
  const xLabels = series ? series.days.slice(-days).map(dayLabelFromIso) : new Array<string>(days).fill('');
  const callsSeries = series ? series.calls.slice(-days) : new Array<number>(days).fill(0);
  const minutesSeries = series ? series.minutes.slice(-days) : new Array<number>(days).fill(0);
  const firstAudioSeries = series ? series.firstAudioMs.slice(-days) : new Array<number | null>(days).fill(null);

  const avgDuration = telemetry?.avgDurationSeconds ?? null;
  const avgCost = telemetry?.avgCostPerInteractionUsd ?? null;
  const successRate = telemetry?.successRate ?? null;
  const avgFirstAudio = telemetry?.avgFirstAudioResponseMs ?? null;
  const mostRecent = telemetry?.mostRecentCall ?? null;

  return (
    <section aria-labelledby="overview-telemetry">
      <h2 id="overview-telemetry" className="pb-3 text-lg font-semibold tracking-tight text-foreground">
        Operational telemetry
      </h2>

      {/* Interactions row — per agent, plus Overall and All */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <p className="pb-3 text-sm font-medium text-muted-foreground">Interactions by agent</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {perAgent.map((a) => (
            <InteractionTile key={a.id} label={a.label} value={formatCount(a.count)} />
          ))}
          <InteractionTile label="Overall (voice)" value={formatCount(overall)} emphasize />
          <InteractionTile label="All (all channels)" value={formatCount(all)} emphasize />
        </div>
      </div>

      {/* Volume + cost stat cards */}
      {loading ? (
        <div className="mt-4">
          <StatGridSkeleton cards={4} />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Calls today" value={telemetry?.callsToday ?? 0} format="number" href={CONVERSATIONS_HREF} />
          <StatCard label="Minutes today" value={telemetry?.minutesToday ?? 0} format="number" href={CONVERSATIONS_HREF} />
          <StatCard
            label="Average duration"
            value={avgDuration === null ? '—' : formatDuration(avgDuration)}
            format="text"
            href={CONVERSATIONS_HREF}
          />
          <StatCard
            label="Average cost per interaction"
            value={avgCost === null ? '—' : formatUsdPrecise(avgCost)}
            format="text"
            href={CONVERSATIONS_HREF}
          />
        </div>
      )}

      {/* Success rate + live calls */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Success rate"
          value={successRate === null ? '—' : formatPercent(successRate)}
          format="text"
          href={CONVERSATIONS_HREF}
          subStats={[
            {
              label: 'Completed / attempted',
              value: `${formatCount(telemetry?.completedCount ?? 0)} / ${formatCount(telemetry?.attemptedCount ?? 0)}`,
            },
          ]}
        />
        <LiveCallsPanel snapshot={liveCalls} session={session} title="Live calls now" refreshedAtLabel={refreshedAtLabel} />
      </div>

      {/* Over-time charts — one shared 7D/30D toggle, one y-axis each */}
      <div className="mt-4 flex justify-end">
        <RangeTabs value={days} onChange={setDays} label="Telemetry time range" />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LineChart
          title="Calls over time"
          description={`Trailing ${days} days`}
          xLabels={xLabels}
          series={[{ key: 'calls', label: 'Calls', color: 'var(--chart-1)', values: callsSeries }]}
          formatValue={(v) => formatCount(v)}
          tableData={{ columns: ['Day', 'Calls'], rows: xLabels.map((l, i) => [l, formatCount(callsSeries[i] ?? 0)]) }}
        />
        <LineChart
          title="Minutes over time"
          description={`Trailing ${days} days`}
          xLabels={xLabels}
          series={[{ key: 'minutes', label: 'Minutes', color: 'var(--chart-1)', values: minutesSeries }]}
          formatValue={(v) => formatCount(v)}
          tableData={{ columns: ['Day', 'Minutes'], rows: xLabels.map((l, i) => [l, formatCount(minutesSeries[i] ?? 0)]) }}
        />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:max-w-sm">
          <StatCard
            label="Most recent call latency"
            value={mostRecent === null ? '—' : formatMs(mostRecent.firstAudioResponseMs)}
            format="text"
            href={CONVERSATIONS_HREF}
          />
        </div>
        <LineChart
          title="Average first-audio response"
          description={
            avgFirstAudio === null
              ? `Trailing ${days} days`
              : `Trailing ${days} days · overall average ${formatMs(avgFirstAudio)}`
          }
          xLabels={xLabels}
          series={[{ key: 'first_audio', label: 'First-audio response', color: 'var(--chart-1)', values: firstAudioSeries }]}
          targetLine={{ value: FIRST_AUDIO_TARGET_MS, label: `Target ${FIRST_AUDIO_TARGET_MS} ms` }}
          formatValue={(v) => formatMs(v)}
          tableData={{
            columns: ['Day', 'First-audio response'],
            rows: xLabels.map((l, i) => {
              const fa = firstAudioSeries[i] ?? null;
              return [l, fa === null ? '—' : formatMs(fa)];
            }),
          }}
        />
      </div>
    </section>
  );
}
