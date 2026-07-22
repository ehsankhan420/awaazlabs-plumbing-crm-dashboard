/**
 * grade-breakdown.tsx — §12.3 the five grading dimensions, per-call and aggregate.
 *
 * SHARED CONTRACT. The Conversations tab (§10.1) imports this component to expand its
 * per-call grade badge into the full breakdown, so its props are deliberately minimal
 * (`{ grade: QaGrade }`) and it is fully self-contained: no session, no fixture, no hooks —
 * just the grade object and the canonical dimension metadata. Do not move this file.
 *
 * Renders all five dimensions in the spec's order with their label and description, each
 * with a value bar in `--chart-1` (4.42:1 — the value is also shown as a number, so identity
 * never rests on color). No color literal appears here.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import {
  GRADING_DIMENSIONS,
  GRADING_DIMENSION_DESCRIPTIONS,
  GRADING_DIMENSION_LABELS,
} from '@/shared/status-models';
import type { QaGrade } from '@/mock/schema';

export interface GradeBreakdownProps {
  readonly grade: QaGrade;
  readonly className?: string;
}

export function GradeBreakdown({ grade, className }: GradeBreakdownProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-3">
        <span className="text-sm font-medium text-muted-foreground">Overall grade</span>
        <span className="text-2xl font-semibold tabular-nums text-foreground">
          {grade.overall}
          <span className="ml-0.5 text-sm font-normal text-muted-foreground">/100</span>
        </span>
      </div>

      <dl className="flex flex-col gap-3">
        {GRADING_DIMENSIONS.map((dim) => {
          const score = Math.max(0, Math.min(100, grade.breakdown[dim]));
          return (
            <div key={dim} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm font-medium text-foreground">{GRADING_DIMENSION_LABELS[dim]}</dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">{grade.breakdown[dim]}</dd>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-chart-1" style={{ width: `${score}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{GRADING_DIMENSION_DESCRIPTIONS[dim]}</p>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
