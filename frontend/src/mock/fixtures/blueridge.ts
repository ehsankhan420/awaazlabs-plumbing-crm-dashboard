/**
 * BLUERIDGE PLUMBING CO. — the primary demo fixture. Multi-location, revenue card on,
 * one unhealthy SMS line (feeds the attention banner), two live calls.
 */

import { BLUERIDGE_PLUMBING } from '@/mock/orgs';
import type { Member, OrgFixture, PhoneLine } from '@/mock/schema';
import { daysAgo, hoursAgo, minutesAgo } from './helpers';
import { generateOrgFixture } from './generate';

const MEMBERS: readonly Member[] = [
  { id: 'mem_br_1', email: 'owner@blueridgeplumbing.example', name: 'Pat Callahan', role: 'OWNER_ADMIN', lastActiveUtc: minutesAgo(12), mfaEnabled: true },
  { id: 'mem_br_2', email: 'ops@blueridgeplumbing.example', name: 'Dana Whitfield', role: 'MANAGER', lastActiveUtc: hoursAgo(1), mfaEnabled: true },
  { id: 'mem_br_3', email: 'dispatch@blueridgeplumbing.example', name: 'Marcus Reed', role: 'DISPATCHER', lastActiveUtc: minutesAgo(4), mfaEnabled: true },
  { id: 'mem_br_4', email: 'frontdesk@blueridgeplumbing.example', name: 'Iris Molina', role: 'DISPATCHER', lastActiveUtc: hoursAgo(3), mfaEnabled: false },
  { id: 'mem_br_5', email: 'books@blueridgeplumbing.example', name: 'Terry Voss', role: 'VIEWER', lastActiveUtc: daysAgo(2), mfaEnabled: false },
];

const LINES: readonly PhoneLine[] = [
  { id: 'line_br_1', number: '+13125550100', kind: 'voice', locationId: 'loc_central', healthy: true, lastCheckedUtc: minutesAgo(5) },
  { id: 'line_br_2', number: '+13125550101', kind: 'sms', locationId: 'loc_central', healthy: false, lastCheckedUtc: minutesAgo(5) },
  { id: 'line_br_3', number: '+13125550102', kind: 'whatsapp', locationId: 'loc_central', healthy: true, lastCheckedUtc: minutesAgo(5) },
  { id: 'line_br_4', number: '+13125550110', kind: 'voice', locationId: 'loc_north', healthy: true, lastCheckedUtc: minutesAgo(6) },
  { id: 'line_br_5', number: '+13125550111', kind: 'sms', locationId: 'loc_north', healthy: true, lastCheckedUtc: minutesAgo(6) },
  { id: 'line_br_6', number: '+13125550120', kind: 'voice', locationId: 'loc_lakeside', healthy: true, lastCheckedUtc: minutesAgo(7) },
];

export const BLUERIDGE_FIXTURE: OrgFixture = generateOrgFixture({
  org: BLUERIDGE_PLUMBING,
  seed: 20260709,
  tag: 'br',
  jobsPerDay: 6,
  historyDays: 60,
  plumberCount: 10,
  members: MEMBERS,
  lines: LINES,
  invoices: [
    { id: 'inv_br_3', periodLabel: 'June 2026', amountUsd: 2140, status: 'due', downloadUrl: '#' },
    { id: 'inv_br_2', periodLabel: 'May 2026', amountUsd: 1985, status: 'paid', downloadUrl: '#' },
    { id: 'inv_br_1', periodLabel: 'April 2026', amountUsd: 1870, status: 'paid', downloadUrl: '#' },
  ],
  minutesConsumed: 7480,
  chatSessionsConsumed: 2310,
  liveCallCount: 2,
});
