'use client';

/**
 * donut-chart.tsx — §6.2 priority distribution (None/Low/High/Urgent) and intake-method donut.
 *
 * The centre carries the total; each slice is direct-labeled with its percentage (labels sit
 * OUTSIDE the ring so text always wears a text token, never the slice color — THEME_NOTES §7).
 * 2px `--card` gap between slices. Uses `arcPath`. No color literal here — slice colors arrive
 * as `var(--…)` tokens.
 */

import React from 'react';
import { arcPath } from './scales';
import {
  ChartFrame,
  SvgTooltip,
  useChartTooltip,
  type ChartTableData,
} from './chart-frame';

export interface DonutSlice {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** `var(--…)` token. No literal color. */
  readonly color: string;
}

export interface DonutChartProps {
  readonly title: string;
  readonly description?: string;
  readonly footnote?: string;
  readonly tableData: ChartTableData;
  readonly slices: readonly DonutSlice[];
  /** Small caption under the centre total (e.g. "calls"). */
  readonly centerLabel?: string;
  readonly formatValue?: (value: number) => string;
}

const VBW = 360;
const VBH = 320;
const CX = 180;
const CY = 152;
const R = 104;
const R0 = 62;
const LABEL_R = R + 20;
const TAU = Math.PI * 2;

export function DonutChart({
  title,
  description,
  footnote,
  tableData,
  slices,
  centerLabel,
  formatValue = (v) => String(v),
}: DonutChartProps): React.JSX.Element {
  const { tip, show, hide } = useChartTooltip();

  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  const legend = slices.map((s) => ({
    label: s.label,
    token: s.color,
    value: total > 0 ? `${Math.round((s.value / total) * 100)}%` : '0%',
  }));

  let cursor = 0;

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
        className="mx-auto h-auto w-full max-w-sm"
        role="img"
        aria-label={`${title} — donut chart`}
      >
        {total > 0 ? (
          slices.map((s) => {
            const value = Math.max(0, s.value);
            if (value <= 0) return null;
            const fraction = value / total;
            const startAngle = cursor * TAU;
            const endAngle = (cursor + fraction) * TAU;
            cursor += fraction;
            const midAngle = (startAngle + endAngle) / 2;
            const pct = Math.round(fraction * 100);
            const labelX = CX + LABEL_R * Math.sin(midAngle);
            const labelY = CY - LABEL_R * Math.cos(midAngle);
            const anchor = Math.sin(midAngle) > 0.15 ? 'start' : Math.sin(midAngle) < -0.15 ? 'end' : 'middle';
            return (
              <g key={s.key}>
                <path
                  d={arcPath(CX, CY, R, R0, startAngle, endAngle)}
                  fill={s.color}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={() =>
                    show(CX + (R + R0) / 2 * Math.sin(midAngle), CY - (R + R0) / 2 * Math.cos(midAngle), [
                      s.label,
                      `${formatValue(value)} · ${pct}%`,
                    ])
                  }
                  onMouseLeave={hide}
                >
                  <title>{`${s.label}: ${formatValue(value)} (${pct}%)`}</title>
                </path>
                {pct >= 4 ? (
                  <text
                    x={labelX}
                    y={labelY + 4}
                    textAnchor={anchor}
                    fontSize={12}
                    fill="hsl(var(--foreground))"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {pct}%
                  </text>
                ) : null}
              </g>
            );
          })
        ) : (
          <circle cx={CX} cy={CY} r={(R + R0) / 2} fill="none" stroke="hsl(var(--border))" strokeWidth={R - R0} />
        )}

        {/* Centre total */}
        <text
          x={CX}
          y={CY - 2}
          textAnchor="middle"
          fontSize={30}
          fontWeight={600}
          fill="hsl(var(--foreground))"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatValue(total)}
        </text>
        {centerLabel ? (
          <text x={CX} y={CY + 20} textAnchor="middle" fontSize={13} fill="hsl(var(--muted-foreground))">
            {centerLabel}
          </text>
        ) : null}

        {tip ? <SvgTooltip tip={tip} chartWidth={VBW} chartHeight={VBH} /> : null}
      </svg>
    </ChartFrame>
  );
}
