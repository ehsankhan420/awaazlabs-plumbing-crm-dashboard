/**
 * Report generation — frontend-only build.
 *
 * Builds the requested CSV locally from the mock fixtures instead of hitting a backend.
 * The exported signatures are unchanged, so the reports page needs no edits. Each call
 * writes an audit event, mirroring how a real backend would gate and log an export.
 */

import type { GenerateReportRequest } from './report-contract';
import { isRawReportSection } from './report-contract';
import type { Session } from '@/mock/data-access';
import { canExport, maskPhone } from '@/mock/data-access';
import { getFixture } from '@/mock/fixtures';
import { writeAuditEvent } from '@/shared/audit';
import {
  CALL_DISPOSITION_LABELS,
  INTAKE_CHANNEL_LABELS,
  ISSUE_TYPE_LABELS,
  JOB_PRIORITY_LABELS,
  JOB_STATUS_LABELS,
  LANGUAGE_LABELS,
} from '@/shared/status-models';

export class ReportApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ReportApiError';
    this.code = code;
  }
}

interface GenerateReportOptions {
  readonly endpoint?: string;
}

function fallbackFilename(request: GenerateReportRequest): string {
  return `${request.agent}-report-${request.from}-to-${request.to}.${request.format}`.replace(/[^a-z0-9._-]+/gi, '-');
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function inRange(iso: string, from: string, to: string): boolean {
  const day = iso.slice(0, 10);
  return day >= from && day <= to;
}

/** Build the report CSV from the fixture for the requested sections and window. */
function buildReportCsv(session: Session, request: GenerateReportRequest): { csv: string; rowCount: number } {
  const fixture = getFixture(session.orgId);
  const locationScoped = <T extends { locationId: string }>(rows: readonly T[]): readonly T[] =>
    session.locationId === null ? rows : rows.filter((r) => r.locationId === session.locationId);

  const calls = locationScoped(fixture.calls).filter(
    (c) => c.agent === 'receptionist' && inRange(c.atUtc, request.from, request.to),
  );
  const jobs = locationScoped(fixture.jobs).filter(
    (j) => j.createdBy === 'ai_receptionist' && inRange(j.createdAtUtc, request.from, request.to),
  );

  const lines: string[] = [];
  const section = (title: string) => lines.push('', title);
  const row = (...cells: string[]) => lines.push(cells.map(csvField).join(','));
  let rowCount = 0;

  const wanted = new Set(request.sections);

  if (wanted.has('summary_kpis')) {
    section('Summary KPIs');
    row('Metric', 'Value');
    const jobsCreated = calls.filter((c) => c.disposition === 'job_created').length;
    row('Inbound calls handled', String(calls.length));
    row('Jobs created', String(jobsCreated));
    row('Job creation rate', calls.length ? `${Math.round((jobsCreated / calls.length) * 100)}%` : '—');
    rowCount += 3;
  }

  if (wanted.has('call_outcomes')) {
    section('Call outcomes');
    row('Outcome', 'Calls');
    const byDisposition = new Map<string, number>();
    for (const c of calls) byDisposition.set(c.disposition, (byDisposition.get(c.disposition) ?? 0) + 1);
    for (const [disp, count] of byDisposition) {
      row(CALL_DISPOSITION_LABELS[disp as keyof typeof CALL_DISPOSITION_LABELS] ?? disp, String(count));
      rowCount += 1;
    }
  }

  if (wanted.has('priority')) {
    section('Priority mix');
    row('Priority', 'Calls');
    for (const priority of ['routine', 'urgent', 'emergency'] as const) {
      row(JOB_PRIORITY_LABELS[priority], String(calls.filter((c) => c.priority === priority).length));
      rowCount += 1;
    }
  }

  if (wanted.has('intake_channel')) {
    section('Intake channel');
    row('Channel', 'Jobs');
    const byChannel = new Map<string, number>();
    for (const j of jobs) byChannel.set(j.intakeChannel, (byChannel.get(j.intakeChannel) ?? 0) + 1);
    for (const [ch, count] of byChannel) {
      row(INTAKE_CHANNEL_LABELS[ch as keyof typeof INTAKE_CHANNEL_LABELS] ?? ch, String(count));
      rowCount += 1;
    }
  }

  if (wanted.has('language_mix')) {
    section('Language mix');
    row('Language', 'Jobs');
    for (const lang of ['en', 'es', 'other'] as const) {
      row(LANGUAGE_LABELS[lang], String(jobs.filter((j) => j.language === lang).length));
      rowCount += 1;
    }
  }

  if (wanted.has('jobs_created')) {
    section('Jobs created');
    row('Job reference', 'Issue type', 'Status', 'Created at');
    for (const j of jobs) {
      row(j.reference, ISSUE_TYPE_LABELS[j.issueType], JOB_STATUS_LABELS[j.status], j.createdAtUtc);
      rowCount += 1;
    }
  }

  if (wanted.has('raw_calls') && !isRawReportSection('raw_calls')) {
    // (raw sections always allowed in this build)
  }
  if (wanted.has('raw_calls')) {
    section('Raw call log');
    row('Call id', 'Timestamp', 'Disposition', 'Priority', 'QA grade');
    for (const c of calls) {
      row(c.id, c.atUtc, CALL_DISPOSITION_LABELS[c.disposition], JOB_PRIORITY_LABELS[c.priority], c.grade ? String(c.grade.overall) : '');
      rowCount += 1;
    }
  }

  if (wanted.has('raw_jobs')) {
    section('Raw job list');
    row('Job reference', 'Customer phone (masked)', 'Issue type', 'Status', 'Created at');
    const contactsById = new Map(fixture.contacts.map((c) => [c.id, c]));
    for (const j of jobs) {
      const contact = contactsById.get(j.contactId);
      const phone = contact?.identity ? maskPhone(contact.identity.phoneE164) : '—';
      row(j.reference, phone, ISSUE_TYPE_LABELS[j.issueType], JOB_STATUS_LABELS[j.status], j.createdAtUtc);
      rowCount += 1;
    }
  }

  return { csv: lines.join('\r\n'), rowCount };
}

export async function generateReportCsv(
  session: Session,
  request: GenerateReportRequest,
  _options: GenerateReportOptions = {},
): Promise<string> {
  if (!canExport(session)) {
    throw new ReportApiError('forbidden', 'Your current role cannot export this report.');
  }
  const { csv, rowCount } = buildReportCsv(session, request);
  const filename = fallbackFilename(request);
  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: 'export',
    objectRef: `report:${request.agent}`,
    locationId: session.locationId,
    detail: { rowCount: String(rowCount), from: request.from, to: request.to },
  });
  downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  return filename;
}

export async function sendReportEmail(
  session: Session,
  request: GenerateReportRequest,
  email: string,
  _options: GenerateReportOptions = {},
): Promise<{ readonly resendEmailId: string; readonly filename: string; readonly rowCount: number }> {
  if (!canExport(session)) {
    throw new ReportApiError('forbidden', 'Your current role cannot export this report.');
  }
  const { rowCount } = buildReportCsv(session, request);
  const filename = fallbackFilename(request);
  writeAuditEvent({
    actor: session.actor,
    role: session.role,
    eventType: 'export',
    objectRef: `report_email:${request.agent}`,
    locationId: session.locationId,
    detail: { rowCount: String(rowCount), email },
  });
  // Frontend-only build: no email is actually sent. Return a synthetic id so the UI
  // confirms the (mock) send.
  return { resendEmailId: `mock_${Date.now()}`, filename, rowCount };
}
