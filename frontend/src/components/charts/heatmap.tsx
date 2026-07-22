'use client';

/**
 * heatmap.tsx — hour-of-day × day-of-week magnitude grid.
 *
 * Consumers: §6.2 bookings-by-hour (split business vs after-hours via `columnGroups`), §14.1
 * best-contact-window.
 *
 * Magnitude uses the sequential ramp `--seq-1`..`--seq-5` (THEME_NOTES §4), bucketed linearly.
 * Every cell carries its numeric value as a direct label, so magnitude NEVER rests on color
 * alone. 2px `--card` gaps separate cells. No color literal in this file.
 */

import React from 'react';
import {
  ChartFrame,
  SvgTooltip,
  useChartTooltip,
  type ChartTableData,
} from './chart-frame';

export interface HeatmapColumnGroup {
  readonly label: string;
  /** Inclusive column-index bounds. */
  readonly startCol: number;
  readonly endCol: number;
}

export interface HeatmapProps {
  readonly title: string;
  readonly description?: string;
  readonly footnote?: string;
  readonly tableData: ChartTableData;
  readonly xLabels: readonly string[];
  readonly yLabels: readonly string[];
  /** `values[row][col]`; `null` = no data. */
  readonly values: ReadonlyArray<ReadonlyArray<number | null>>;
  readonly columnGroups?: readonly HeatmapColumnGroup[];
  readonly formatValue?: (value: number) => string;
}

const SEQ_TOKENS = [
  'var(--seq-1)',
  'var(--seq-2)',
  'var(--seq-3)',
  'var(--seq-4)',
  'var(--seq-5)',
] as const;

const VBW = 760;
const LEFT_W = 56;
const CELL_H = 30;
const GRID_RIGHT = VBW - 8;

export function Heatmap({
  title,
  description,
  footnote,
  tableData,
  xLabels,
  yLabels,
  values,
  columnGroups,
  formatValue = (v) => String(v),
}: HeatmapProps): React.JSX.Element {
  const { tip, show, hide } = useChartTooltip();

  const flat = values.flat().filter((v): v is number => v !== null);
  const min = flat.length ? Math.min(...flat) : 0;
  const max = flat.length ? Math.max(...flat) : 0;
  const range = max - min;

  const bucketOf = (v: number): number => {
    if (range <= 0) return 0;
    return Math.max(0, Math.min(4, Math.floor(((v - min) / range) * 5)));
  };

  const cols = xLabels.length;
  const cellW = (GRID_RIGHT - LEFT_W) / Math.max(cols, 1);
  const groupBandH = columnGroups && columnGroups.length ? 22 : 0;
  const topH = 22 + groupBandH;
  const VBH = topH + yLabels.length * CELL_H + 6;

  // Sequential legend: five buckets with numeric ranges.
  const legend = SEQ_TOKENS.map((token, k) => {
    const lo = min + (range * k) / 5;
    const hi = k === 4 ? max : min + (range * (k + 1)) / 5;
    return {
      label: range > 0 ? `${formatValue(Math.round(lo))}–${formatValue(Math.round(hi))}` : formatValue(min),
      token,
    };
  });

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
        aria-label={`${title} — heatmap`}
      >
        {/* Column-group brackets (e.g. Business / After hours) */}
        {(columnGroups ?? []).map((g) => {
          const gx0 = LEFT_W + g.startCol * cellW;
          const gx1 = LEFT_W + (g.endCol + 1) * cellW;
          return (
            <g key={g.label} aria-hidden>
              <line
                x1={gx0 + 2}
                x2={gx1 - 2}
                y1={12}
                y2={12}
                stroke="hsl(var(--border))"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={(gx0 + gx1) / 2}
                y={8}
                textAnchor="middle"
                fontSize={11}
                fill="hsl(var(--muted-foreground))"
              >
                {g.label}
              </text>
            </g>
          );
        })}

        {/* Column headers */}
        {xLabels.map((xl, c) => (
          <text
            key={xl + c}
            x={LEFT_W + c * cellW + cellW / 2}
            y={topH - 6}
            textAnchor="middle"
            fontSize={10}
            fill="hsl(var(--muted-foreground))"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {xl}
          </text>
        ))}

        {/* Rows */}
        {yLabels.map((yl, r) => {
          const rowY = topH + r * CELL_H;
          return (
            <g key={yl + r}>
              <text
                x={LEFT_W - 8}
                y={rowY + CELL_H / 2 + 4}
                textAnchor="end"
                fontSize={12}
                fill="hsl(var(--muted-foreground))"
              >
                {yl}
              </text>
              {xLabels.map((xl, c) => {
                const value = values[r]?.[c] ?? null;
                const cellX = LEFT_W + c * cellW;
                if (value === null) {
                  return (
                    <rect
                      key={c}
                      x={cellX}
                      y={rowY}
                      width={cellW}
                      height={CELL_H}
                      rx={2}
                      fill="hsl(var(--muted))"
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                }
                const bucket = bucketOf(value);
                const darkText = bucket >= 3;
                return (
                  <g key={c}>
                    <rect
                      x={cellX}
                      y={rowY}
                      width={cellW}
                      height={CELL_H}
                      rx={2}
                      fill={SEQ_TOKENS[bucket]}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                      onMouseEnter={() =>
                        show(cellX + cellW / 2, rowY, [`${yl} · ${xl}`, formatValue(value)])
                      }
                      onMouseLeave={hide}
                    >
                      <title>{`${yl} ${xl}: ${formatValue(value)}`}</title>
                    </rect>
                    <text
                      x={cellX + cellW / 2}
                      y={rowY + CELL_H / 2 + 3.5}
                      textAnchor="middle"
                      fontSize={10}
                      fill={darkText ? 'hsl(var(--card))' : 'hsl(var(--foreground))'}
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                      pointerEvents="none"
                    >
                      {formatValue(value)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {tip ? <SvgTooltip tip={tip} chartWidth={VBW} chartHeight={VBH} /> : null}
      </svg>
    </ChartFrame>
  );
}
