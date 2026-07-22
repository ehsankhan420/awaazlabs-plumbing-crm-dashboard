'use client';

/**
 * compliance-panel.tsx — §12.6, exactly three rate metrics. "These three numbers are the
 * governance story in metric form."
 *
 *  1. Policy and safety compliance rate — grading dimension two (Compliance); target 100%.
 *  2. Disclosure delivery rate — consent disclosures delivered on two-party-consent calls.
 *  3. Escalation correctness rate — escalations correctly triggered and routed.
 *
 * Each is derived from the fixture (see quality-metrics.ts). A rate that is not derivable in
 * the current scope (e.g. no two-party-consent calls) renders "Not applicable", never a
 * fabricated number.
 */

import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import type { ComplianceRates } from './quality-metrics';

interface RateSpec {
  readonly label: string;
  readonly value: number | null;
  readonly target?: string;
  readonly tooltip: string;
}

function RateTile({ spec }: { spec: RateSpec }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{spec.label}</span>
        <Tooltip label={`How ${spec.label} is measured`} content={spec.tooltip}>
          <Info className="h-4 w-4" aria-hidden="true" />
        </Tooltip>
      </div>
      <span className="text-4xl font-semibold tabular-nums text-foreground">
        {spec.value === null ? 'N/A' : `${spec.value}%`}
      </span>
      {spec.value === null ? (
        <span className="text-xs text-muted-foreground">Not applicable in the current scope.</span>
      ) : spec.target ? (
        <span className="text-xs text-muted-foreground">{spec.target}</span>
      ) : null}
    </div>
  );
}

export function CompliancePanel({ rates }: { rates: ComplianceRates }): React.JSX.Element {
  const specs: readonly RateSpec[] = [
    {
      label: 'Policy and safety compliance',
      value: rates.safetyPolicyCompliance,
      target: 'Target 100%',
      tooltip:
        'Mean of the Policy and Safety Compliance grading dimension — required disclosures made and safety guidance delivered — averaged across all graded calls in scope.',
    },
    {
      label: 'Disclosure delivery',
      value: rates.disclosureDelivery,
      tooltip:
        'Share of calls at two-party-consent locations where the recording-consent disclosure was delivered, out of recorded calls at those locations.',
    },
    {
      label: 'Escalation correctness',
      value: rates.escalationCorrectness,
      tooltip:
        'Share of escalations that were correctly triggered — a recognized escalation trigger routed to a destination — out of all escalations in scope.',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compliance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          {specs.map((spec) => (
            <RateTile key={spec.label} spec={spec} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
