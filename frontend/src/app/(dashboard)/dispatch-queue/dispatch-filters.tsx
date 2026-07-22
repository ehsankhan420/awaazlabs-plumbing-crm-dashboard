'use client';

/**
 * §5.5 queue-level controls: search plus filters (assignment status, job priority,
 * required specialty, service area, queue age, current candidate, assigned plumber,
 * escalation state, business location) and Bulk Retry Outreach on the filtered selection.
 * Bulk actions appear only after one or more rows are selected (§5.5).
 */

import React from 'react';
import { RefreshCw, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, type SelectOption } from '@/components/ui/select';
import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUSES,
  JOB_PRIORITIES,
  JOB_PRIORITY_LABELS,
  SPECIALTIES,
  SPECIALTY_LABELS,
  type AssignmentStatus,
  type JobPriority,
  type Specialty,
} from '@/shared/status-models';

export const AGE_FILTERS = ['all', 'fresh', 'amber', 'red'] as const;
export type AgeFilter = (typeof AGE_FILTERS)[number];

export const AGE_FILTER_LABELS: Readonly<Record<AgeFilter, string>> = {
  all: 'Any queue age',
  fresh: 'Within threshold',
  amber: 'Approaching threshold',
  red: 'Past threshold',
};

export const ESCALATION_STATE_FILTERS = ['all', 'escalated', 'not_escalated'] as const;
export type EscalationStateFilter = (typeof ESCALATION_STATE_FILTERS)[number];

const ESCALATION_STATE_LABELS: Readonly<Record<EscalationStateFilter, string>> = {
  all: 'Any escalation state',
  escalated: 'Has linked escalation',
  not_escalated: 'No linked escalation',
};

const ALL = '__all__';

function toOptions(values: readonly string[], labelFor: (v: string) => string, allLabel: string): SelectOption[] {
  return [{ value: ALL, label: allLabel }, ...values.map((v) => ({ value: v, label: labelFor(v) }))];
}

export function DispatchFilters({
  search,
  status,
  priority,
  specialty,
  serviceArea,
  age,
  candidate,
  plumber,
  escalationState,
  location,
  serviceAreas,
  candidates,
  plumbers,
  locations,
  showLocationFilter,
  onSearch,
  onStatus,
  onPriority,
  onSpecialty,
  onServiceArea,
  onAge,
  onCandidate,
  onPlumber,
  onEscalationState,
  onLocation,
  selectedCount,
  onBulkRetry,
  canAct,
}: {
  search: string;
  status: string;
  priority: string;
  specialty: string;
  serviceArea: string;
  age: AgeFilter;
  candidate: string;
  plumber: string;
  escalationState: EscalationStateFilter;
  location: string;
  serviceAreas: readonly { id: string; name: string }[];
  candidates: readonly string[];
  plumbers: readonly string[];
  locations: readonly { id: string; name: string }[];
  showLocationFilter: boolean;
  onSearch: (v: string) => void;
  onStatus: (v: string) => void;
  onPriority: (v: string) => void;
  onSpecialty: (v: string) => void;
  onServiceArea: (v: string) => void;
  onAge: (v: AgeFilter) => void;
  onCandidate: (v: string) => void;
  onPlumber: (v: string) => void;
  onEscalationState: (v: EscalationStateFilter) => void;
  onLocation: (v: string) => void;
  selectedCount: number;
  onBulkRetry: () => void;
  canAct: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">Search by customer, job reference, ZIP code, phone, or plumber</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search customer, job reference, ZIP, phone, or plumber…"
          className="w-full rounded-md border border-input bg-transparent py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filter by assignment status"
          value={status}
          onValueChange={onStatus}
          options={toOptions(
            [...ASSIGNMENT_STATUSES],
            (v) => ASSIGNMENT_STATUS_LABELS[v as AssignmentStatus],
            'All assignment statuses',
          )}
        />
        <Select
          aria-label="Filter by job priority"
          value={priority}
          onValueChange={onPriority}
          options={toOptions([...JOB_PRIORITIES], (v) => JOB_PRIORITY_LABELS[v as JobPriority], 'All priorities')}
        />
        <Select
          aria-label="Filter by required specialty"
          value={specialty}
          onValueChange={onSpecialty}
          options={toOptions([...SPECIALTIES], (v) => SPECIALTY_LABELS[v as Specialty], 'All specialties')}
        />
        <Select
          aria-label="Filter by service area"
          value={serviceArea}
          onValueChange={onServiceArea}
          options={toOptions(
            serviceAreas.map((a) => a.id),
            (id) => serviceAreas.find((a) => a.id === id)?.name ?? id,
            'All service areas',
          )}
        />
        <Select
          aria-label="Filter by queue age"
          value={age}
          onValueChange={(v) => onAge(v as AgeFilter)}
          options={AGE_FILTERS.map((a) => ({ value: a, label: AGE_FILTER_LABELS[a] }))}
        />
        <Select
          aria-label="Filter by current candidate"
          value={candidate}
          onValueChange={onCandidate}
          options={toOptions(candidates, (v) => v, 'Any current candidate')}
        />
        <Select
          aria-label="Filter by assigned plumber"
          value={plumber}
          onValueChange={onPlumber}
          options={toOptions(plumbers, (v) => v, 'Any assigned plumber')}
        />
        <Select
          aria-label="Filter by escalation state"
          value={escalationState}
          onValueChange={(v) => onEscalationState(v as EscalationStateFilter)}
          options={ESCALATION_STATE_FILTERS.map((s) => ({ value: s, label: ESCALATION_STATE_LABELS[s] }))}
        />
        {showLocationFilter ? (
          <Select
            aria-label="Filter by business location"
            value={location}
            onValueChange={onLocation}
            options={toOptions(
              locations.map((l) => l.id),
              (id) => locations.find((l) => l.id === id)?.name ?? id,
              'All locations',
            )}
          />
        ) : null}
      </div>

      {canAct && selectedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={onBulkRetry}>
            <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Bulk Retry Outreach ({selectedCount})
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export { ALL as ALL_FILTER_VALUE };
