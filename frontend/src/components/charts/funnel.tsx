'use client';

/**
 * funnel.tsx — vertical funnel, N monotonically shrinking stages.
 *
 * Consumers: §13.1 review pipeline (EIGHT stages), §14.1 reengagement (six stages), §14.2
 * campaign-scoped funnel.
 *
 * SINGLE HUE — every stage is `var(--chart-1)`. THEME_NOTES §6: an ordinal ramp was tested
 * and mathematically rejected (eight steps cannot clear the adjacent-lightness floor), and
 * order is already carried by vertical position and shrinking width, so color is not spent
 * re-encoding it. Per-stage count AND stage-to-stage conversion % render as direct labels.
 * No color literal here.
 */

import React from 'react';
import { roundedRectPath } from './scales';
import {
  ChartFrame,
  SvgTooltip,
  useChartTooltip,
  type ChartTableData,
} from './chart-frame';

export interface FunnelStage {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

export interface FunnelProps {
  readonly title: string;
  readonly description?: string;
  readonly footnote?: string;
  readonly tableData: ChartTableData;
  readonly stages: readonly FunnelStage[];
  readonly formatCount?: (value: number) => string;
}

const VBW = 720;
const LABEL_W = 168;
const BARS_LEFT = LABEL_W;
const BARS_RIGHT = 704;
const BARS_WIDTH = BARS_RIGHT - BARS_LEFT;
const CX = (BARS_LEFT + BARS_RIGHT) / 2;
const ROW_H = 38;
const GAP_H = 30;
const MIN_BAR_W = 64;
const CORNER = 6;
const FUNNEL_HUE = 'var(--chart-1)';

export function Funnel({
  title,
  description,
  footnote,
  tableData,
  stages,
  formatCount = (v) => String(v),
}: FunnelProps): React.JSX.Element {
  const { tip, show, hide } = useChartTooltip();

  const topCount = Math.max(stages[0]?.count ?? 0, 1);
  const VBH = stages.length * ROW_H + Math.max(stages.length - 1, 0) * GAP_H + 16;

  const legend = [{ label: 'Volume through stage', token: FUNNEL_HUE }];

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
        aria-label={`${title} — funnel with ${stages.length} stages`}
      >
        {stages.map((stage, i) => {
          const rowY = 8 + i * (ROW_H + GAP_H);
          const fraction = Math.max(0, stage.count) / topCount;
          const barW = Math.max(MIN_BAR_W, fraction * BARS_WIDTH);
          const barX = CX - barW / 2;
          const prev = i > 0 ? stages[i - 1].count : null;
          const conversion =
            prev !== null && prev > 0 ? Math.round((stage.count / prev) * 100) : null;

          return (
            <g key={stage.key}>
              {/* Conversion connector in the gap above this stage */}
              {conversion !== null ? (
                <text
                  x={CX}
                  y={rowY - GAP_H / 2 + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fill="hsl(var(--muted-foreground))"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {`↓ ${conversion}%`}
                </text>
              ) : null}

              {/* Stage label */}
              <text
                x={LABEL_W - 16}
                y={rowY + ROW_H / 2 + 4}
                textAnchor="end"
                fontSize={13}
                fill="hsl(var(--foreground))"
              >
                {stage.label}
              </text>

              {/* Bar */}
              <path
                d={roundedRectPath(barX, rowY, barW, ROW_H, {
                  tl: CORNER,
                  tr: CORNER,
                  br: CORNER,
                  bl: CORNER,
                })}
                fill={FUNNEL_HUE}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                onMouseEnter={() =>
                  show(CX, rowY, [
                    stage.label,
                    `${formatCount(stage.count)}${conversion !== null ? ` · ${conversion}% of prior` : ''}`,
                  ])
                }
                onMouseLeave={hide}
              >
                <title>{`${stage.label}: ${formatCount(stage.count)}`}</title>
              </path>

              {/* Count direct label inside the bar */}
              <text
                x={CX}
                y={rowY + ROW_H / 2 + 4}
                textAnchor="middle"
                fontSize={13}
                fontWeight={600}
                fill="hsl(var(--card))"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatCount(stage.count)}
              </text>
            </g>
          );
        })}

        {tip ? <SvgTooltip tip={tip} chartWidth={VBW} chartHeight={VBH} /> : null}
      </svg>
    </ChartFrame>
  );
}
