'use client';

import React from 'react';
import { AlertTriangle, OctagonAlert } from 'lucide-react';
import { Badge, type BadgeVariant } from './badge';
import {
  ASSIGNMENT_STATUS_LABELS,
  CALL_DISPOSITION_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CHAT_OUTCOME_LABELS,
  ESCALATION_SEVERITY_LABELS,
  ESCALATION_STATUS_LABELS,
  FLAG_STATUS_LABELS,
  JOB_PRIORITY_LABELS,
  JOB_STATUS_LABELS,
  KNOWLEDGE_REQUEST_STATUS_LABELS,
  OPTIMIZATION_EVENT_STATUS_LABELS,
  OUTREACH_OUTCOME_LABELS,
  REVIEW_REQUEST_STATUS_LABELS,
  type AssignmentStatus,
  type CallDisposition,
  type CampaignStatus,
  type ChatOutcome,
  type EscalationSeverity,
  type EscalationStatus,
  type FlagStatus,
  type JobPriority,
  type JobStatus,
  type KnowledgeRequestStatus,
  type OptimizationEventStatus,
  type OutreachOutcome,
  type ReviewRequestStatus,
} from '@/shared/status-models';

/**
 * Status chips. Each component takes its canonical union type — never `string` — so an
 * invalid status cannot compile. Labels come exclusively from the `*_LABELS` maps in
 * status-models.ts; no label is hardcoded here.
 *
 * Color policy (§3.4): red is reserved for destructive/critical states (Emergency
 * priority, Exhausted assignment, Critical severity); amber for warning states (Urgent).
 * A status meaning is never carried by color alone — Urgent and Emergency chips always
 * include an icon with the text.
 */

function Chip({ variant, label }: { variant: BadgeVariant; label: string }) {
  return <Badge variant={variant}>{label}</Badge>;
}

export function JobStatusChip({ status }: { status: JobStatus }) {
  return <Chip variant="secondary" label={JOB_STATUS_LABELS[status]} />;
}

export function AssignmentStatusChip({ status }: { status: AssignmentStatus }) {
  // §3.2: Exhausted is the needs-attention terminal state and carries the red accent.
  const variant: BadgeVariant = status === 'exhausted' ? 'destructive' : 'secondary';
  return <Chip variant={variant} label={ASSIGNMENT_STATUS_LABELS[status]} />;
}

export function PriorityChip({ priority }: { priority: JobPriority }) {
  // §3.4: Routine neutral; Urgent amber + warning icon; Emergency red + alert icon.
  if (priority === 'routine') {
    return <Chip variant="secondary" label={JOB_PRIORITY_LABELS.routine} />;
  }
  const variant: BadgeVariant = priority === 'emergency' ? 'destructive' : 'warning';
  const Icon = priority === 'emergency' ? OctagonAlert : AlertTriangle;
  return (
    <Badge variant={variant}>
      <span className="inline-flex items-center gap-1">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {JOB_PRIORITY_LABELS[priority]}
      </span>
    </Badge>
  );
}

export function OutreachOutcomeChip({ outcome }: { outcome: OutreachOutcome }) {
  const variant: BadgeVariant = outcome === 'accepted' ? 'outline' : outcome === 'failed' ? 'destructive' : 'secondary';
  return <Chip variant={variant} label={OUTREACH_OUTCOME_LABELS[outcome]} />;
}

export function EscalationStatusChip({ status }: { status: EscalationStatus }) {
  return <Chip variant="secondary" label={ESCALATION_STATUS_LABELS[status]} />;
}

export function SeverityChip({ severity }: { severity: EscalationSeverity }) {
  // §3.6: Critical is red; Urgent amber; Attention neutral. Icon + text, never color alone.
  if (severity === 'attention') {
    return <Chip variant="secondary" label={ESCALATION_SEVERITY_LABELS.attention} />;
  }
  const variant: BadgeVariant = severity === 'critical' ? 'destructive' : 'warning';
  const Icon = severity === 'critical' ? OctagonAlert : AlertTriangle;
  return (
    <Badge variant={variant}>
      <span className="inline-flex items-center gap-1">
        <Icon className="h-3 w-3" aria-hidden="true" />
        {ESCALATION_SEVERITY_LABELS[severity]}
      </span>
    </Badge>
  );
}

export function FlagStatusChip({ status }: { status: FlagStatus }) {
  return <Chip variant="secondary" label={FLAG_STATUS_LABELS[status]} />;
}

export function OptimizationStatusChip({ status }: { status: OptimizationEventStatus }) {
  return <Chip variant="secondary" label={OPTIMIZATION_EVENT_STATUS_LABELS[status]} />;
}

export function CallDispositionChip({ status }: { status: CallDisposition }) {
  const variant: BadgeVariant = status === 'emergency_escalation' ? 'destructive' : 'secondary';
  return <Chip variant={variant} label={CALL_DISPOSITION_LABELS[status]} />;
}

export function ChatOutcomeChip({ outcome }: { outcome: ChatOutcome }) {
  return <Chip variant="secondary" label={CHAT_OUTCOME_LABELS[outcome]} />;
}

export function CampaignStatusChip({ status }: { status: CampaignStatus }) {
  return <Chip variant="secondary" label={CAMPAIGN_STATUS_LABELS[status]} />;
}

export function ReviewRequestStatusChip({ status }: { status: ReviewRequestStatus }) {
  return <Chip variant="secondary" label={REVIEW_REQUEST_STATUS_LABELS[status]} />;
}

export function KnowledgeRequestStatusChip({ status }: { status: KnowledgeRequestStatus }) {
  return <Chip variant="secondary" label={KNOWLEDGE_REQUEST_STATUS_LABELS[status]} />;
}
