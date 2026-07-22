'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Download, FileDown, Lock, Mail, Send, SlidersHorizontal } from 'lucide-react';

import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { useSession } from '@/shared/session-context';

import { generateReportCsv, ReportApiError, sendReportEmail } from './report-api';
import {
  isEnabledReportAgent,
  isRawReportSection,
  RECEPTIONIST_REPORT_SECTIONS,
  type GenerateReportRequest,
  type ReceptionistReportSection,
  type ReportAgent,
} from './report-contract';
import { enabledReceptionistSections, ReportSectionPicker } from './report-section-picker';

type AgentOption = {
  readonly value: ReportAgent;
  readonly label: string;
  readonly disabled?: boolean;
};

type DatePreset = 'last_7_days' | 'last_30_days' | 'month_to_date' | 'custom';

const AGENT_OPTIONS: readonly AgentOption[] = [
  { value: 'receptionist', label: 'AI Receptionist' },
  { value: 'dispatch', label: 'Plumber Dispatch Agent - Coming soon', disabled: true },
  { value: 'chat', label: 'Chat Agents - Coming soon', disabled: true },
  { value: 'review_taker', label: 'Review Taker - Coming soon', disabled: true },
  { value: 'reengagement', label: 'Reengagement - Coming soon', disabled: true },
  { value: 'post_service_followup', label: 'Post-Service Follow-Up - Coming soon', disabled: true },
];

const DATE_PRESETS: readonly { value: DatePreset; label: string }[] = [
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'month_to_date', label: 'Month to date' },
  { value: 'custom', label: 'Custom' },
];

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function firstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function emailLooksValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatYmd(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(year, month - 1, day));
}

function rangeForPreset(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'last_7_days') return { from: toYmd(addDays(today, -6)), to: toYmd(today) };
  if (preset === 'last_30_days') return { from: toYmd(addDays(today, -29)), to: toYmd(today) };
  if (preset === 'month_to_date') return { from: toYmd(firstDayOfMonth(today)), to: toYmd(today) };
  return { from: toYmd(addDays(today, -29)), to: toYmd(today) };
}

