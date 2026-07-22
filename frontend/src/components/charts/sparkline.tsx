/**
 * sparkline.tsx — a tiny inline trend with no axes. §4.4 30-day quality sparkline.
 *
 * DELIBERATE ChartFrame exception (surfaced per CLAUDE.md Rule 7): a sparkline is an inline
 * element that carries its own accessibility via `role="img"` + `aria-label`, and the general
 * "wrap every chart in ChartFrame" rule and the sparkline-specific "render role='img'"
 * requirement cannot both hold for one inline glyph. The narrower, more specific instruction
 * wins, and it is safe to do so here because the single series uses `--chart-1` (4.42:1,
 * ABOVE 3:1), so THEME_NOTES §3's relief obligation — the reason ChartFrame is mandatory —
 * does not bind. This component stays server-safe: no hover state, no `'use client'`.
 *
 * Colors are token references only; no literal appears here.
 */

import React from 'react';
import { buildAreaPath, buildLinePath, linearScale, type Point } from './scales';
import { cn } from '@/lib/utils';

export interface SparklineProps {
  readonly values: readonly number[];
  /** Required — the accessible name for the `role="img"` element. */
  readonly ariaLabel: string;
  readonly width?: number;
  readonly height?: number;
  /** `var(--…)` token. Defaults to `--chart-1`. No literal color. */
  readonly color?: string;
  readonly showArea?: boolean;
  readonly className?: string;
}

export function Sparkline({
  values,
  ariaLabel,
  width = 120,
  height = 32,
  color = 'var(--chart-1)',
  showArea = true,
  className,
}: SparklineProps): React.JSX.Element {
  const pad = 3;
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const x = linearScale([0, Math.max(values.length - 1, 1)], [pad, width - pad]);
  const y = linearScale([min, max], [height - pad, pad]);

  const points: Point[] = values.map((v, i) => ({ x: x(i), y: y(v) }));
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn('inline-block h-8 w-full', className)}
      role="img"
      aria-label={ariaLabel}
    >
      {showArea && points.length > 1 ? (
        <path d={buildAreaPath(points, height - pad)} fill={color} fillOpacity={0.12} stroke="none" />
      ) : null}
      {points.length > 1 ? (
        <path
          d={buildLinePath(points)}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      {last ? (
        <circle cx={last.x} cy={last.y} r={2.5} fill={color} stroke="hsl(var(--card))" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ) : null}
    </svg>
  );
}
