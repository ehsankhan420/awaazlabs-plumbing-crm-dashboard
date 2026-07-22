/**
 * Scheduled reports — frontend-only build.
 *
 * A module-level in-memory store keeps scheduled reports for the lifetime of the session,
 * so create / pause / resume / delete / cancel / send-now all behave like real writes. A
 * hard refresh resets it, which is acceptable and stated for a frontend-only build. The
 * exported signatures are unchanged, so the scheduled-reports page needs no edits.
 */

import type { Session } from '@/mock/data-access';
import type { ReceptionistReportSection } from './report-contract';

export type ScheduledReportFrequency = 'daily' | 'weekly' | 'monthly';
export type ScheduledReportStatus = 'active' | 'paused' | 'deleted';
export type ScheduledReportRunStatus = 'pending' | 'canceled' | 'sending' | 'sent' | 'failed';

export class ScheduledReportApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ScheduledReportApiError';
    this.code = code;
  }
}

export interface ScheduledReportRunDto {
  readonly id: string;
  readonly scheduledReportId: string;
  readonly scheduledFor: string;
  readonly rangeFrom: string | null;
  readonly rangeTo: string | null;
  readonly recipient: string;
  readonly status: ScheduledReportRunStatus;
  readonly resendEmailId: string | null;
  readonly sentAt: string | null;
  readonly errorMessage: string | null;
  readonly rowCount: number | null;
  readonly canceledAt: string | null;
  readonly canceledBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ScheduledReportDto {
  readonly id: string;
  readonly agent: 'receptionist';
  readonly frequency: ScheduledReportFrequency;
  readonly sections: readonly ReceptionistReportSection[];
  readonly format: 'csv';
  readonly recipients: readonly string[];
  readonly sendTimeLocal: string;
  readonly timezone: string;
  readonly status: ScheduledReportStatus;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly nextRun: ScheduledReportRunDto | null;
  readonly latestRun: ScheduledReportRunDto | null;
}

interface StoredReport {
  report: ScheduledReportDto;
  runs: ScheduledReportRunDto[];
}

const store = new Map<string, Map<string, StoredReport>>();
let seq = 0;

function orgStore(orgId: string): Map<string, StoredReport> {
  let s = store.get(orgId);
  if (!s) {
    s = new Map();
    store.set(orgId, s);
  }
  return s;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeRun(scheduleId: string, recipient: string, scheduledFor: string, status: ScheduledReportRunStatus): ScheduledReportRunDto {
  seq += 1;
  const at = nowIso();
  return {
    id: `run_${seq}`,
    scheduledReportId: scheduleId,
    scheduledFor,
    rangeFrom: null,
    rangeTo: null,
    recipient,
    status,
    resendEmailId: status === 'sent' ? `mock_${seq}` : null,
    sentAt: status === 'sent' ? at : null,
    errorMessage: null,
    rowCount: status === 'sent' ? 128 : null,
    canceledAt: status === 'canceled' ? at : null,
    canceledBy: null,
    createdAt: at,
    updatedAt: at,
  };
}

function withRuns(stored: StoredReport): ScheduledReportDto {
  const runs = [...stored.runs].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const next = runs.find((r) => r.status === 'pending') ?? null;
  const latest = [...runs].reverse().find((r) => r.status !== 'pending') ?? null;
  return { ...stored.report, nextRun: next, latestRun: latest };
}

async function delay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 80));
}

export async function listScheduledReports(session: Session): Promise<readonly ScheduledReportDto[]> {
  await delay();
  return [...orgStore(session.orgId).values()]
    .filter((s) => s.report.status !== 'deleted')
    .map(withRuns)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listScheduledReportRuns(
  session: Session,
  scheduleId: string,
): Promise<readonly ScheduledReportRunDto[]> {
  await delay();
  return [...(orgStore(session.orgId).get(scheduleId)?.runs ?? [])].sort((a, b) =>
    b.scheduledFor.localeCompare(a.scheduledFor),
  );
}

export async function createScheduledReport(
  session: Session,
  input: {
    readonly frequency: ScheduledReportFrequency;
    readonly sections: readonly ReceptionistReportSection[];
    readonly email: string;
    readonly firstSendDate: string;
    readonly sendTimeLocal: string;
  },
): Promise<ScheduledReportDto> {
  await delay();
  seq += 1;
  const id = `sched_${seq}`;
  const at = nowIso();
  const scheduledFor = `${input.firstSendDate}T${input.sendTimeLocal}:00`;
  const report: ScheduledReportDto = {
    id,
    agent: 'receptionist',
    frequency: input.frequency,
    sections: input.sections,
    format: 'csv',
    recipients: [input.email],
    sendTimeLocal: input.sendTimeLocal,
    timezone: 'America/Chicago',
    status: 'active',
    createdBy: session.actor,
    createdAt: at,
    updatedAt: at,
    nextRun: null,
    latestRun: null,
  };
  const stored: StoredReport = {
    report,
    runs: [makeRun(id, input.email, scheduledFor, 'pending')],
  };
  orgStore(session.orgId).set(id, stored);
  return withRuns(stored);
}

function update(session: Session, scheduleId: string, patch: Partial<ScheduledReportDto>): ScheduledReportDto {
  const stored = orgStore(session.orgId).get(scheduleId);
  if (!stored) throw new ScheduledReportApiError('not_found', 'Scheduled report not found.');
  stored.report = { ...stored.report, ...patch, updatedAt: nowIso() };
  return withRuns(stored);
}

export async function pauseScheduledReport(session: Session, scheduleId: string): Promise<ScheduledReportDto> {
  await delay();
  return update(session, scheduleId, { status: 'paused' });
}

export async function resumeScheduledReport(session: Session, scheduleId: string): Promise<ScheduledReportDto> {
  await delay();
  return update(session, scheduleId, { status: 'active' });
}

export async function deleteScheduledReport(session: Session, scheduleId: string): Promise<void> {
  await delay();
  update(session, scheduleId, { status: 'deleted' });
}

export async function cancelScheduledReportRun(session: Session, runId: string): Promise<ScheduledReportRunDto> {
  await delay();
  for (const stored of orgStore(session.orgId).values()) {
    const idx = stored.runs.findIndex((r) => r.id === runId);
    if (idx >= 0) {
      const run: ScheduledReportRunDto = { ...stored.runs[idx], status: 'canceled', canceledAt: nowIso(), canceledBy: session.actor };
      stored.runs[idx] = run;
      return run;
    }
  }
  throw new ScheduledReportApiError('not_found', 'Scheduled run not found.');
}

export async function sendScheduledReportNow(session: Session, runId: string): Promise<ScheduledReportRunDto> {
  await delay();
  for (const stored of orgStore(session.orgId).values()) {
    const idx = stored.runs.findIndex((r) => r.id === runId);
    if (idx >= 0) {
      const at = nowIso();
      const run: ScheduledReportRunDto = { ...stored.runs[idx], status: 'sent', sentAt: at, resendEmailId: `mock_${runId}`, rowCount: 128 };
      stored.runs[idx] = run;
      return run;
    }
  }
  throw new ScheduledReportApiError('not_found', 'Scheduled run not found.');
}
