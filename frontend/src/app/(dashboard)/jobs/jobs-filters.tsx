'use client';

/**
 * §5.2 Jobs filter card: date range, job status, assignment status, priority, issue type,
 * intake channel, required specialty, assigned plumber, service area, business location,
 * language, and free-text search. Every option label comes from a `*_LABELS` map in
 * status-models.ts; none is hardcoded. Search is the first control (§4.8).
 */

import React from 'react';
import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, type SelectOption } from '@/components/ui/select';
import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUSES,
  INTAKE_CHANNEL_LABELS,
  INTAKE_CHANNELS,
  ISSUE_TYPE_LABELS,
  ISSUE_TYPES,
  JOB_PRIORITIES,
  JOB_PRIORITY_LABELS,
  JOB_STATUS_LABELS,
  JOB_STATUSES,
  LANGUAGE_LABELS,
  LANGUAGES,
  SPECIALTIES,
  SPECIALTY_LABELS,
  type AssignmentStatus,
  type IntakeChannel,
  type IssueType,
  type JobPriority,
  type JobStatus,
  type Language,
  type Specialty,
} from '@/shared/status-models';
import type { MockLocation, Plumber, ServiceArea } from '@/mock/schema';

import { DEFAULT_FILTERS, type JobFilters } from './types';

const statusOptions: readonly SelectOption[] = [
  { value: 'all', label: 'All job statuses' },
  ...JOB_STATUSES.map((s) => ({ value: s, label: JOB_STATUS_LABELS[s] })),
];

const assignmentOptions: readonly SelectOption[] = [
  { value: 'all', label: 'All assignment statuses' },
  { value: 'none', label: 'No dispatch record' },
  ...ASSIGNMENT_STATUSES.map((s) => ({ value: s, label: ASSIGNMENT_STATUS_LABELS[s] })),
];

const priorityOptions: readonly SelectOption[] = [
  { value: 'all', label: 'All priorities' },
  ...JOB_PRIORITIES.map((p) => ({ value: p, label: JOB_PRIORITY_LABELS[p] })),
];

const issueOptions: readonly SelectOption[] = [
  { value: 'all', label: 'All issue types' },
  ...ISSUE_TYPES.map((i) => ({ value: i, label: ISSUE_TYPE_LABELS[i] })),
];

const channelOptions: readonly SelectOption[] = [
  { value: 'all', label: 'All intake channels' },
  ...INTAKE_CHANNELS.map((c) => ({ value: c, label: INTAKE_CHANNEL_LABELS[c] })),
];

const specialtyOptions: readonly SelectOption[] = [
  { value: 'all', label: 'All specialties' },
  ...SPECIALTIES.map((s) => ({ value: s, label: SPECIALTY_LABELS[s] })),
];

const languageOptions: readonly SelectOption[] = [
  { value: 'all', label: 'All languages' },
  ...LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] })),
];

export function JobsFilters({
  filters,
  onChange,
  locations,
  serviceAreas,
  plumbers,
  showLocationFilter,
}: {
  filters: JobFilters;
  onChange: (next: JobFilters) => void;
  locations: readonly MockLocation[];
  serviceAreas: readonly ServiceArea[];
  plumbers: readonly Plumber[];
  showLocationFilter: boolean;
}) {
  const locationOptions: readonly SelectOption[] = [
    { value: 'all', label: 'All locations' },
    ...locations.map((l) => ({ value: l.id, label: l.name })),
  ];

  const areaOptions: readonly SelectOption[] = [
    { value: 'all', label: 'All service areas' },
    ...serviceAreas.map((a) => ({ value: a.id, label: a.name })),
  ];

  const plumberOptions: readonly SelectOption[] = [
    { value: 'all', label: 'All plumbers' },
    ...plumbers.map((p) => ({ value: p.id, label: p.name })),
  ];

  const isDirty = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[14rem]">
          <span className="sr-only">Search jobs by customer name, phone, job reference, ZIP code, or service address</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search customer, phone, job reference, ZIP, or address…"
            className="w-full rounded-md border border-input bg-transparent py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        {isDirty ? (
          <Button variant="outline" size="sm" onClick={() => onChange(DEFAULT_FILTERS)}>
            <X className="mr-1 h-3 w-3" aria-hidden="true" />
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Filter by job status"
          value={filters.status}
          onValueChange={(v) => onChange({ ...filters, status: v as JobStatus | 'all' })}
          options={statusOptions}
        />
        <Select
          aria-label="Filter by assignment status"
          value={filters.assignmentStatus}
          onValueChange={(v) => onChange({ ...filters, assignmentStatus: v as AssignmentStatus | 'none' | 'all' })}
          options={assignmentOptions}
        />
        <Select
          aria-label="Filter by priority"
          value={filters.priority}
          onValueChange={(v) => onChange({ ...filters, priority: v as JobPriority | 'all' })}
          options={priorityOptions}
        />
        <Select
          aria-label="Filter by issue type"
          value={filters.issueType}
          onValueChange={(v) => onChange({ ...filters, issueType: v as IssueType | 'all' })}
          options={issueOptions}
        />
        <Select
          aria-label="Filter by intake channel"
          value={filters.intakeChannel}
          onValueChange={(v) => onChange({ ...filters, intakeChannel: v as IntakeChannel | 'all' })}
          options={channelOptions}
        />
        <Select
          aria-label="Filter by required specialty"
          value={filters.requiredSpecialty}
          onValueChange={(v) => onChange({ ...filters, requiredSpecialty: v as Specialty | 'all' })}
          options={specialtyOptions}
        />
        <Select
          aria-label="Filter by assigned plumber"
          value={filters.assignedPlumberId}
          onValueChange={(v) => onChange({ ...filters, assignedPlumberId: v })}
          options={plumberOptions}
        />
        <Select
          aria-label="Filter by service area"
          value={filters.serviceAreaId}
          onValueChange={(v) => onChange({ ...filters, serviceAreaId: v })}
          options={areaOptions}
        />
        {showLocationFilter ? (
          <Select
            aria-label="Filter by business location"
            value={filters.locationId}
            onValueChange={(v) => onChange({ ...filters, locationId: v })}
            options={locationOptions}
          />
        ) : null}
        <Select
          aria-label="Filter by language"
          value={filters.language}
          onValueChange={(v) => onChange({ ...filters, language: v as Language | 'all' })}
          options={languageOptions}
        />

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>From</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
              aria-label="Filter jobs from date"
              className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>To</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
              aria-label="Filter jobs to date"
              className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
