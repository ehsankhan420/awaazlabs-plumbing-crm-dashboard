'use client';

/**
 * loop-header.tsx — §12.1 the loop, visualized. Four stages with live counts, each a
 * click-through filter. Counts come from `loopCounts` (the canonical §12.1 definition), so
 * the stage totals here and any other surface reading them cannot disagree.
 */

import React from 'react';
import { LoopGraphic } from '@/components/charts/loop-graphic';
import type { LoopCounts } from '@/lib/metrics';
import { formatCount } from '@/lib/format';

export type LoopStageKey =
  | 'callsCompleted'
  | 'analyzedAndGraded'
  | 'flaggedForOptimization'
  | 'optimizationsApplied';

const STAGE_LABELS: Readonly<Record<LoopStageKey, string>> = {
  callsCompleted: 'Calls completed',
  analyzedAndGraded: 'Analyzed and graded',
  flaggedForOptimization: 'Flagged for optimization',
  optimizationsApplied: 'Optimizations applied',
};

const STAGE_ORDER: readonly LoopStageKey[] = [
  'callsCompleted',
  'analyzedAndGraded',
  'flaggedForOptimization',
  'optimizationsApplied',
];

export function LoopHeader({
  counts,
  onStageClick,
}: {
  counts: LoopCounts;
  onStageClick: (stage: LoopStageKey) => void;
}): React.JSX.Element {
  const stages = STAGE_ORDER.map((key) => ({ key, label: STAGE_LABELS[key], count: counts[key] }));

  return (
    <LoopGraphic
      title="The quality and optimization loop"
      description="Every completed interaction is analyzed, graded, and fed back into continuous tuning. Select a stage to filter the timeline below."
      footnote="Counts reflect the current period and location filter. This loop runs continuously under continuous supervision."
      stages={stages}
      onStageClick={(key) => onStageClick(key as LoopStageKey)}
      formatCount={formatCount}
      tableData={{
        columns: ['Stage', 'Count'],
        rows: stages.map((s) => [s.label, formatCount(s.count)]),
      }}
    />
  );
}
