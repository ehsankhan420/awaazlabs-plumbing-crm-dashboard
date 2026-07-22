export const REPORT_AGENTS = [
  'receptionist',
  'dispatch',
  'chat',
  'review_taker',
  'reengagement',
  'post_service_followup',
] as const;

export type ReportAgent = (typeof REPORT_AGENTS)[number];

export const ENABLED_REPORT_AGENTS = ['receptionist'] as const satisfies readonly ReportAgent[];

export const REPORT_FORMATS = ['csv'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const RECEPTIONIST_REPORT_SECTIONS = [
  'summary_kpis',
  'jobs_created',
  'job_creation_rate_trend',
  'call_outcomes',
  'priority',
  'intake_channel',
  'language_mix',
  'after_hours',
  'missed_abandoned',
  'raw_calls',
  'raw_jobs',
] as const;

export type ReceptionistReportSection = (typeof RECEPTIONIST_REPORT_SECTIONS)[number];
export type ReportSection = ReceptionistReportSection;

export const RAW_REPORT_SECTIONS = ['raw_calls', 'raw_jobs'] as const satisfies readonly ReportSection[];

export interface GenerateReportRequest {
  readonly action: 'generate_report';
  readonly agent: ReportAgent;
  readonly from: string;
  readonly to: string;
  readonly sections: readonly ReportSection[];
  readonly format: ReportFormat;
}

export interface ReportSectionDefinition {
  readonly key: ReportSection;
  readonly label: string;
  readonly description: string;
}

export const RECEPTIONIST_REPORT_SECTION_DEFINITIONS: readonly ReportSectionDefinition[] = [
  {
    key: 'summary_kpis',
    label: 'Summary KPIs',
    description: 'Inbound calls handled, jobs created, job creation rate, and key AI Receptionist outcomes.',
  },
  {
    key: 'jobs_created',
    label: 'Jobs created',
    description: 'AI Receptionist-created job volume in the selected date range.',
  },
  {
    key: 'job_creation_rate_trend',
    label: 'Job creation rate trend',
    description: 'Daily jobs created divided by completed inbound AI Receptionist calls.',
  },
  {
    key: 'call_outcomes',
    label: 'Call outcomes',
    description: 'Job created, information provided, human transfer, emergency escalation, and out of area outcomes.',
  },
  {
    key: 'priority',
    label: 'Priority mix',
    description: 'Routine, Urgent, and Emergency priority distribution for AI Receptionist calls.',
  },
  {
    key: 'intake_channel',
    label: 'Intake channel',
    description: 'Voice, Web Chat, SMS, WhatsApp, and Staff Entry mix for created jobs.',
  },
  {
    key: 'language_mix',
    label: 'Language mix',
    description: 'English, Spanish, and other language distribution for created jobs.',
  },
  {
    key: 'after_hours',
    label: 'After-hours jobs',
    description: 'Jobs captured outside configured business hours.',
  },
  {
    key: 'missed_abandoned',
    label: 'Missed & abandoned inbound',
    description: 'Inbound legs that ended before the AI Receptionist agent connected.',
  },
  {
    key: 'raw_calls',
    label: 'Raw call log',
    description: 'Detail rows for AI Receptionist calls. Phone numbers export masked only.',
  },
  {
    key: 'raw_jobs',
    label: 'Raw job list',
    description: 'Detail rows for AI Receptionist jobs. Phone numbers export masked only.',
  },
];

export function isEnabledReportAgent(agent: ReportAgent): boolean {
  return (ENABLED_REPORT_AGENTS as readonly string[]).includes(agent);
}

export function isRawReportSection(section: ReportSection): boolean {
  return (RAW_REPORT_SECTIONS as readonly string[]).includes(section);
}
