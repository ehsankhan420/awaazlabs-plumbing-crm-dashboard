'use client';

/**
 * chart-frame.tsx — the mandatory wrapper for EVERY chart, plus the shared SVG chrome
 * (y-axis, hover tooltip) the primitives compose.
 *
 * THEME_NOTES.md §3 (the relief rule): `--chart-2` and `--chart-3` fall below 3:1 against
 * the white surface, so identity may NEVER rest on color alone. ChartFrame discharges that
 * obligation structurally — it cannot render without `series[]` (swatch + label + value) and
 * `tableData`, and it always emits a screen-reader table plus a "View as table" toggle.
 *
 * Colors here are token-only: Tailwind utilities that map to `hsl(var(--…))`, or inline
 * `style={{ backgroundColor }}` fed a `var(--…)` reference for legend swatches (the one way
 * to paint a swatch with a CSS variable). No literal color appears.
 */

import React, { useCallback, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ========================================================================================
 * ChartFrame
 * ====================================================================================== */

export interface ChartSeriesLegend {
  /** Human label — the identity channel that does NOT depend on color. */
  readonly label: string;
  /** A `var(--…)` / `hsl(var(--…))` reference for the swatch. Never a literal color. */
  readonly token: string;
  /** Optional value carried in the legend, per the relief rule. */
  readonly value?: string;
}

export interface ChartTableData {
  readonly columns: readonly string[];
  readonly rows: ReadonlyArray<readonly string[]>;
}

export interface ChartFrameProps {
  readonly title: string;
  readonly description?: string;
  /** Required, non-empty. Legend identity is swatch + text — never color alone. */
  readonly series: ReadonlyArray<ChartSeriesLegend>;
  /** Required. The relief channel: exposed to screen readers and the table toggle. */
  readonly tableData: ChartTableData;
  readonly children: React.ReactNode;
  readonly footnote?: string;
}

export function ChartFrame({
  title,
  description,
  series,
  tableData,
  children,
  footnote,
}: ChartFrameProps): React.JSX.Element {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const titleId = useId();

  return (
    <figure
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm"
      aria-labelledby={titleId}
    >
      <figcaption className="flex flex-col gap-1">
        <h3 id={titleId} className="text-base font-semibold leading-none tracking-tight text-foreground">
          {title}
        </h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </figcaption>

      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Legend">
        {series.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="inline-block h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: item.token }}
            />
            <span className="text-foreground">{item.label}</span>
            {item.value !== undefined ? (
              <span className="font-medium tabular-nums text-muted-foreground">{item.value}</span>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="relative w-full">{children}</div>

      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          className="text-xs"
          onClick={() => setShowTable((v) => !v)}
        >
          {showTable ? 'Hide table' : 'View as table'}
        </Button>
      </div>

      {/*
        Always present for screen readers (sr-only keeps it in the a11y tree); the toggle
        promotes it to a visible, styled table. This is the relief channel for the sub-3:1
        series colors, per THEME_NOTES §3.
      */}
      <table
        id={tableId}
        className={cn(
          showTable
            ? 'w-full border-collapse text-left text-sm'
            : 'sr-only',
        )}
      >
        <caption className="sr-only">{title} — data table</caption>
        <thead>
          <tr className={showTable ? 'border-b border-border' : undefined}>
            {tableData.columns.map((col, i) => (
              <th
                key={col}
                scope="col"
                className={cn(
                  'px-3 py-2 font-medium text-muted-foreground',
                  showTable && i > 0 && 'text-right tabular-nums',
                )}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.rows.map((row, ri) => (
            <tr key={ri} className={showTable ? 'border-b border-border last:border-0' : undefined}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    'px-3 py-2 text-foreground',
                    showTable && ci > 0 && 'text-right tabular-nums',
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {footnote ? <figcaption className="text-xs text-muted-foreground">{footnote}</figcaption> : null}
    </figure>
  );
}

/* ========================================================================================
 * Shared SVG chrome
 * ====================================================================================== */

/**
 * Hover tooltip state, shared by every interactive primitive so the crosshair/tooltip logic
 * lives in one place. Coordinates are in the chart's own viewBox units.
 */
export interface TooltipState {
  readonly x: number;
  readonly y: number;
  readonly lines: readonly string[];
}

export interface ChartTooltip {
  readonly tip: TooltipState | null;
  show(x: number, y: number, lines: readonly string[]): void;
  hide(): void;
}

export function useChartTooltip(): ChartTooltip {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const show = useCallback((x: number, y: number, lines: readonly string[]): void => {
    setTip({ x, y, lines });
  }, []);
  const hide = useCallback((): void => setTip(null), []);
  return { tip, show, hide };
}

export interface SvgTooltipProps {
  readonly tip: TooltipState;
  /** viewBox extent, used to keep the box on-canvas. */
  readonly chartWidth: number;
  readonly chartHeight: number;
  readonly fontSize?: number;
}

/**
 * A dark, self-contained tooltip drawn in SVG user space so it scales with the chart and
 * needs no pixel conversion. Flips above/below and clamps horizontally to stay in view.
 */
export function SvgTooltip({
  tip,
  chartWidth,
  chartHeight,
  fontSize = 12,
}: SvgTooltipProps): React.JSX.Element {
  const padding = 8;
  const lineHeight = fontSize + 4;
  const longest = tip.lines.reduce((m, l) => Math.max(m, l.length), 0);
  const boxWidth = Math.max(longest * fontSize * 0.6 + padding * 2, 48);
  const boxHeight = tip.lines.length * lineHeight + padding * 2 - 4;

  let boxX = tip.x - boxWidth / 2;
  boxX = Math.max(4, Math.min(boxX, chartWidth - boxWidth - 4));

  let boxY = tip.y - boxHeight - 12;
  if (boxY < 4) boxY = Math.min(tip.y + 14, chartHeight - boxHeight - 4);

  return (
    <g pointerEvents="none" aria-hidden>
      <rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
        rx={6}
        fill="hsl(var(--foreground))"
      />
      {tip.lines.map((line, i) => (
        <text
          key={i}
          x={boxX + padding}
          y={boxY + padding + fontSize - 2 + i * lineHeight}
          fontSize={fontSize}
          fill="hsl(var(--background))"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

export interface YAxisTick {
  readonly y: number;
  readonly label: string;
}

export interface YAxisProps {
  /** x of the tick labels' right edge (axis position). */
  readonly axisX: number;
  /** Horizontal span of the recessive gridlines. */
  readonly gridX0: number;
  readonly gridX1: number;
  readonly ticks: readonly YAxisTick[];
  readonly fontSize?: number;
}

/**
 * Recessive horizontal grid + right-aligned tick labels. Gridlines are hairline
 * `--border`, drawn behind the marks, horizontal only (THEME_NOTES §8). `non-scaling-stroke`
 * keeps them a true hairline at any render size.
 */
export function YAxis({ axisX, gridX0, gridX1, ticks, fontSize = 12 }: YAxisProps): React.JSX.Element {
  return (
    <g aria-hidden>
      {ticks.map((t) => (
        <g key={t.label + t.y}>
          <line
            x1={gridX0}
            x2={gridX1}
            y1={t.y}
            y2={t.y}
            stroke="hsl(var(--border))"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={axisX - 8}
            y={t.y + fontSize / 3}
            textAnchor="end"
            fontSize={fontSize}
            fill="hsl(var(--muted-foreground))"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {t.label}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Shared axis-label style — muted ink, tabular figures (THEME_NOTES §8). */
export const AXIS_LABEL_STYLE: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };
