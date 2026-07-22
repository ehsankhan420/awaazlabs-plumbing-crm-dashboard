'use client';

/**
 * §5.2 Calendar view. Day and Week agenda rendering of the same filtered data.
 * The calendar displays the Requested Service Window until a Scheduled Arrival Window
 * exists, and does not support drag-to-reschedule.
 */

import React, { useMemo, useState } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { JobStatusChip, PriorityChip } from '@/components/ui/status-chip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatTime, timezoneFor } from '@/lib/format';
import { mockNow } from '@/mock/orgs';
import type { JobView, Session } from '@/mock/data-access';

import { dateKeyWindow, effectiveWindow, localDateKey } from './types';

function dayLabel(key: string): string {
  const d = new Date(`${key}T12:00:00.000Z`);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function JobsCalendar({
  rows,
  session,
  onRowClick,
}: {
  rows: readonly JobView[];
  session: Session;
  onRowClick: (id: string) => void;
}) {
  const [range, setRange] = useState<'day' | 'week'>('week');

  const windowKeys = useMemo(() => dateKeyWindow(mockNow(), range === 'day' ? 1 : 7), [range]);

  const grouped = useMemo(() => {
    const keySet = new Set(windowKeys);
    const byDay = new Map<string, { job: JobView; startUtc: string; kind: 'scheduled' | 'requested' }[]>();
    for (const job of rows) {
      const window = effectiveWindow(job);
      if (!window) continue;
      const key = localDateKey(window.window.startUtc, timezoneFor(session.orgId, job.locationId));
      if (!keySet.has(key)) continue;
      const bucket = byDay.get(key) ?? [];
      bucket.push({ job, startUtc: window.window.startUtc, kind: window.kind });
      byDay.set(key, bucket);
    }
    for (const bucket of byDay.values()) {
      bucket.sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());
    }
    return byDay;
  }, [rows, windowKeys, session.orgId]);

  const hasAny = windowKeys.some((k) => (grouped.get(k)?.length ?? 0) > 0);

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={range} onValueChange={(v) => setRange(v === 'day' ? 'day' : 'week')}>
        <TabsList label="Calendar range">
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
        </TabsList>
      </Tabs>

      {!hasAny ? (
        <EmptyState
          title="Nothing scheduled in this window"
          description="Jobs outside the selected day or week remain available in Table view."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {windowKeys.map((key) => {
            const dayRows = grouped.get(key) ?? [];
            return (
              <section key={key} className="rounded-lg border border-border bg-card">
                <h3 className="border-b border-border px-4 py-2 text-sm font-semibold text-foreground">
                  {dayLabel(key)}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {dayRows.length === 0 ? 'No jobs' : `${dayRows.length} job${dayRows.length === 1 ? '' : 's'}`}
                  </span>
                </h3>
                {dayRows.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {dayRows.map(({ job, startUtc, kind }) => {
                      const tz = timezoneFor(session.orgId, job.locationId);
                      const identity = job.contact.identity;
                      const name = identity ? `${identity.firstName} ${identity.lastName}` : '—';
                      return (
                        <li key={job.id}>
                          <button
                            type="button"
                            onClick={() => onRowClick(job.id)}
                            className="flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/30"
                          >
                            <span className="w-24 shrink-0 tabular-nums font-medium text-foreground">
                              {formatTime(startUtc, tz)}
                              <span className="block text-[11px] font-normal text-muted-foreground">
                                {kind === 'scheduled' ? 'Arrival' : 'Requested'}
                              </span>
                            </span>
                            <span className="flex-1 min-w-[8rem] text-foreground">{name}</span>
                            <span className="min-w-[8rem] text-muted-foreground">{job.jobType}</span>
                            <PriorityChip priority={job.priority} />
                            <JobStatusChip status={job.status} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
