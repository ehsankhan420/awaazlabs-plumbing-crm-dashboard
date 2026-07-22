'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from './card';
import { Tooltip } from './tooltip';

export type StatFormat = 'number' | 'percent' | 'currency' | 'text';

export interface StatDelta {
  value: number;
  direction: 'up' | 'down';
  /** e.g. "vs same weekday last week" (§4.1). */
  caption: string;
}

export interface SubStat {
  label: string;
  value: string;
}

export interface StatCardProps {
  label: string;
  value: string | number;
  format?: StatFormat;
  /** §4.1 delta. An up-arrow is not automatically good — pass `deltaIsGood` to color it. */
  delta?: StatDelta;
  /** When unset, the delta renders neutral (`text-muted-foreground`). */
  deltaIsGood?: boolean;
  /** §4.3 / §6.1 info tooltip: formula and inputs, or model explanation. */
  tooltip?: string;
  /** §4.2 needs-attention red accent. */
  accent?: 'default' | 'destructive';
  /** §4 "Every card is a click-through." Makes the whole card a link. */
  href?: string;
  /** Accessible name for the click-through; defaults to `label`. */
  linkLabel?: string;
  /** §4.4 sparkline slot. Pass a node — never import from src/components/charts here. */
  chart?: React.ReactNode;
  /** §4.2 breakdown, e.g. Dispatch in-progress sub-statuses. */
  subStats?: SubStat[];
  className?: string;
}

function formatValue(value: string | number, format?: StatFormat): string {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'percent':
      return `${value.toLocaleString()}%`;
    case 'currency':
      return `$${value.toLocaleString()}`;
    case 'number':
      return value.toLocaleString();
    case 'text':
    default:
      return String(value);
  }
}

export function StatCard({
  label,
  value,
  format,
  delta,
  deltaIsGood,
  tooltip,
  accent = 'default',
  href,
  linkLabel,
  chart,
  subStats,
  className,
}: StatCardProps) {
  const isDestructive = accent === 'destructive';

  // No "good/green" status token exists in the theme (THEME_NOTES): only a bad movement is
  // called out, in red. A good movement stays neutral foreground; unspecified stays muted.
  const deltaClass =
    deltaIsGood === undefined
      ? 'text-muted-foreground'
      : deltaIsGood
        ? 'text-foreground'
        : 'text-destructive';

  const DeltaArrow = delta?.direction === 'down' ? ArrowDown : ArrowUp;

  return (
    <Card className={cn('relative', isDestructive && 'border-destructive/40', className)}>
      {href ? (
        <Link
          href={href}
          aria-label={linkLabel ?? label}
          className="absolute inset-0 rounded-lg hover:bg-muted/20"
        />
      ) : null}

      <div className="flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          {tooltip ? (
            <span className="relative z-10">
              <Tooltip label={`More information about ${label}`} content={tooltip}>
                <Info className="h-4 w-4" aria-hidden="true" />
              </Tooltip>
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            'text-3xl font-semibold tabular-nums',
            isDestructive ? 'text-destructive' : 'text-foreground',
          )}
        >
          {formatValue(value, format)}
        </div>

        {delta ? (
          <div className={cn('flex items-center gap-1 text-sm', deltaClass)}>
            <DeltaArrow className="h-4 w-4" aria-hidden="true" />
            <span className="font-medium tabular-nums">{Math.abs(delta.value).toLocaleString()}</span>
            <span className="text-muted-foreground">{delta.caption}</span>
          </div>
        ) : null}

        {subStats && subStats.length > 0 ? (
          <dl className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
            {subStats.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{s.label}</dt>
                <dd className="font-medium tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {chart ? <div className="relative z-10 pt-1">{chart}</div> : null}
      </div>
    </Card>
  );
}
