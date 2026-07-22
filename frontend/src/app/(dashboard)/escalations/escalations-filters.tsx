'use client';

/**
 * §5.4 filters: date range, status, severity, trigger, escalation owner, business
 * location, and search by customer, phone, job reference, or escalation reference.
 * Search is the first control (§4.8). Presentational only — the client owns filter state.
 */

import React from 'react';
import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, type SelectOption } from '@/components/ui/select';
import {
  ESCALATION_SEVERITIES,
  ESCALATION_SEVERITY_LABELS,
  ESCALATION_STATUSES,
  ESCALATION_STATUS_LABELS,
  ESCALATION_TRIGGERS,
  ESCALATION_TRIGGER_LABELS,
} from '@/shared/status-models';

export const ALL_FILTER_VALUE = '__all__';

const STATUS_OPTIONS: SelectOption[] = [
  { value: ALL_FILTER_VALUE, label: 'All statuses' },
  { value: 'pending', label: 'Pending (not resolved)' },
  ...ESCALATION_STATUSES.map((s) => ({ value: s, label: ESCALATION_STATUS_LABELS[s] })),
];

const SEVERITY_OPTIONS: SelectOption[] = [
  { value: ALL_FILTER_VALUE, label: 'All severities' },
  ...ESCALATION_SEVERITIES.map((s) => ({ value: s, label: ESCALATION_SEVERITY_LABELS[s] })),
];

const TRIGGER_OPTIONS: SelectOption[] = [
  { value: ALL_FILTER_VALUE, label: 'All triggers' },
  ...ESCALATION_TRIGGERS.map((t) => ({ value: t, label: ESCALATION_TRIGGER_LABELS[t] })),
];

export function EscalationsFilters({
  search,
  status,
  severity,
  trigger,
  owner,
  location,
  dateFrom,
  dateTo,
  owners,
  locations,
  showLocationFilter,
  isDirty,
  onSearch,
  onStatus,
  onSeverity,
  onTrigger,
  onOwner,
  onLocation,
  onDateFrom,
  onDateTo,
  onClear,
}: {
  search: string;
  status: string;
  severity: string;
  trigger: string;
  owner: string;
  location: string;
  dateFrom: string;
  dateTo: string;
  owners: readonly string[];
  locations: readonly { id: string; name: string }[];
  showLocationFilter: boolean;
  isDirty: boolean;
  onSearch: (v: string) => void;
  onStatus: (v: string) => void;
  onSeverity: (v: string) => void;
  onTrigger: (v: string) => void;
  onOwner: (v: string) => void;
  onLocation: (v: string) => void;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onClear: () => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[14rem]">
          <span className="sr-only">Search by customer, phone, job reference, or escalation reference</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search customer, phone, job reference, or escalation reference…"
            className="w-full rounded-md border border-input bg-transparent py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        {isDirty ? (
          <Button variant="outline" size="sm" onClick={onClear}>
            <X className="mr-1 h-3 w-3" aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Filter by status" value={status} onValueChange={onStatus} options={STATUS_OPTIONS} />
        <Select aria-label="Filter by severity" value={severity} onValueChange={onSeverity} options={SEVERITY_OPTIONS} />
        <Select aria-label="Filter by trigger" value={trigger} onValueChange={onTrigger} options={TRIGGER_OPTIONS} />
        <Select
          aria-label="Filter by escalation owner"
          value={owner}
          onValueChange={onOwner}
          options={[
            { value: ALL_FILTER_VALUE, label: 'Any owner' },
            { value: '__unowned__', label: 'Unowned' },
            ...owners.map((o) => ({ value: o, label: o })),
          ]}
        />
        {showLocationFilter ? (
          <Select
            aria-label="Filter by business location"
            value={location}
            onValueChange={onLocation}
            options={[
              { value: ALL_FILTER_VALUE, label: 'All locations' },
              ...locations.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
        ) : null}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFrom(e.target.value)}
              aria-label="Filter escalations from date"
              className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateTo(e.target.value)}
              aria-label="Filter escalations to date"
              className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
