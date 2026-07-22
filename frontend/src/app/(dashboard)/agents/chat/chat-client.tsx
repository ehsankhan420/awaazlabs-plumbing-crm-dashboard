'use client';

/**
 * §9 CHAT AGENTS TAB — WhatsApp + web-chat analytics.
 *
 * Renders through the §2.6 standard template (`AgentAnalyticsPage`): stat cards (with the
 * §9.1 paired containment/resolution reading rule as an adjacent pair under a shared
 * caption), one primary chart (the four-metric grouped bars), one distribution component
 * (intent donut), the remaining §9.2 charts in the `extra` slot, and the §9.3 drill-through
 * into Conversations › Chats.
 *
 * Aggregate by nature — no customer name, phone, recording, or transcript is read — identical
 * in standard and restricted mode.
 */

import React, { useMemo, useState } from 'react';

import { AgentAnalyticsPage } from '@/components/agent-template/agent-analytics-page';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { BarChart } from '@/components/charts/bar-chart';
import { DistributionBar } from '@/components/charts/distribution-bar';
import { DonutChart } from '@/components/charts/donut-chart';
import { CHAT_CHANNEL_SERIES, CHAT_METRIC_SERIES } from '@/components/charts/series-map';
import { formatCount, formatMs, formatPercent } from '@/lib/format';
import { FIRST_AUDIO_TARGET_MS, scopeToLocation } from '@/lib/metrics';
import { getFixture } from '@/mock/fixtures';
import { useSession } from '@/shared/session-context';
import { CHAT_CHANNELS, LANGUAGE_LABELS } from '@/shared/status-models';

import { ContainmentResolutionPair } from './containment-resolution-pair';
import {
  CHAT_INTENT_LABELS,
  CHAT_INTENT_SERIES,
  CHAT_METRIC_LABELS,
  CHAT_METRIC_ORDER,
  LANGUAGE_SERIES,
  PERIOD_OPTIONS,
  chatMetricRates,
  computeChatStats,
  filterChatsByPeriod,
  intentDistribution,
  languageDistribution,
  sessionsByChannelOverTime,
} from './chat-analytics';

const DRILL_THROUGH = { href: '/conversations/chats', label: 'View chat conversations' } as const;
const WEEKS = 8;

function pct(rate: number | null): string {
  return rate === null ? '—' : formatPercent(rate);
}

