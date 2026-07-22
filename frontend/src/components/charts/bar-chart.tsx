'use client';

/**
 * bar-chart.tsx — vertical bars, `stacked` or `grouped`.
 *
 * Consumers: §4.1 bookings-over-time (stacked by source, 7D/30D), §9.2 four-series grouped,
 * §13.2 attributed-vs-organic (stacked), §4.5 calls-over-time and minutes-over-time (two
 * SEPARATE charts — never a dual axis; THEME_NOTES §8).
 *
 * Marks (THEME_NOTES §8): 4px rounded data-ends anchored square to the baseline, 2px
 * surface-colored (`--card`) gap between stacked segments and between adjacent bars, one
 * y-axis, recessive horizontal grid behind the marks. Colors arrive as `var(--…)` tokens
 * from the caller (via series-map) — this file contains no color literal.
 */

import React from 'react';
import { niceTicks, bandScale, linearScale, roundedRectPath } from './scales';
import {
  ChartFrame,
  SvgTooltip,
  YAxis,
  useChartTooltip,
  type ChartTableData,
} from './chart-frame';

export interface BarSeries {
  readonly key: string;
  readonly label: string;
  /** `var(--…)` token. No literal color. */
  readonly color: string;
  /** One value per `xLabels` entry. */
  readonly values: readonly number[];
}

export interface BarChartProps {
  readonly title: string;
  readonly description?: string;
  readonly footnote?: string;
  readonly tableData: ChartTableData;
  readonly variant: 'stacked' | 'grouped';
  readonly xLabels: readonly string[];
  readonly series: readonly BarSeries[];
  readonly formatValue?: (value: number) => string;
  /** Draw the column total above each stacked column (selective direct label). */
  readonly showStackTotals?: boolean;
}

const VBW = 760;
const VBH = 380;
const M = { top: 20, right: 16, bottom: 40, left: 52 } as const;
const CORNER = 4;

const PLOT_LEFT = M.left;
const PLOT_RIGHT = VBW - M.right;
const PLOT_TOP = M.top;
const PLOT_BOTTOM = VBH - M.bottom;

export function BarChart({
  title,
  description,
  footnote,
  tableData,
  variant,
  xLabels,
  series,
  formatValue = (v) => String(v),
  showStackTotals = false,
}: BarChartProps): React.JSX.Element {
  const { tip, show, hide } = useChartTooltip();

  const columnTotals = xLabels.map((_, ci) =>
    series.reduce((sum, s) => sum + (s.values[ci] ?? 0), 0),
  );
  const maxValue =
    variant === 'stacked'
      ? Math.max(0, ...columnTotals)
      : Math.max(0, ...series.flatMap((s) => s.values.map((v) => v)));

  const ticks = niceTicks(0, maxValue || 1, 5);
  const yMax = ticks[ticks.length - 1];
  const y = linearScale([0, yMax], [PLOT_BOTTOM, PLOT_TOP]);
  const band = bandScale(xLabels, [PLOT_LEFT, PLOT_RIGHT], 0.28);

  const labelStep = Math.max(1, Math.ceil(xLabels.length / 12));

  const legend = series.map((s) => ({ label: s.label, token: s.color }));

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
        aria-label={`${title} — ${variant} bar chart`}
      >
        <YAxis
          axisX={PLOT_LEFT}
          gridX0={PLOT_LEFT}
          gridX1={PLOT_RIGHT}
          ticks={ticks.map((t) => ({ y: y(t), label: formatValue(t) }))}
        />

        {/* Baseline */}
        <line
          x1={PLOT_LEFT}
          x2={PLOT_RIGHT}
          y1={PLOT_BOTTOM}
          y2={PLOT_BOTTOM}
          stroke="hsl(var(--border))"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />

        {xLabels.map((xl, ci) => {
          const bandLeft = band.position(xl);
          const center = band.center(xl);

          if (variant === 'stacked') {
            let cumulative = 0;
            return (
              <g key={xl}>
                {series.map((s, si) => {
                  const v = s.values[ci] ?? 0;
                  if (v <= 0) {
                    cumulative += v;
                    return null;
                  }
                  const yTop = y(cumulative + v);
                  const yBottom = y(cumulative);
                  cumulative += v;
                  const isTop = si === series.length - 1;
                  const height = yBottom - yTop;
                  const d = roundedRectPath(
                    bandLeft,
                    yTop,
                    band.bandwidth,
                    height,
                    isTop ? { tl: CORNER, tr: CORNER } : {},
                  );
                  return (
                    <path
                      key={s.key}
                      d={d}
                      fill={s.color}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                      onMouseEnter={() =>
                        show(center, yTop, [xl, `${s.label}: ${formatValue(v)}`])
                      }
                      onMouseLeave={hide}
                    >
                      <title>{`${xl} — ${s.label}: ${formatValue(v)}`}</title>
                    </path>
                  );
                })}
                {showStackTotals && columnTotals[ci] > 0 ? (
                  <text
                    x={center}
                    y={y(columnTotals[ci]) - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fill="hsl(var(--foreground))"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatValue(columnTotals[ci])}
                  </text>
                ) : null}
              </g>
            );
          }

          // grouped
          const inner = bandScale(
            series.map((s) => s.key),
            [bandLeft, bandLeft + band.bandwidth],
            0.15,
          );
          return (
            <g key={xl}>
              {series.map((s) => {
                const v = s.values[ci] ?? 0;
                const barLeft = inner.position(s.key);
                const barCenter = inner.center(s.key);
                if (v <= 0) return null;
                const yTop = y(v);
                const height = PLOT_BOTTOM - yTop;
                const d = roundedRectPath(barLeft, yTop, inner.bandwidth, height, {
                  tl: CORNER,
                  tr: CORNER,
                });
                return (
                  <path
                    key={s.key}
                    d={d}
                    fill={s.color}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    onMouseEnter={() =>
                      show(barCenter, yTop, [xl, `${s.label}: ${formatValue(v)}`])
                    }
                    onMouseLeave={hide}
                  >
                    <title>{`${xl} — ${s.label}: ${formatValue(v)}`}</title>
                  </path>
                );
              })}
            </g>
          );
        })}

        {/* x-axis labels (thinned when crowded) */}
        {xLabels.map((xl, ci) =>
          ci % labelStep === 0 ? (
            <text
              key={xl}
              x={band.center(xl)}
              y={PLOT_BOTTOM + 20}
              textAnchor="middle"
              fontSize={12}
              fill="hsl(var(--muted-foreground))"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {xl}
            </text>
          ) : null,
        )}

        {tip ? <SvgTooltip tip={tip} chartWidth={VBW} chartHeight={VBH} /> : null}
      </svg>
    </ChartFrame>
  );
}