export function GenerateReport(): React.JSX.Element {
  const { session } = useSession();
  const [agent, setAgent] = useState<ReportAgent | null>(null);
  const [preset, setPreset] = useState<DatePreset>('last_30_days');
  const initialRange = useMemo(() => rangeForPreset('last_30_days'), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [sections, setSections] = useState<ReadonlySet<ReceptionistReportSection>>(
    () => new Set(RECEPTIONIST_REPORT_SECTIONS),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [sectionsOpen, setSectionsOpen] = useState(false);

  const hideRawSections = false;
  const selectedSections = useMemo(
    () =>
      RECEPTIONIST_REPORT_SECTIONS.filter(
        (section) => sections.has(section) && !(hideRawSections && isRawReportSection(section)),
      ),
    [sections, hideRawSections],
  );
  const activeSelectedCount = selectedSections.length;
  const invalidDateRange = from.length > 0 && to.length > 0 && from > to;
  const canGenerate = agent !== null && isEnabledReportAgent(agent) && activeSelectedCount > 0 && !invalidDateRange;
  const canDownload = canGenerate && !isDownloading;
  const canSendEmail = canGenerate && emailLooksValid(email.trim()) && !isSendingEmail;

  const selectedAgent = agent === null ? null : AGENT_OPTIONS.find((option) => option.value === agent) ?? null;
  const reportPreview = agent === 'receptionist'
    ? `AI Receptionist report, ${formatYmd(from)} to ${formatYmd(to)}, ${activeSelectedCount} field${activeSelectedCount === 1 ? '' : 's'}, CSV`
    : `Select an agent, ${formatYmd(from)} to ${formatYmd(to)}, ${activeSelectedCount} field${activeSelectedCount === 1 ? '' : 's'}, CSV`;
  const requestPayload = useMemo<GenerateReportRequest | null>(
    () => agent === null ? null : ({
        action: 'generate_report',
        agent,
        from,
        to,
        sections: selectedSections,
        format: 'csv',
      }),
    [agent, from, to, selectedSections],
  );

  useEffect(() => {
    const saved = window.localStorage.getItem('plumbing:last-report-email');
    if (saved && emailLooksValid(saved)) setEmail(saved);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function updatePreset(value: string): void {
    const nextPreset = value as DatePreset;
    setPreset(nextPreset);
    if (nextPreset !== 'custom') {
      const next = rangeForPreset(nextPreset);
      setFrom(next.from);
      setTo(next.to);
    }
    setNotice(null);
    setError(null);
  }

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

  async function handleDownload(): Promise<void> {
    if (requestPayload === null) {
      setNotice(null);
      setError('Select an agent before downloading a report.');
      return;
    }
    setNotice(null);
    setError(null);
    setIsDownloading(true);
    try {
      await generateReportCsv(session, requestPayload);
      setNotice('Report downloaded successfully.');
    } catch (e) {
      setError(e instanceof ReportApiError ? e.message : 'We could not generate this report. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleSendEmail(): Promise<void> {
    if (requestPayload === null) {
      setNotice(null);
      setError('Select an agent before sending a report.');
      return;
    }
    const recipient = email.trim();
    if (!emailLooksValid(recipient)) {
      setNotice(null);
      setError('Enter a valid email address before sending the report.');
      return;
    }
    setNotice(null);
    setError(null);
    setIsSendingEmail(true);
    try {
      await sendReportEmail(session, requestPayload, recipient);
      window.localStorage.setItem('plumbing:last-report-email', recipient);
      setEmail('');
      setNotice(`Report sent to ${recipient}.`);
    } catch (e) {
      setError(e instanceof ReportApiError ? e.message : 'We could not send this report. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="flex items-center gap-2">
          <FileDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Generate report
        </CardTitle>
        <CardDescription>
          Build an on-demand report for the selected agent and date range. The AI Receptionist is
          the first functional report surface; CSV exports are generated from dashboard data.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {notice ? (
          <div className="fixed right-5 top-5 z-50 flex max-w-sm items-center gap-3 rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground shadow-lg" role="status">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="font-medium">CSV is ready</p>
              <p className="text-xs text-muted-foreground">{notice}</p>
            </div>
          </div>
        ) : null}

        {hideRawSections ? (
          <Banner variant="default" title="restricted mode">
            Raw call and job rows are unavailable in restricted mode. Aggregate report
            sections remain available.
          </Banner>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(240px,0.78fr)_minmax(0,1.22fr)] lg:items-start">
          <label className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Agent
            </span>
            <span className="text-xs font-medium text-transparent select-none">Agent</span>
            <Select
              value={agent ?? undefined}
              onValueChange={(value) => {
                setAgent(value as ReportAgent);
                setNotice(null);
                setError(null);
              }}
              options={AGENT_OPTIONS}
              placeholder="Select an agent"
              aria-label="Report agent"
              className="w-full"
            />
            <span className="text-xs text-muted-foreground">
              {selectedAgent === null
                ? 'Choose an agent to enable report generation.'
                : selectedAgent.disabled
                ? 'This agent report layout is reserved for a later phase.'
                : 'AI Receptionist is enabled for CSV report generation.'}
            </span>
          </label>

          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Date range
            </span>
            <div className="grid gap-4 md:grid-cols-[minmax(220px,0.72fr)_minmax(0,1fr)]">
              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-xs font-medium text-transparent select-none">Preset</span>
                <Select
                  value={preset}
                  onValueChange={updatePreset}
                  options={DATE_PRESETS}
                  aria-label="Report date range preset"
                  className="w-full"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex min-w-0 flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">From</span>
                  <input
                    type="date"
                    value={from}
                    onChange={(event) => {
                      setPreset('custom');
                      setFrom(event.target.value);
                      setNotice(null);
                      setError(null);
                    }}
                    className="min-h-9 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground"
                    aria-label="Report start date"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">To</span>
                  <input
                    type="date"
                    value={to}
                    onChange={(event) => {
                      setPreset('custom');
                      setTo(event.target.value);
                      setNotice(null);
                      setError(null);
                    }}
                    className="min-h-9 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground"
                    aria-label="Report end date"
                  />
                </label>
              </div>
            </div>
            {invalidDateRange ? (
              <p className="text-sm text-destructive" role="alert">
                The start date must be on or before the end date.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Presets update both dates. Editing either date switches the range to Custom.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/20 px-4 py-3">
          <p className="text-sm font-medium text-foreground">Report preview</p>
          <p className="mt-1 text-sm text-muted-foreground">{reportPreview}</p>
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
            Select AI Receptionist to choose report sections.
          </div>
        )}

        {error ? (
          <Banner variant="destructive" title="Export failed" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        ) : null}

        <div className="flex flex-col gap-4 border-t border-border pt-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>AI Receptionist CSV exports and emailed reports are audited.</span>
          </div>
          <div className="grid w-full gap-3 xl:w-auto xl:grid-cols-[minmax(260px,340px)_auto_auto] xl:items-end">
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Email report to
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setNotice(null);
                  setError(null);
                }}
                placeholder="name@example.com"
                className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                aria-label="Report email recipient"
              />
            </label>
            <Button
              onClick={handleSendEmail}
              disabled={!canSendEmail}
              variant="secondary"
              aria-label="Send selected Receptionist report sections by email"
              className="w-full xl:w-auto"
            >
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              {isSendingEmail ? 'Sending...' : 'Send via email'}
            </Button>
            <Button
              onClick={handleDownload}
              disabled={!canDownload}
              aria-label="Download selected Receptionist report sections as CSV"
              className="w-full xl:w-auto"
            >
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              {isDownloading ? 'Preparing...' : 'Download CSV'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
