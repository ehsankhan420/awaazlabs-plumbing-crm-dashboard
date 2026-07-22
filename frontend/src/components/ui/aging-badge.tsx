'use client';

import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { Badge, type BadgeVariant } from './badge';
import type { AgingLevel } from '@/lib/metrics';

/**
 * §5.5 aging presentation: "Neutral before threshold. Amber when a Routine or Urgent
 * dispatch is approaching its threshold. Red when the assignment threshold is exceeded
 * or Assignment Status is Exhausted. Aging always includes text, duration, and icon."
 *
 * The level is computed by `dispatchAgingLevel` / `isEscalationOverdue` in metrics.ts —
 * thresholds are never hardcoded here. Amber must not carry meaning alone, so the badge
 * always renders an icon + text label; the color is only reinforcement.
 */
export function AgingBadge({
  level,
  minutes,
  label = 'in queue',
}: {
  level: AgingLevel;
  /** Age in minutes; rendered as "42m" or "3.5h". */
  minutes: number;
  /** Trailing text, e.g. "in queue" -> "42m in queue". */
  label?: string;
}) {
  const variant: BadgeVariant = level === 'red' ? 'destructive' : level === 'amber' ? 'warning' : 'secondary';
  const Icon = level === 'none' ? Clock : AlertTriangle;
  const duration = minutes < 90 ? `${Math.max(0, Math.round(minutes))}m` : `${(minutes / 60).toFixed(minutes < 600 ? 1 : 0)}h`;

  return (
    <Badge variant={variant}>
      <span className="inline-flex items-center gap-1">
        <Icon className="h-3 w-3" aria-hidden="true" />
        <span className="tabular-nums">
          {duration} {label}
        </span>
      </span>
    </Badge>
  );
}
