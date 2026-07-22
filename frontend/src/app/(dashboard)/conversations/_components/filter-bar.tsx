'use client';

/**
 * §10.3 The single, shared Conversations filter bar. Rendered once by the conversations
 * layout and used by BOTH sub-views. Controls: free-text search, date range, agent,
 * channel, direction, disposition, priority, QA grade band, location.
 *
 * Every option label is imported from `@/shared/status-models` (or the grade-band model in
 * ./filters). No status string literal, no color literal.
 */

import React from 'react';
import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, type SelectOption } from '@/components/ui/select';
import {
  AGENT_LABELS,
  AGENT_IDS,
  CALL_DIRECTIONS,
  CALL_DISPOSITIONS,
  CALL_DISPOSITION_LABELS,
  CHAT_CHANNELS,
  CHAT_CHANNEL_LABELS,
  CUSTOM_AGENT_IDS,
  JOB_PRIORITIES,
  JOB_PRIORITY_LABELS,
  type CallDirection,
  type CallDisposition,
  type ChatChannel,
  type InteractionAgentId,
  type JobPriority,
} from '@/shared/status-models';
import type { MockLocation } from '@/mock/schema';

import { useConversationFilters } from './conversations-provider';
import {
  DEFAULT_FILTERS,
  GRADE_BANDS,
  GRADE_BAND_LABELS,
  type ConversationFilters,
  type GradeBand,
} from './filters';

/**
 * The VOICE agents (chat sessions live in the Chats sub-view, filtered by channel, not by
 * agent). Custom agents append after the standard ones.
 */
const VOICE_AGENT_IDS: readonly InteractionAgentId[] = [
  ...AGENT_IDS.filter((a) => a !== 'chat'),
  ...CUSTOM_AGENT_IDS,
];

const agentOptions: readonly SelectOption[] = [
  { value: 'all', label: 'All agents' },
  ...VOICE_AGENT_IDS.map((a) => ({ value: a, label: AGENT_LABELS[a] })),
];

const channelOptions: readonly SelectOption[] = [
  { value: 'all', label: 'All channels' },
  ...CHAT_CHANNELS.map((c) => ({ value: c, label: CHAT_CHANNEL_LABELS[c] })),
];

const directionOptions: readonly SelectOption[] = [
  { value: 'all', label: 'All directions' },
  ...CALL_DIRECTIONS.map((d) => ({ value: d, label: d === 'inbound' ? 'Inbound' : 'Outbound' })),
];

const dispositionOptions: readonly SelectOption[] = [
  { value: 'all', label: 'All outcomes' },
  ...CALL_DISPOSITIONS.map((d) => ({ value: d, label: CALL_DISPOSITION_LABELS[d] })),
];

const priorityOptions: readonly SelectOption[] = [
  { value: 'all', label: 'All priorities' },
  ...JOB_PRIORITIES.map((p) => ({ value: p, label: JOB_PRIORITY_LABELS[p] })),
];

const gradeBandOptions: readonly SelectOption[] = GRADE_BANDS.map((b) => ({
  value: b,
  label: GRADE_BAND_LABELS[b],
}));

export function ConversationsFilterBar({
  locations,
  showLocationFilter,
}: {
  locations: readonly MockLocation[];
  showLocationFilter: boolean;
}): React.JSX.Element {
  const { filters, setFilters } = useConversationFilters();

  const locationOptions: readonly SelectOption[] = [
    { value: 'all', label: 'All locations' },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];

  const patch = (next: Partial<ConversationFilters>) => setFilters({ ...filters, ...next });
  const isDirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <span className="sr-only">
            Search conversations by customer name, plumber name, phone, job reference, or conversation reference
          </span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => patch({ search: e.target.value })}
            placeholder="Search customer, plumber, phone, or reference…"
            className="w-full rounded-md border border-input bg-transparent py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        {isDirty ? (
          <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
            <X className="mr-1 h-3 w-3" aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filter by agent"
          value={filters.agent}
          onValueChange={(v) => patch({ agent: v as InteractionAgentId | 'all' })}
          options={agentOptions}
        />
        <Select
          aria-label="Filter by channel"
          value={filters.channel}
          onValueChange={(v) => patch({ channel: v as ChatChannel | 'all' })}
          options={channelOptions}
        />
        <Select
          aria-label="Filter by direction"
          value={filters.direction}
          onValueChange={(v) => patch({ direction: v as CallDirection | 'all' })}
          options={directionOptions}
        />
        <Select
          aria-label="Filter by outcome"
          value={filters.disposition}
          onValueChange={(v) => patch({ disposition: v as CallDisposition | 'all' })}
          options={dispositionOptions}
        />
        <Select
          aria-label="Filter by priority"
          value={filters.priority}
          onValueChange={(v) => patch({ priority: v as JobPriority | 'all' })}
          options={priorityOptions}
        />
        <Select
          aria-label="Filter by QA grade band"
          value={filters.gradeBand}
          onValueChange={(v) => patch({ gradeBand: v as GradeBand })}
          options={gradeBandOptions}
        />
        {showLocationFilter ? (
          <Select
            aria-label="Filter by location"
            value={filters.locationId}
            onValueChange={(v) => patch({ locationId: v })}
            options={locationOptions}
          />
        ) : null}

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>From</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => patch({ dateFrom: e.target.value })}
              aria-label="Filter conversations from date"
              className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>To</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => patch({ dateTo: e.target.value })}
              aria-label="Filter conversations to date"
              className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
