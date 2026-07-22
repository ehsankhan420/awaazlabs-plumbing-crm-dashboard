'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Inbox, Mail, Pause, Play, Plus, Send, Trash2, XCircle } from 'lucide-react';

import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSession } from '@/shared/session-context';

import {
  RECEPTIONIST_REPORT_SECTION_DEFINITIONS,
  RECEPTIONIST_REPORT_SECTIONS,
  isRawReportSection,
  type ReceptionistReportSection,
  type ReportAgent,
} from './report-contract';
import { ReportSectionPicker, enabledReceptionistSections } from './report-section-picker';
import {
  ScheduledReportApiError,
  cancelScheduledReportRun,
  createScheduledReport,
  deleteScheduledReport,
  listScheduledReportRuns,
  listScheduledReports,
  pauseScheduledReport,
  resumeScheduledReport,
  sendScheduledReportNow,
  type ScheduledReportDto,
  type ScheduledReportRunDto,
  type ScheduledReportRunStatus,
  type ScheduledReportStatus,
} from './scheduled-report-api';

type Frequency = 'daily' | 'weekly' | 'monthly';
type EmailStatus = ScheduledReportRunStatus;
type ScheduleStatus = ScheduledReportStatus;
type RowAction = 'pause' | 'resume' | 'send' | 'cancel' | 'delete';
type HistoryFilter = 'all' | ScheduledReportRunStatus;

type ScheduleRow = {
  readonly id: string;
  readonly nextRunId: string | null;
  readonly email: string;
  readonly agent: 'receptionist';
  readonly frequency: Frequency;
  readonly sections: readonly ReceptionistReportSection[];
  readonly sendTime: string;
  readonly nextSend: string;
  readonly lastSent: string;
  readonly nextEmailStatus: EmailStatus | null;
  readonly lastEmailStatus: EmailStatus | null;
  readonly lastError: string | null;
  readonly scheduleStatus: ScheduleStatus;
};

const AGENT_OPTIONS = [
  { value: 'receptionist', label: 'Receptionist Agent' },
  { value: 'dispatch', label: 'Dispatch Agent - Coming soon', disabled: true },
  { value: 'chat', label: 'Chat Agents - Coming soon', disabled: true },
  { value: 'review_taker', label: 'Review Taker - Coming soon', disabled: true },
  { value: 'reengagement', label: 'Reengagement - Coming soon', disabled: true },
  { value: 'post_service_followup', label: 'Post-Service Follow-Up - Coming soon', disabled: true },
] as const;

const FREQUENCY_OPTIONS: readonly { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily - previous day' },
  { value: 'weekly', label: 'Weekly - previous 7 days' },
  { value: 'monthly', label: 'Monthly - previous month' },
];

const HISTORY_FILTERS: readonly { value: HistoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sent', label: 'Sent' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'canceled', label: 'Canceled' },
];

function emailLooksValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function chicagoNowParts(now = new Date()): { ymd: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: 'year' | 'month' | 'day' | 'hour' | 'minute'): string => parts.find((part) => part.type === type)?.value ?? '00';
  const ymd = `${value('year')}-${value('month')}-${value('day')}`;
  const minutes = Number(value('hour')) * 60 + Number(value('minute'));
  return { ymd, minutes };
}

