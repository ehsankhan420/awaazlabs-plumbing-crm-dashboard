'use client';

/**
 * histogram.tsx — §12.2 grade distribution: share of calls per grade band.
 *
 * SINGLE HUE `var(--chart-1)` for every bin — a histogram of one quantity, not a categorical
 * comparison, so color carries no extra meaning. Vertical bars with 4px rounded tops anchored
 * to the baseline, one y-axis, recessive horizontal grid, and a selective count label above
 * each bar. No color literal here.
 */

import React from 'react';
import { bandScale, linearScale, niceTicks, roundedRectPath } from './scales';
import {
  ChartFrame,
  SvgTooltip,
  YAxis,
  useChartTooltip,
  type ChartTableData,
} from './chart-frame';

export interface HistogramBin {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

export interface HistogramProps {
  readonly title: string;
  readonly description?: string;
  readonly footnote?: string;
  readonly tableData: ChartTableData;
  readonly bins: readonly HistogramBin[];
  readonly formatCount?: (value: number) => string;
}

const VBW = 760;
const VBH = 360;
const M = { top: 24, right: 16, bottom: 40, left: 52 } as const;
const PLOT_LEFT = M.left;
const PLOT_RIGHT = VBW - M.right;
const PLOT_TOP = M.top;
const PLOT_BOTTOM = VBH - M.bottom;
const CORNER = 4;
const HIST_HUE = 'var(--chart-1)';

export function Histogram({
  title,
  description,
  footnote,
  tableData,
  bins,
  formatCount = (v) => String(v),
}: HistogramProps): React.JSX.Element {
  const { tip, show, hide } = useChartTooltip();

  const maxCount = Math.max(0, ...bins.map((b) => b.count));
  const ticks = niceTicks(0, maxCount || 1, 5);
  const yMax = ticks[ticks.length - 1];
  const y = linearScale([0, yMax], [PLOT_BOTTOM, PLOT_TOP]);
  const band = bandScale(
    bins.map((b) => b.key),
    [PLOT_LEFT, PLOT_RIGHT],
    0.3,
  );

  const legend = [{ label: 'Calls', token: HIST_HUE }];

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
        aria-label={`${title} — histogram`}
      >
        <YAxis
          axisX={PLOT_LEFT}
          gridX0={PLOT_LEFT}
          gridX1={PLOT_RIGHT}
          ticks={ticks.map((t) => ({ y: y(t), label: formatCount(t) }))}
        />
        <line
          x1={PLOT_LEFT}
          x2={PLOT_RIGHT}
          y1={PLOT_BOTTOM}
          y2={PLOT_BOTTOM}
          stroke="hsl(var(--border))"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />

        {bins.map((b) => {
          const left = band.position(b.key);
          const center = band.center(b.key);
          const yTop = y(b.count);
          const height = PLOT_BOTTOM - yTop;
          return (
            <g key={b.key}>
              {b.count > 0 ? (
                <path
                  d={roundedRectPath(left, yTop, band.bandwidth, height, { tl: CORNER, tr: CORNER })}
                  fill={HIST_HUE}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={() => show(center, yTop, [b.label, formatCount(b.count)])}
                  onMouseLeave={hide}
                >
                  <title>{`${b.label}: ${formatCount(b.count)}`}</title>
                </path>
              ) : null}
              {b.count > 0 ? (
                <text
                  x={center}
                  y={yTop - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fill="hsl(var(--foreground))"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatCount(b.count)}
                </text>
              ) : null}
              <text
                x={center}
                y={PLOT_BOTTOM + 20}
                textAnchor="middle"
                fontSize={12}
                fill="hsl(var(--muted-foreground))"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {b.label}
              </text>
            </g>
          );
        })}

        {tip ? <SvgTooltip tip={tip} chartWidth={VBW} chartHeight={VBH} /> : null}
      </svg>
    </ChartFrame>
  );
}