export function ChatClient(): React.JSX.Element {
  const { session } = useSession();
  const fixture = getFixture(session.orgId);

  const [periodValue, setPeriodValue] = useState('30');
  const period = PERIOD_OPTIONS.find((p) => p.value === periodValue) ?? PERIOD_OPTIONS[1];

  const scoped = useMemo(() => scopeToLocation(fixture.chats, session), [fixture.chats, session]);
  const chats = useMemo(() => filterChatsByPeriod(scoped, period.days), [scoped, period.days]);

  const stats = useMemo(() => computeChatStats(chats), [chats]);
  const metricRates = useMemo(() => chatMetricRates(stats), [stats]);
  const intent = useMemo(() => intentDistribution(chats), [chats]);
  const language = useMemo(() => languageDistribution(chats), [chats]);
  const overTime = useMemo(() => sessionsByChannelOverTime(chats, WEEKS), [chats]);

  const isEmpty = chats.length === 0;

  const headerActions = (
    <Select
      aria-label="Reporting period"
      value={periodValue}
      onValueChange={setPeriodValue}
      options={PERIOD_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
    />
  );

  const channelLabel: Readonly<Record<(typeof CHAT_CHANNELS)[number], string>> = {
    web_chat: 'Web Chat',
    sms: 'SMS',
    whatsapp: 'WhatsApp',
  };

  const statCards = (
    <>
      <StatCard
        label="Sessions"
        value={formatCount(stats.sessions)}
        subStats={[
          { label: channelLabel.whatsapp, value: formatCount(stats.whatsapp) },
          { label: channelLabel.web_chat, value: formatCount(stats.webChat) },
        ]}
        tooltip={`Chat sessions in the selected period (${period.label}), split by channel.`}
      />
      <StatCard
        label="Avg messages / session"
        value={stats.avgMessagesPerSession === null ? '—' : stats.avgMessagesPerSession.toFixed(1)}
        tooltip="Mean number of messages exchanged per chat session."
      />
      <ContainmentResolutionPair
        containment={pct(stats.containmentRate)}
        resolution={pct(stats.resolutionRate)}
      />
      <StatCard
        label="Deflection rate"
        value={pct(stats.deflectionRate)}
        tooltip="Sessions completed in text without needing a call or a human handoff."
      />
      <StatCard
        label="Escalation rate"
        value={pct(stats.escalationRate)}
        tooltip="Sessions handed to a human. A legitimate safety outcome, not a failure."
      />
      <StatCard
        label="Jobs from chat"
        value={formatCount(stats.bookings)}
        subStats={[{ label: 'Conversion (of job-intent)', value: pct(stats.bookingConversion) }]}
        tooltip="Jobs created in chat, and the conversion rate over sessions that carried job intent."
      />
      <StatCard
        label="Response latency"
        value={stats.avgLatencyMs === null ? '—' : formatMs(stats.avgLatencyMs)}
        subStats={[
          { label: 'P95', value: stats.p95LatencyMs === null ? '—' : formatMs(stats.p95LatencyMs) },
          { label: 'Target', value: `< ${formatMs(FIRST_AUDIO_TARGET_MS)}` },
        ]}
        tooltip={`Average and 95th-percentile first-response latency. Target is under ${formatMs(FIRST_AUDIO_TARGET_MS)}.`}
      />
      <StatCard
        label="CSAT proxy"
        value={stats.csatProxy === null ? '—' : `${stats.csatProxy} / 5`}
        tooltip="A CSAT-style score out of 5, derived from the QA grade of graded sessions."
      />
    </>
  );

  const metricPercent = (key: (typeof CHAT_METRIC_ORDER)[number]): number => {
    const rate = metricRates[key];
    return rate === null ? 0 : Math.round(rate * 100);
  };

  const primaryChart = (
    <BarChart
      title="Containment · Resolution · Deflection · Escalation"
      description="Four distinct outcome rates side by side. Escalation is a categorical outcome, not painted as a failure."
      variant="grouped"
      xLabels={['All sessions']}
      series={CHAT_METRIC_ORDER.map((key) => ({
        key,
        label: CHAT_METRIC_LABELS[key],
        color: CHAT_METRIC_SERIES[key],
        values: [metricPercent(key)],
      }))}
      formatValue={(v) => `${v}%`}
      tableData={{
        columns: ['Metric', 'Rate'],
        rows: CHAT_METRIC_ORDER.map((key) => [
          CHAT_METRIC_LABELS[key],
          metricRates[key] === null ? '—' : `${Math.round((metricRates[key] as number) * 100)}%`,
        ]),
      }}
    />
  );

  const intentDonut = (
    <DonutChart
      title="Intent distribution"
      description="What customers came to chat about."
      centerLabel="sessions"
      slices={intent.map((i) => ({
        key: i.key,
        label: CHAT_INTENT_LABELS[i.key],
        value: i.count,
        color: CHAT_INTENT_SERIES[i.key],
      }))}
      tableData={{
        columns: ['Intent', 'Sessions'],
        rows: intent.map((i) => [CHAT_INTENT_LABELS[i.key], String(i.count)]),
      }}
    />
  );

  const extra = (
    <div className="flex flex-col gap-6">
      <BarChart
        title="Sessions over time by channel"
        description="Weekly chat session volume, stacked by channel."
        variant="stacked"
        xLabels={overTime.labels}
        series={[
          {
            key: 'whatsapp',
            label: channelLabel.whatsapp,
            color: CHAT_CHANNEL_SERIES.whatsapp,
            values: [...overTime.whatsapp],
          },
          {
            key: 'web_chat',
            label: channelLabel.web_chat,
            color: CHAT_CHANNEL_SERIES.web_chat,
            values: [...overTime.webChat],
          },
        ]}
        showStackTotals
        formatValue={(v) => formatCount(v)}
        tableData={{
          columns: ['Week', channelLabel.whatsapp, channelLabel.web_chat],
          rows: overTime.labels.map((l, i) => [
            l,
            String(overTime.whatsapp[i]),
            String(overTime.webChat[i]),
          ]),
        }}
      />
      <DistributionBar
        title="Language mix"
        description="Language of chat sessions (English, Spanish, other)."
        segments={language.map((l) => ({
          key: l.key,
          label: LANGUAGE_LABELS[l.key],
          value: l.count,
          color: LANGUAGE_SERIES[l.key],
        }))}
        formatValue={(v) => formatCount(v)}
        tableData={{
          columns: ['Language', 'Sessions'],
          rows: language.map((l) => [LANGUAGE_LABELS[l.key], String(l.count)]),
        }}
      />
    </div>
  );

  return (
    <AgentAnalyticsPage
      agentName="Chat Agents"
      description="Performance of the WhatsApp and landing-page chat agents, which perform the receptionist function on text channels."
      specRef="§9"
      headerActions={headerActions}
      stats={statCards}
      primaryChart={primaryChart}
      distribution={intentDonut}
      extra={extra}
      drillThrough={DRILL_THROUGH}
      isEmpty={isEmpty}
      emptyState={
        <EmptyState
          title="No chat sessions in this period"
          description="Widen the reporting period or clear the location filter to see chat analytics."
        />
      }
    />
  );
}