function timeMinutes(value: string): number | null {
  const [hourRaw, minuteRaw = '0'] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function frequencyLabel(value: Frequency): string {
  if (value === 'daily') return 'Daily';
  if (value === 'weekly') return 'Weekly';
  return 'Monthly';
}

function timeLabel(value: string): string {
  const [hourRaw, minute = '00'] = value.split(':');
  const hour = Number(hourRaw);
  if (!Number.isFinite(hour)) return `${value} CT`;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minute} ${suffix} CT`;
}

function nextSendLabel(frequency: Frequency, sendTime: string): string {
  if (frequency === 'daily') return `Daily, ${timeLabel(sendTime)}`;
  if (frequency === 'weekly') return `Mondays, ${timeLabel(sendTime)}`;
  return `1st of month, ${timeLabel(sendTime)}`;
}

function coverageLabel(frequency: Frequency): string {
  if (frequency === 'daily') return 'Covers the previous day';
  if (frequency === 'weekly') return 'Covers the previous 7 days';
  return 'Covers the previous month';
}

function statusVariant(status: EmailStatus | ScheduleStatus): BadgeVariant {
  if (status === 'failed') return 'destructive';
  if (status === 'pending') return 'warning';
  if (status === 'paused' || status === 'canceled' || status === 'deleted') return 'outline';
  return 'secondary';
}

function statusLabel(status: EmailStatus | ScheduleStatus): string {
  if (status === 'pending') return 'Pending';
  if (status === 'canceled') return 'Canceled';
  if (status === 'sent') return 'Sent';
  if (status === 'failed') return 'Failed';
  if (status === 'sending') return 'Sending';
  if (status === 'active') return 'Active';
  if (status === 'deleted') return 'Deleted';
  return 'Paused';
}

function lastEmailLabel(status: EmailStatus | null): string {
  if (status === null || status === 'pending') return 'Not sent';
  return statusLabel(status);
}

function deliveryFailureCopy(error: string | null): string {
  if (!error) return 'Failed: email delivery was rejected.';
  const lower = error.toLowerCase();
  if (lower.includes('domain') || lower.includes('verify')) return 'Failed: sender domain not verified.';
  if (lower.includes('recipient') || lower.includes('invalid') || lower.includes('rejected')) return 'Failed: Resend rejected recipient.';
  if (lower.includes('rate') || lower.includes('limit')) return 'Failed: email provider rate limit reached.';
  return `Failed: ${error}`;
}

function sectionsLabel(sections: readonly ReceptionistReportSection[]): string {
  if (sections.length === RECEPTIONIST_REPORT_SECTIONS.length) return 'All sections';
  if (sections.length <= 2) {
    return sections
      .map((key) => RECEPTIONIST_REPORT_SECTION_DEFINITIONS.find((section) => section.key === key)?.label ?? key)
      .join(', ');
  }
  return `${sections.length} sections`;
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not sent yet';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function rowFromSchedule(schedule: ScheduledReportDto): ScheduleRow {
  const nextRun = schedule.nextRun;
  const latestRun = schedule.latestRun;
  const lastRun = latestRun?.id === nextRun?.id ? null : latestRun;
  return {
    id: schedule.id,
    nextRunId: nextRun?.id ?? null,
    email: nextRun?.recipient ?? schedule.recipients.join(', '),
    agent: schedule.agent,
    frequency: schedule.frequency,
    sections: schedule.sections,
    sendTime: schedule.sendTimeLocal,
    nextSend: nextRun ? formatDateTime(nextRun.scheduledFor) : nextSendLabel(schedule.frequency, schedule.sendTimeLocal),
    lastSent: lastRun?.sentAt ? formatDateTime(lastRun.sentAt) : 'Not sent yet',
    nextEmailStatus: nextRun?.status ?? null,
    lastEmailStatus: lastRun?.status ?? null,
    lastError: lastRun?.errorMessage ?? null,
    scheduleStatus: schedule.status,
  };
}

function ScheduleHistoryDrawer({
  row,
  runs,
  loading,
  error,
  onClose,
}: {
  readonly row: ScheduleRow;
  readonly runs: readonly ScheduledReportRunDto[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly onClose: () => void;
}): React.JSX.Element {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const filteredRuns = filter === 'all' ? runs : runs.filter((run) => run.status === filter);

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Scheduled report history"
      description={`${row.email} - ${frequencyLabel(row.frequency)} Receptionist report`}
      className="max-w-[760px]"
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">Schedule</p>
            <p className="mt-1 text-sm text-foreground">{statusLabel(row.scheduleStatus)}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">Next send</p>
            <p className="mt-1 text-sm text-foreground">{row.nextSend}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground">Fields</p>
            <p className="mt-1 text-sm text-foreground">{sectionsLabel(row.sections)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-foreground">Email history</h3>
          <span className="text-xs text-muted-foreground">
            {loading ? 'Loading...' : `${filteredRuns.length} of ${runs.length} email${runs.length === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Email history filters">
          {HISTORY_FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                filter === item.value
                  ? 'border-border bg-foreground text-background'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error ? (
          <Banner variant="destructive" title="History not loaded">
            {error}
          </Banner>
        ) : null}

        {!loading && filteredRuns.length === 0 && !error ? (
          <div className="rounded-md border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No emails recorded yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Runs will appear here after the schedule queues or sends emails.</p>
          </div>
        ) : null}

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredRuns.map((run) => (
              <div key={run.id} className="rounded-md border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{formatDateTime(run.scheduledFor)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Range: {run.rangeFrom ?? 'Unknown'} to {run.rangeTo ?? 'Unknown'}
                    </p>
                  </div>
                  <Badge variant={statusVariant(run.status)}>{statusLabel(run.status)}</Badge>
                </div>

                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Recipient: </span>
                    <span className="text-foreground">{run.recipient}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sent: </span>
                    <span className="text-foreground">{run.sentAt ? formatDateTime(run.sentAt) : 'Not sent'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rows: </span>
                    <span className="text-foreground">{run.rowCount ?? 'Not available'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Canceled by: </span>
                    <span className="text-foreground">{run.canceledBy ?? 'Not canceled'}</span>
                  </div>
                </div>

                {run.resendEmailId ? (
                  <p className="mt-3 break-all text-xs text-muted-foreground">Resend id: {run.resendEmailId}</p>
                ) : null}
                {run.status === 'failed' ? (
                  <p className="mt-3 text-sm text-destructive">{deliveryFailureCopy(run.errorMessage)}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
function SendNowConfirmationDialog({
  row,
  busy,
  onConfirm,
  onCancel,
}: {
  readonly row: ScheduleRow;
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4" role="dialog" aria-modal="true" aria-labelledby="send-now-title">
      <div className="w-full max-w-md rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg">
        <h3 id="send-now-title" className="text-lg font-semibold text-foreground">Send report now?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Send this {frequencyLabel(row.frequency).toLowerCase()} Receptionist report now to {row.email}?
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          This sends the next pending email immediately and keeps the recurring schedule active.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button onClick={onConfirm} disabled={busy}>
            <Send className="mr-2 h-4 w-4" aria-hidden="true" />
            {busy ? 'Sending...' : 'Send now'}
          </Button>
        </div>
      </div>
    </div>
  );
}
export function ScheduledReports(): React.JSX.Element {
  const { session } = useSession();
  const [agent, setAgent] = useState<ReportAgent | null>(null);
  const [frequency, setFrequency] = useState<Frequency>('weekly');
  const [email, setEmail] = useState('');
  const chicagoNow = useMemo(() => chicagoNowParts(), []);
  const initialFirstSendDate = chicagoNow.ymd;
  const [firstSendDate, setFirstSendDate] = useState(initialFirstSendDate);
  const [sendTime, setSendTime] = useState('09:00');
  const [sections, setSections] = useState<ReadonlySet<ReceptionistReportSection>>(
    () => new Set(RECEPTIONIST_REPORT_SECTIONS),
  );
  const [rows, setRows] = useState<readonly ScheduleRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState('Scheduled report error');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyRow, setBusyRow] = useState<{ readonly id: string; readonly action: RowAction } | null>(null);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [historyRuns, setHistoryRuns] = useState<readonly ScheduledReportRunDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [pendingSendRow, setPendingSendRow] = useState<ScheduleRow | null>(null);

  const todayYmd = chicagoNow.ymd;
  const hideRawSections = false;
  const canManageSchedules = session.role === 'OWNER_ADMIN' || session.role === 'MANAGER';
  const selectedSections = useMemo(
    () =>
      RECEPTIONIST_REPORT_SECTIONS.filter(
        (section) => sections.has(section) && !(hideRawSections && isRawReportSection(section)),
      ),
    [sections, hideRawSections],
  );
  const selectedSendMinutes = timeMinutes(sendTime);
  const firstDeliveryIsPast =
    firstSendDate.length > 0 &&
    (firstSendDate < todayYmd ||
      (firstSendDate === todayYmd && selectedSendMinutes !== null && selectedSendMinutes <= chicagoNow.minutes));
  const previewRecipient = emailLooksValid(email.trim()) ? email.trim() : 'recipient';
  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedScheduleId) ?? null,
    [rows, selectedScheduleId],
  );
  const canCreate =
    agent === 'receptionist' &&
    emailLooksValid(email.trim()) &&
    selectedSections.length > 0 &&
    firstSendDate.length > 0 &&
    !firstDeliveryIsPast &&
    sendTime.length > 0;

  const refreshSchedules = useCallback(async () => {
    setIsLoading(true);
    try {
      const schedules = await listScheduledReports(session);
      setRows(schedules.map(rowFromSchedule));
      setError(null);
    } catch (e) {
      setErrorTitle('Scheduled reports not loaded');
      setError(e instanceof ScheduledReportApiError ? e.message : 'Could not load scheduled reports.');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const saved = window.localStorage.getItem('plumbing-dashboard:last-report-email');
    if (saved && emailLooksValid(saved)) setEmail(saved);
  }, []);

  useEffect(() => {
    void refreshSchedules();
  }, [refreshSchedules]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (selectedScheduleId === null) {
      setHistoryRuns([]);
      setHistoryError(null);
      return;
    }

    let active = true;
    setHistoryLoading(true);
    setHistoryError(null);
    void listScheduledReportRuns(session, selectedScheduleId)
      .then((runs) => {
        if (!active) return;
        setHistoryRuns(runs);
      })
      .catch((e) => {
        if (!active) return;
        setHistoryRuns([]);
        setHistoryError(e instanceof ScheduledReportApiError ? e.message : 'Could not load scheduled report history.');
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedScheduleId, session]);

  function toggleSection(key: ReceptionistReportSection): void {
    setNotice(null);
    setError(null);
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function createSchedule(): Promise<void> {
    if (!canCreate || agent !== 'receptionist') {
      setNotice(null);
      setErrorTitle('Schedule not created');
      setError(firstDeliveryIsPast
        ? 'Choose a future Central Time delivery.'
        : 'Choose Receptionist Agent, at least one field, a valid email, first send date, and send time.');
      return;
    }
    if (!canManageSchedules) {
      setNotice(null);
      setErrorTitle('Permission required');
      setError('Creating scheduled reports requires Manager or Owner access.');
      return;
    }
    setIsSaving(true);
    try {
      const schedule = await createScheduledReport(session, {
        frequency,
        sections: selectedSections,
        email: email.trim(),
        firstSendDate,
        sendTimeLocal: sendTime,
      });
      setRows((prev) => [rowFromSchedule(schedule), ...prev]);
      window.localStorage.setItem('plumbing-dashboard:last-report-email', email.trim());
      setEmail('');
      setNotice('Schedule saved.');
      setError(null);
    } catch (e) {
      setNotice(null);
      setErrorTitle('Schedule not created');
      setError(e instanceof ScheduledReportApiError ? e.message : 'Could not create scheduled report.');
    } finally {
      setIsSaving(false);
    }
  }

  async function updateScheduleStatus(row: ScheduleRow, status: Exclude<ScheduleStatus, 'deleted'>): Promise<void> {
    if (!canManageSchedules || busyRow !== null) return;
    const action: RowAction = status === 'paused' ? 'pause' : 'resume';
    setBusyRow({ id: row.id, action });
    try {
      const schedule = status === 'paused'
        ? await pauseScheduledReport(session, row.id)
        : await resumeScheduledReport(session, row.id);
      setRows((prev) => prev.map((item) => item.id === row.id ? rowFromSchedule(schedule) : item));
      setNotice(status === 'paused' ? 'Schedule paused.' : 'Schedule resumed.');
      setError(null);
    } catch (e) {
      setNotice(null);
      setErrorTitle('Schedule not updated');
      setError(e instanceof ScheduledReportApiError ? e.message : 'Could not update scheduled report.');
    } finally {
      setBusyRow(null);
    }
  }

  async function cancelPendingEmail(row: ScheduleRow): Promise<void> {
    if (!canManageSchedules || busyRow !== null || row.nextRunId === null) return;
    setBusyRow({ id: row.id, action: 'cancel' });
    try {
      const run = await cancelScheduledReportRun(session, row.nextRunId);
      setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, nextEmailStatus: run.status, nextRunId: null } : item));
      setNotice('Pending email canceled.');
      setError(null);
      await refreshSchedules();
    } catch (e) {
      setNotice(null);
      setErrorTitle('Email not canceled');
      setError(e instanceof ScheduledReportApiError ? e.message : 'Could not cancel pending email.');
    } finally {
      setBusyRow(null);
    }
  }

  async function confirmSendNow(): Promise<void> {
    if (pendingSendRow === null) return;
    const row = pendingSendRow;
    setPendingSendRow(null);
    await sendNow(row);
  }

  async function sendNow(row: ScheduleRow): Promise<void> {
    if (!canManageSchedules || busyRow !== null || row.nextRunId === null || row.scheduleStatus !== 'active') return;
    setBusyRow({ id: row.id, action: 'send' });
    setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, nextEmailStatus: 'sending' } : item));
    try {
      const run = await sendScheduledReportNow(session, row.nextRunId);
      setRows((prev) => prev.map((item) => item.id === row.id
        ? {
          ...item,
          nextRunId: null,
          nextEmailStatus: null,
          lastEmailStatus: run.status,
          lastSent: run.sentAt ? formatDateTime(run.sentAt) : item.lastSent,
          lastError: run.errorMessage,
        }
        : item));
      setNotice(run.status === 'sent' ? 'Scheduled report email sent.' : 'Scheduled report send failed.');
      setErrorTitle('Email not sent');
      setError(run.status === 'failed' ? run.errorMessage ?? 'Scheduled report send failed.' : null);
      await refreshSchedules();
    } catch (e) {
      setRows((prev) => prev.map((item) => item.id === row.id ? { ...item, nextEmailStatus: null, lastEmailStatus: 'failed' } : item));
      setNotice(null);
      setErrorTitle('Email not sent');
      setError(e instanceof ScheduledReportApiError ? e.message : 'Could not send scheduled report email.');
    } finally {
      setBusyRow(null);
    }
  }

  async function removeSchedule(id: string): Promise<void> {
    if (!canManageSchedules || busyRow !== null) return;
    setBusyRow({ id, action: 'delete' });
    try {
      await deleteScheduledReport(session, id);
      setRows((prev) => prev.filter((row) => row.id !== id));
      setNotice('Schedule deleted.');
      setError(null);
    } catch (e) {
      setNotice(null);
      setErrorTitle('Schedule not deleted');
      setError(e instanceof ScheduledReportApiError ? e.message : 'Could not delete scheduled report.');
    } finally {
      setBusyRow(null);
    }
  }

  function selectAllSections(): void {
    setNotice(null);
    setError(null);
    setSections(new Set(enabledReceptionistSections(hideRawSections)));
  }

  function clearSections(): void {
    setNotice(null);
    setError(null);
    setSections(new Set());
  }

  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Scheduled reports
        </CardTitle>
        <CardDescription>
          Prepare recurring Receptionist CSV reports for email delivery.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {notice ? (
          <div className="fixed right-5 top-5 z-50 flex max-w-sm items-center gap-3 rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground shadow-lg" role="status">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="font-medium">Scheduled reports updated</p>
              <p className="text-xs text-muted-foreground">{notice}</p>
            </div>
          </div>
        ) : null}
        {error ? (
          <Banner variant="destructive" title={errorTitle} onDismiss={() => setError(null)}>
            {error}
          </Banner>
        ) : null}
        {!canManageSchedules ? (
          <Banner variant="default" title="View only">
            Scheduled report changes require Manager or Owner access.
          </Banner>
        ) : null}
        {hideRawSections ? (
          <Banner variant="default" title="restricted mode">
            Raw call and job sections are unavailable for scheduled reports in restricted mode.
          </Banner>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
          <div className="grid gap-4 rounded-md border border-border bg-muted/20 p-4 md:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Agent</span>
              <Select
                value={agent ?? undefined}
                onValueChange={(value) => {
                  setAgent(value as ReportAgent);
                  setNotice(null);
                  setError(null);
                }}
                options={AGENT_OPTIONS}
                placeholder="Select an agent"
                aria-label="Scheduled report agent"
              />
            </label>

            <label className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium text-foreground">Frequency</span>
              <Select
                value={frequency}
                onValueChange={(value) => setFrequency(value as Frequency)}
                options={FREQUENCY_OPTIONS}
                aria-label="Scheduled report frequency"
              />
            </label>

            <label className="flex min-w-0 flex-col gap-2 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Recipient email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setNotice(null);
                  setError(null);
                }}
                placeholder="name@example.com"
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                aria-label="Scheduled report recipient email"
              />
            </label>
          </div>

          <div className="rounded-md border border-border bg-background p-4">
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-sm font-medium text-foreground">First delivery</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">Date</span>
                <input
                  type="date"
                  value={firstSendDate}
                  min={todayYmd}
                  onChange={(event) => {
                    setFirstSendDate(event.target.value);
                    setNotice(null);
                    setError(null);
                  }}
                  className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground"
                  aria-label="Scheduled report first send date"
                />
                {firstDeliveryIsPast ? (
                  <span className="text-xs text-destructive" role="alert">Choose a future Central Time delivery.</span>
                ) : null}
              </label>

              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">Time</span>
                <input
                  type="time"
                  value={sendTime}
                  onChange={(event) => {
                    setSendTime(event.target.value);
                    setNotice(null);
                    setError(null);
                  }}
                  className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground"
                  aria-label="Scheduled report send time in Central Time"
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              First email sends {firstSendDate || 'on the selected date'} at {timeLabel(sendTime)}.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/20 px-4 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Schedule preview</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {agent === 'receptionist' ? 'Receptionist' : 'Select an agent'} report, {frequencyLabel(frequency).toLowerCase()}, {selectedSections.length} field{selectedSections.length === 1 ? '' : 's'}.
              </p>
            </div>
            <div className="text-sm text-muted-foreground md:text-right">
              <p>{coverageLabel(frequency)}</p>
              <p>First send: {firstSendDate || 'date needed'} at {timeLabel(sendTime)} to {previewRecipient}</p>
            </div>
          </div>
        </div>

        {agent === 'receptionist' ? (
          <ReportSectionPicker
            selectedSections={selectedSections}
            hideRawSections={hideRawSections}
            isOpen={sectionsOpen}
            onOpenChange={setSectionsOpen}
            onToggle={toggleSection}
            onSelectAll={selectAllSections}
            onClear={clearSections}
          />
        ) : (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Select Receptionist Agent to choose scheduled report sections.
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Scheduled CSV emails use Central Time and may send within a few minutes of the selected time. Use Send now for immediate delivery.
          </div>
          <Button onClick={createSchedule} disabled={!canCreate || isSaving || !canManageSchedules} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {isSaving ? 'Saving...' : 'Create schedule'}
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-foreground">Scheduled email queue</h3>
            <span className="text-xs text-muted-foreground">
              {isLoading ? 'Loading...' : `${rows.length} schedule${rows.length === 1 ? '' : 's'}`}
            </span>
          </div>
          {rows.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border px-6 py-10 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <h4 className="mt-3 text-sm font-medium text-foreground">No scheduled reports yet</h4>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Create a recurring Receptionist report, then use Send now anytime you need an immediate CSV email.
              </p>
            </div>
          ) : (
            <Table caption="Scheduled report emails">
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Sections</TableHead>
                  <TableHead>Next send</TableHead>
                  <TableHead>Last delivery</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                const rowBusy = busyRow?.id === row.id;
                const canCancel = row.nextEmailStatus === 'pending' && row.nextRunId !== null;
                const canSend = row.scheduleStatus === 'active' && row.nextEmailStatus === 'pending' && row.nextRunId !== null;
                const paused = row.scheduleStatus === 'paused';
                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelectedScheduleId(row.id)}
                  >
                    <TableCell>
                      <div className="flex min-w-[220px] flex-col gap-1">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          <span className="font-medium text-foreground">{row.email}</span>
                        </div>
                        <span className="pl-6 text-xs text-muted-foreground">Receptionist</span>
                      </div>
                    </TableCell>
                    <TableCell>{frequencyLabel(row.frequency)}</TableCell>
                    <TableCell>
                      <span className="block min-w-[150px] max-w-[220px] text-sm text-foreground">{sectionsLabel(row.sections)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-[140px] flex-col gap-1.5">
                        <span>{row.nextSend}</span>
                        {row.nextEmailStatus && row.nextEmailStatus !== 'pending' ? (
                          <Badge variant={statusVariant(row.nextEmailStatus)}>{statusLabel(row.nextEmailStatus)}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {row.nextEmailStatus === 'pending' ? '' : 'No pending email'}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-[150px] flex-col gap-1">
                        {row.lastEmailStatus === 'sent' ? (
                          <>
                            <span>{row.lastSent}</span>
                            <span className="text-xs text-muted-foreground">Sent</span>
                          </>
                        ) : row.lastEmailStatus === 'failed' ? (
                          <span className="max-w-[220px] text-xs text-destructive">{deliveryFailureCopy(row.lastError)}</span>
                        ) : row.lastEmailStatus ? (
                          <>
                            <span>{row.lastSent}</span>
                            <span className="text-xs text-muted-foreground">{lastEmailLabel(row.lastEmailStatus)}</span>
                          </>
                        ) : (
                          <span>Not sent yet</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.scheduleStatus)}>{statusLabel(row.scheduleStatus)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void updateScheduleStatus(row, paused ? 'active' : 'paused')}
                          disabled={!canManageSchedules || busyRow !== null}
                          aria-label={`${paused ? 'Resume' : 'Pause'} schedule for ${row.email}`}
                          title={!canManageSchedules ? 'Manager or Owner access required' : paused ? 'Resume schedule' : 'Pause schedule'}
                        >
                          {rowBusy && (busyRow?.action === 'pause' || busyRow?.action === 'resume')
                            ? <span className="text-xs">...</span>
                            : paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPendingSendRow(row)}
                          disabled={!canManageSchedules || !canSend || busyRow !== null}
                          aria-label={`Send scheduled report now to ${row.email}`}
                          className="min-w-[88px]"
                          title={!canManageSchedules ? 'Manager or Owner access required' : canSend ? 'Send now' : 'Only active schedules with pending emails can be sent'}
                        >
                          {rowBusy && busyRow?.action === 'send' ? (
                            <span className="text-xs">Sending...</span>
                          ) : (
                            <>
                              <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                              Send now
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void cancelPendingEmail(row)}
                          disabled={!canManageSchedules || !canCancel || busyRow !== null}
                          aria-label={`Cancel pending email for ${row.email}`}
                          title={!canManageSchedules ? 'Manager or Owner access required' : canCancel ? 'Cancel next pending email only' : 'Only pending emails can be canceled'}
                        >
                          {rowBusy && busyRow?.action === 'cancel' ? (
                            <span className="text-xs">...</span>
                          ) : (
                            <>
                              <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                              Cancel next
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void removeSchedule(row.id)}
                          disabled={!canManageSchedules || busyRow !== null}
                          aria-label={`Delete schedule for ${row.email}`}
                          title={!canManageSchedules ? 'Manager or Owner access required' : 'Delete schedule'}
                        >
                          {rowBusy && busyRow?.action === 'delete' ? <span className="text-xs">...</span> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
      {selectedRow ? (
        <ScheduleHistoryDrawer
          row={selectedRow}
          runs={historyRuns}
          loading={historyLoading}
          error={historyError}
          onClose={() => setSelectedScheduleId(null)}
        />
      ) : null}
      {pendingSendRow ? (
        <SendNowConfirmationDialog
          row={pendingSendRow}
          busy={busyRow?.id === pendingSendRow.id && busyRow.action === 'send'}
          onConfirm={() => void confirmSendNow()}
          onCancel={() => setPendingSendRow(null)}
        />
      ) : null}
    </Card>
  );
}
