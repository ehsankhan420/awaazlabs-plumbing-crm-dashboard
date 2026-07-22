'use client';

/**
 * line-chart.tsx — multi-series lines with a crosshair tooltip.
 *
 * Consumers: §4.5 first-audio response with 800 ms target, §9.1 latency with 800 ms target,
 * §12.2 quality trend with optimization events plotted as markers on the line, §7.2
 * verifications-over-time, §13.2 rating trend.
 *
 * `targetLine` renders as a dashed `4 4` line in `--muted-foreground` (THEME_NOTES §7).
 * `markers` render as a ring (`--foreground` stroke on `--card` fill) — §12.2 optimization
 * events; they surface their label through the crosshair when it lands on them. Marks:
 * 2px stroke, ≥8px emphasized point, one y-axis. No color literal in this file.
 */

import React, { useRef } from 'react';
import { buildLinePath, linearScale, niceTicks, type Point } from './scales';
import {
  ChartFrame,
  SvgTooltip,
  YAxis,
  useChartTooltip,
  type ChartTableData,
} from './chart-frame';

export interface LineSeries {
  readonly key: string;
  readonly label: string;
  /** `var(--…)` token. No literal color. */
  readonly color: string;
  /** One value per `xLabels` entry; `null` is a gap. */
  readonly values: readonly (number | null)[];
}

export interface LineTarget {
  readonly value: number;
  readonly label: string;
}

export interface LineMarker {
  /** Index into `xLabels`. */
  readonly x: number;
  readonly label: string;
}

export interface LineChartProps {
  readonly title: string;
  readonly description?: string;
  readonly footnote?: string;
  readonly tableData: ChartTableData;
  readonly xLabels: readonly string[];
  readonly series: readonly LineSeries[];
  readonly targetLine?: LineTarget;
  readonly markers?: readonly LineMarker[];
  readonly formatValue?: (value: number) => string;
}

const VBW = 760;
const VBH = 380;
const M = { top: 20, right: 24, bottom: 40, left: 52 } as const;

const PLOT_LEFT = M.left;
const PLOT_RIGHT = VBW - M.right;
const PLOT_TOP = M.top;
const PLOT_BOTTOM = VBH - M.bottom;

export function LineChart({
  title,
  description,
  footnote,
  tableData,
  xLabels,
  series,
  targetLine,
  markers,
  formatValue = (v) => String(v),
}: LineChartProps): React.JSX.Element {
  const { tip, show, hide } = useChartTooltip();
  const overlayRef = useRef<SVGRectElement | null>(null);

  const n = Math.max(xLabels.length, 1);
  const allValues: number[] = series.flatMap((s) =>
    s.values.filter((v): v is number => v !== null),
  );
  if (targetLine) allValues.push(targetLine.value);
  const dataMin = allValues.length ? Math.min(...allValues) : 0;
  const dataMax = allValues.length ? Math.max(...allValues) : 1;

  const ticks = niceTicks(dataMin, dataMax, 5);
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const y = linearScale([yMin, yMax], [PLOT_BOTTOM, PLOT_TOP]);
  const x = linearScale([0, n - 1], [PLOT_LEFT, PLOT_RIGHT]);

  const markerByIndex = new Map<number, string>();
  (markers ?? []).forEach((m) => markerByIndex.set(m.x, m.label));

  const labelStep = Math.max(1, Math.ceil(n / 12));

  const legend = series.map((s) => ({ label: s.label, token: s.color }));

  const handleMove = (event: React.MouseEvent<SVGRectElement>): void => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const fraction = (event.clientX - rect.left) / rect.width;
    const index = Math.max(0, Math.min(n - 1, Math.round(fraction * (n - 1))));
    const lines: string[] = [xLabels[index] ?? String(index)];
    series.forEach((s) => {
      const v = s.values[index];
      if (v !== null && v !== undefined) lines.push(`${s.label}: ${formatValue(v)}`);
    });
    const marker = markerByIndex.get(index);
    if (marker) lines.push(`● ${marker}`);
    show(x(index), PLOT_TOP + 4, lines);
  };

  const hoverIndex =
    tip !== null
      ? Math.max(0, Math.min(n - 1, Math.round(((tip.x - PLOT_LEFT) / (PLOT_RIGHT - PLOT_LEFT)) * (n - 1))))
      : null;

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
        aria-label={`${title} — line chart`}
      >
        <YAxis
          axisX={PLOT_LEFT}
          gridX0={PLOT_LEFT}
          gridX1={PLOT_RIGHT}
          ticks={ticks.map((t) => ({ y: y(t), label: formatValue(t) }))}
        />

        {/* Target / threshold line — dashed 4 4, muted (THEME_NOTES §7) */}
        {targetLine ? (
          <g aria-hidden>
            <line
              x1={PLOT_LEFT}
              x2={PLOT_RIGHT}
              y1={y(targetLine.value)}
              y2={y(targetLine.value)}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PLOT_RIGHT}
              y={y(targetLine.value) - 6}
              textAnchor="end"
              fontSize={11}
              fill="hsl(var(--muted-foreground))"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {targetLine.label}
            </text>
          </g>
        ) : null}

        {/* Crosshair */}
        {hoverIndex !== null ? (
          <line
            x1={x(hoverIndex)}
            x2={x(hoverIndex)}
            y1={PLOT_TOP}
            y2={PLOT_BOTTOM}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ) : null}

        {/* Lines */}
        {series.map((s) => {
          const points: Point[] = [];
          s.values.forEach((v, i) => {
            if (v !== null && v !== undefined) points.push({ x: x(i), y: y(v) });
          });
          return (
            <path
              key={s.key}
              d={buildLinePath(points)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* Emphasized points at the crosshair index (≥8px) */}
        {hoverIndex !== null
          ? series.map((s) => {
              const v = s.values[hoverIndex];
              if (v === null || v === undefined) return null;
              return (
                <circle
                  key={s.key}
                  cx={x(hoverIndex)}
                  cy={y(v)}
                  r={4.5}
                  fill={s.color}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              );
            })
          : null}

        {/* Optimization-event markers — ring on card fill (THEME_NOTES §7 / §12.2) */}
        {(markers ?? []).map((m) => {
          const primary = series[0]?.values[m.x];
          const cy = primary !== null && primary !== undefined ? y(primary) : PLOT_TOP + 8;
          return (
            <circle
              key={`${m.x}-${m.label}`}
              cx={x(m.x)}
              cy={cy}
              r={6}
              fill="hsl(var(--card))"
              stroke="hsl(var(--foreground))"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            >
              <title>{m.label}</title>
            </circle>
          );
        })}

        {/* x-axis labels */}
        {xLabels.map((xl, i) =>
          i % labelStep === 0 ? (
            <text
              key={xl + i}
              x={x(i)}
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

        {/* Transparent capture surface for the crosshair */}
        <rect
          ref={overlayRef}
          x={PLOT_LEFT}
          y={PLOT_TOP}
          width={PLOT_RIGHT - PLOT_LEFT}
          height={PLOT_BOTTOM - PLOT_TOP}
          fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={hide}
        />

        {tip ? <SvgTooltip tip={tip} chartWidth={VBW} chartHeight={VBH} /> : null}
      </svg>
    </ChartFrame>
  );
}
