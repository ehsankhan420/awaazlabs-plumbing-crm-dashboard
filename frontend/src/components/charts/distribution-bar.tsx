'use client';

/**
 * distribution-bar.tsx — horizontal 100% stacked bar that sums to exactly 100%.
 *
 * Consumers: §4.2 compact Dispatch status distribution, §7.2 Dispatch status distribution bars.
 *
 * Segment widths use exact fractions; the direct labels use integer percentages reconciled
 * by largest-remainder so they sum to precisely 100 (never "99%" or "101%"). Percentages are
 * placed BELOW the bar so label text always wears a text token, never the segment color
 * (THEME_NOTES §7). 2px `--card` gaps between segments; rounded outer ends. No color literal.
 */

import React from 'react';
import { roundedRectPath } from './scales';
import {
  ChartFrame,
  SvgTooltip,
  useChartTooltip,
  type ChartTableData,
} from './chart-frame';

export interface DistributionSegment {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** `var(--…)` token. No literal color. */
  readonly color: string;
}

export interface DistributionBarProps {
  readonly title: string;
  readonly description?: string;
  readonly footnote?: string;
  readonly tableData: ChartTableData;
  readonly segments: readonly DistributionSegment[];
  readonly compact?: boolean;
  readonly formatValue?: (value: number) => string;
}

const VBW = 760;
const M_X = 8;
const BAR_LEFT = M_X;
const BAR_RIGHT = VBW - M_X;
const BAR_WIDTH = BAR_RIGHT - BAR_LEFT;
const CORNER = 6;

/** Integer percentages that sum to exactly 100 (largest-remainder apportionment). */
function roundedPercents(values: readonly number[], total: number): number[] {
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (Math.max(0, v) / total) * 100);
  const floored = raw.map((r) => Math.floor(r));
  let remainder = 100 - floored.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && remainder > 0; k += 1) {
    floored[order[k].i] += 1;
    remainder -= 1;
  }
  return floored;
}

export function DistributionBar({
  title,
  description,
  footnote,
  tableData,
  segments,
  compact = false,
  formatValue = (v) => String(v),
}: DistributionBarProps): React.JSX.Element {
  const { tip, show, hide } = useChartTooltip();

  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const percents = roundedPercents(
    segments.map((s) => s.value),
    total,
  );

  const barY = 12;
  const barH = compact ? 26 : 40;
  const labelY = barY + barH + 20;
  const VBH = labelY + 8;

  const legend = segments.map((s, i) => ({
    label: s.label,
    token: s.color,
    value: `${percents[i]}%`,
  }));

  let cursor = BAR_LEFT;

  return (
    <ChartFrame
      title={title}
      description={description}
      footnote={footnote}
      series={legend}
      tableData={tableData}
    >
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-auto w-full"
        role="img"
        aria-label={`${title} — 100% distribution bar`}
      >
        {total > 0 ? (
          segments.map((s, i) => {
            const value = Math.max(0, s.value);
            const width = (value / total) * BAR_WIDTH;
            if (width <= 0) return null;
            const left = cursor;
            cursor += width;
            const isFirst = i === 0;
            const isLast = i === segments.length - 1;
            const center = left + width / 2;
            const d = roundedRectPath(left, barY, width, barH, {
              tl: isFirst ? CORNER : 0,
              bl: isFirst ? CORNER : 0,
              tr: isLast ? CORNER : 0,
              br: isLast ? CORNER : 0,
            });
            return (
              <g key={s.key}>
                <path
                  d={d}
                  fill={s.color}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={() =>
                    show(center, barY, [s.label, `${formatValue(value)} · ${percents[i]}%`])
                  }
                  onMouseLeave={hide}
                >
                  <title>{`${s.label}: ${formatValue(value)} (${percents[i]}%)`}</title>
                </path>
                {width > 34 ? (
                  <text
                    x={center}
                    y={labelY}
                    textAnchor="middle"
                    fontSize={12}
                    fill="hsl(var(--foreground))"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {percents[i]}%
                  </text>
                ) : null}
              </g>
            );
          })
        ) : (
          <rect x={BAR_LEFT} y={barY} width={BAR_WIDTH} height={barH} rx={CORNER} fill="hsl(var(--muted))" />
        )}

        {tip ? <SvgTooltip tip={tip} chartWidth={VBW} chartHeight={VBH} /> : null}
      </svg>
    </ChartFrame>
  );
}
