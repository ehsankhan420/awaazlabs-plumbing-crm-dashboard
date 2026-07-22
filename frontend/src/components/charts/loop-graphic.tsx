'use client';

/**
 * loop-graphic.tsx — §12.1 THE CENTERPIECE. The automation loop, visualized.
 *
 * Four connected stages — Calls completed → Analyzed and graded → Flagged for optimization →
 * Optimizations applied — with a directional return arc back to the start, because it is a
 * LOOP, not a pipeline. Each stage shows a live count and is a click-through
 * (`onStageClick(stageKey)`), keyboard-operable as a button.
 *
 * `var(--chart-1)` carries the flow (accent rails + arrows); `hsl(var(--border))` is the
 * chrome (node outlines). Counts wear `--foreground` (text never wears the series color,
 * THEME_NOTES §7). No color literal in this file.
 */

import React, { useId, useState } from 'react';
import {
  ChartFrame,
  useChartTooltip,
  SvgTooltip,
  type ChartTableData,
} from './chart-frame';

export interface LoopStage {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

export interface LoopGraphicProps {
  readonly title: string;
  readonly description?: string;
  readonly footnote?: string;
  readonly tableData: ChartTableData;
  /** The four loop stages, in order. */
  readonly stages: readonly LoopStage[];
  readonly onStageClick?: (stageKey: string) => void;
  readonly formatCount?: (value: number) => string;
}

const VBW = 860;
const VBH = 256;
const NODE_W = 182;
const NODE_H = 100;
const NODE_Y = 40;
const GAP = 30;
const NODE_X0 = (VBW - (NODE_W * 4 + GAP * 3)) / 2;
const CENTER_Y = NODE_Y + NODE_H / 2;
const RETURN_BASE_Y = 216;
const CORNER = 14;

/** Greedy word-wrap into at most two lines so labels never clip a node. */
function wrapLabel(label: string, maxChars = 17): [string, string?] {
  const words = label.split(' ');
  let line1 = '';
  let rest = '';
  for (const word of words) {
    if (!rest && (line1 ? `${line1} ${word}` : word).length <= maxChars) {
      line1 = line1 ? `${line1} ${word}` : word;
    } else {
      rest = rest ? `${rest} ${word}` : word;
    }
  }
  return rest ? [line1, rest] : [line1];
}

export function LoopGraphic({
  title,
  description,
  footnote,
  tableData,
  stages,
  onStageClick,
  formatCount = (v) => String(v),
}: LoopGraphicProps): React.JSX.Element {
  const { tip, show, hide } = useChartTooltip();
  const [hovered, setHovered] = useState<string | null>(null);
  const arrowId = useId().replace(/:/g, '');

  const nodeX = (i: number): number => NODE_X0 + i * (NODE_W + GAP);

  const firstCx = nodeX(0) + NODE_W / 2;
  const lastCx = nodeX(stages.length - 1) + NODE_W / 2;

  const returnPath = [
    `M${lastCx} ${NODE_Y + NODE_H}`,
    `V${RETURN_BASE_Y - CORNER}`,
    `Q${lastCx} ${RETURN_BASE_Y} ${lastCx - CORNER} ${RETURN_BASE_Y}`,
    `H${firstCx + CORNER}`,
    `Q${firstCx} ${RETURN_BASE_Y} ${firstCx} ${RETURN_BASE_Y - CORNER}`,
    `V${NODE_Y + NODE_H + 6}`,
  ].join(' ');

  const legend = [{ label: 'Loop flow', token: 'var(--chart-1)' }];

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
        role="group"
        aria-label={`${title} — four-stage optimization loop`}
      >
        <defs>
          <marker
            id={`arrow-${arrowId}`}
            markerWidth={12}
            markerHeight={12}
            refX={7}
            refY={4}
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0 0 L8 4 L0 8 Z" fill="var(--chart-1)" />
          </marker>
        </defs>

        {/* Forward connectors */}
        {stages.slice(0, -1).map((s, i) => (
          <line
            key={`arrow-${s.key}`}
            x1={nodeX(i) + NODE_W + 3}
            x2={nodeX(i + 1) - 5}
            y1={CENTER_Y}
            y2={CENTER_Y}
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            markerEnd={`url(#arrow-${arrowId})`}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Return arc (this is what makes it a loop) */}
        <path
          d={returnPath}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          strokeDasharray="6 5"
          markerEnd={`url(#arrow-${arrowId})`}
          vectorEffect="non-scaling-stroke"
        />
        <text
          x={(firstCx + lastCx) / 2}
          y={RETURN_BASE_Y + 22}
          textAnchor="middle"
          fontSize={12}
          fill="hsl(var(--muted-foreground))"
        >
          Continuous optimization
        </text>

        {/* Stage nodes */}
        {stages.map((s, i) => {
          const x = nodeX(i);
          const isHover = hovered === s.key;
          const interactive = Boolean(onStageClick);
          return (
            <g
              key={s.key}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={`${s.label}: ${formatCount(s.count)}`}
              className={interactive ? 'cursor-pointer' : undefined}
              onClick={interactive ? () => onStageClick?.(s.key) : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onStageClick?.(s.key);
                      }
                    }
                  : undefined
              }
              onMouseEnter={() => {
                setHovered(s.key);
                show(x + NODE_W / 2, NODE_Y, [s.label, formatCount(s.count)]);
              }}
              onMouseLeave={() => {
                setHovered(null);
                hide();
              }}
            >
              <rect
                x={x}
                y={NODE_Y}
                width={NODE_W}
                height={NODE_H}
                rx={12}
                fill={isHover ? 'hsl(var(--accent))' : 'hsl(var(--card))'}
                stroke={isHover ? 'var(--chart-1)' : 'hsl(var(--border))'}
                strokeWidth={isHover ? 2 : 1.5}
                vectorEffect="non-scaling-stroke"
              />
              {/* chart-1 flow rail */}
              <rect x={x + 14} y={NODE_Y + 15} width={36} height={4} rx={2} fill="var(--chart-1)" />
              {(() => {
                const [l1, l2] = wrapLabel(`${i + 1}. ${s.label}`);
                return (
                  <text x={x + 14} y={NODE_Y + 40} fontSize={13} fill="hsl(var(--muted-foreground))">
                    <tspan x={x + 14}>{l1}</tspan>
                    {l2 ? (
                      <tspan x={x + 14} dy={16}>
                        {l2}
                      </tspan>
                    ) : null}
                  </text>
                );
              })()}
              <text
                x={x + 14}
                y={NODE_Y + 88}
                fontSize={30}
                fontWeight={700}
                fill="hsl(var(--foreground))"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatCount(s.count)}
              </text>
            </g>
          );
        })}

        {tip ? <SvgTooltip tip={tip} chartWidth={VBW} chartHeight={VBH} /> : null}
      </svg>
    </ChartFrame>
  );
}
