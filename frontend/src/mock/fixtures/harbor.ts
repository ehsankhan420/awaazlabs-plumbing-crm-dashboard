/**
 * HARBOR PLUMBING WORKS — the single-location fixture. Proves the degradation paths:
 * no location filter, no Revenue Influenced card (avgJobValueUsd = null), and usage at
 * ≥90% of plan minutes so the Overview attention banner's usage item renders.
 */

import { HARBOR_PLUMBING } from '@/mock/orgs';
import type { Member, OrgFixture, PhoneLine } from '@/mock/schema';
import { daysAgo, hoursAgo, minutesAgo } from './helpers';
import { generateOrgFixture } from './generate';

const MEMBERS: readonly Member[] = [
  { id: 'mem_hb_1', email: 'owner@harborplumbing.example', name: 'Sal Marino', role: 'OWNER_ADMIN', lastActiveUtc: minutesAgo(30), mfaEnabled: true },
  { id: 'mem_hb_2', email: 'office@harborplumbing.example', name: 'June Park', role: 'DISPATCHER', lastActiveUtc: hoursAgo(2), mfaEnabled: false },
  { id: 'mem_hb_3', email: 'audit@harborplumbing.example', name: 'Lee Trent', role: 'VIEWER', lastActiveUtc: daysAgo(5), mfaEnabled: false },
];

const LINES: readonly PhoneLine[] = [
  { id: 'line_hb_1', number: '+14155550140', kind: 'voice', locationId: 'loc_harbor', healthy: true, lastCheckedUtc: minutesAgo(9) },
  { id: 'line_hb_2', number: '+14155550141', kind: 'sms', locationId: 'loc_harbor', healthy: true, lastCheckedUtc: minutesAgo(9) },
];

export const HARBOR_FIXTURE: OrgFixture = generateOrgFixture({
  org: HARBOR_PLUMBING,
  seed: 8891234,
  tag: 'hb',
  jobsPerDay: 2,
  historyDays: 45,
  plumberCount: 5,
  members: MEMBERS,
  lines: LINES,
  invoices: [
    { id: 'inv_hb_2', periodLabel: 'June 2026', amountUsd: 640, status: 'due', downloadUrl: '#' },
    { id: 'inv_hb_1', periodLabel: 'May 2026', amountUsd: 590, status: 'paid', downloadUrl: '#' },
  ],
  // 2310 / 2500 plan minutes = 92% — at or above the 90% banner threshold.
  minutesConsumed: 2310,
  chatSessionsConsumed: 410,
  liveCallCount: 1,
});
