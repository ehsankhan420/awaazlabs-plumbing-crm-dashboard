/**
 * MOCK ORGANIZATIONS — Plumbing Automation Dashboard.
 *
 * FROZEN FILE (Foundation).
 *
 * Two mock organizations: one multi-location, one single-location, to prove the location
 * filter behavior both ways. Single-location businesses see no filter.
 */

import type { BusinessHours, MockLocation, MockOrganization, ServiceArea } from './schema';

/** Mon–Fri 07:00–19:00, Sat 08:00–14:00. Minutes from midnight, local to the location. */
const STANDARD_HOURS: readonly BusinessHours[] = [
  { day: 1, openMinute: 7 * 60, closeMinute: 19 * 60 },
  { day: 2, openMinute: 7 * 60, closeMinute: 19 * 60 },
  { day: 3, openMinute: 7 * 60, closeMinute: 19 * 60 },
  { day: 4, openMinute: 7 * 60, closeMinute: 19 * 60 },
  { day: 5, openMinute: 7 * 60, closeMinute: 19 * 60 },
  { day: 6, openMinute: 8 * 60, closeMinute: 14 * 60 },
];

const US_HOLIDAYS_2026: readonly string[] = [
  '2026-01-01',
  '2026-05-25',
  '2026-07-03',
  '2026-09-07',
  '2026-11-26',
  '2026-12-25',
];

/* ----------------------------------------------------------------------------------
 * Org 1 — BlueRidge Plumbing Co. Multi-location (3).
 * The primary demo org: exercises the location filter, the revenue estimate card, and
 * the multi-location review comparison.
 * -------------------------------------------------------------------------------- */

export const BLUERIDGE_LOCATIONS: readonly MockLocation[] = [
  {
    id: 'loc_central',
    name: 'BlueRidge — Central',
    timezone: 'America/Chicago',
    businessHours: STANDARD_HOURS,
    holidays: US_HOLIDAYS_2026,
    // Two-party consent state. Drives the consent disclosure event on call records.
    recordingConsentMode: 'two_party',
    escalationForwardingNumber: '+13125550188',
  },
  {
    id: 'loc_north',
    name: 'BlueRidge — North County',
    timezone: 'America/Chicago',
    businessHours: STANDARD_HOURS,
    holidays: US_HOLIDAYS_2026,
    recordingConsentMode: 'one_party',
    escalationForwardingNumber: '+13125550199',
  },
  {
    id: 'loc_lakeside',
    name: 'BlueRidge — Lakeside',
    timezone: 'America/Chicago',
    businessHours: STANDARD_HOURS,
    holidays: US_HOLIDAYS_2026,
    recordingConsentMode: 'one_party',
    escalationForwardingNumber: '+13125550132',
  },
];

export const BLUERIDGE_SERVICE_AREAS: readonly ServiceArea[] = [
  { id: 'area_downtown', name: 'Downtown', zips: ['60601', '60602', '60603', '60605'] },
  { id: 'area_north', name: 'North County', zips: ['60614', '60618', '60625', '60640'] },
  { id: 'area_lakeside', name: 'Lakeside', zips: ['60649', '60653', '60615'] },
  { id: 'area_west', name: 'West Suburbs', zips: ['60302', '60304', '60513'] },
];

export const BLUERIDGE_PLUMBING: MockOrganization = {
  id: 'org_blueridge',
  name: 'BlueRidge Plumbing Co.',
  locations: BLUERIDGE_LOCATIONS,
  serviceAreas: BLUERIDGE_SERVICE_AREAS,
  // Set, so the Revenue Influenced estimate card renders (§5.1).
  avgJobValueUsd: 410,
  planMinutes: 12000,
  planChatSessions: 4000,
};

/* ----------------------------------------------------------------------------------
 * Org 2 — Harbor Plumbing Works. Single-location.
 *
 * Deliberately configured to prove degradation paths the spec requires:
 *   - location filter is hidden entirely (one location)
 *   - Revenue Influenced card hides (avgJobValueUsd = null, §5.1)
 *   - usage sits at ≥90% of plan, feeding the attention banner
 * -------------------------------------------------------------------------------- */

export const HARBOR_LOCATIONS: readonly MockLocation[] = [
  {
    id: 'loc_harbor',
    name: 'Harbor Plumbing Works',
    timezone: 'America/Los_Angeles',
    businessHours: STANDARD_HOURS,
    holidays: US_HOLIDAYS_2026,
    recordingConsentMode: 'one_party',
    escalationForwardingNumber: '+14155550170',
  },
];

export const HARBOR_SERVICE_AREAS: readonly ServiceArea[] = [
  { id: 'area_harbor_city', name: 'Harbor City', zips: ['94107', '94110', '94112'] },
  { id: 'area_harbor_east', name: 'East Bay', zips: ['94601', '94605'] },
];

export const HARBOR_PLUMBING: MockOrganization = {
  id: 'org_harbor',
  name: 'Harbor Plumbing Works',
  locations: HARBOR_LOCATIONS,
  serviceAreas: HARBOR_SERVICE_AREAS,
  avgJobValueUsd: null,
  planMinutes: 2500,
  planChatSessions: 500,
};

export const ALL_ORGS: readonly MockOrganization[] = [BLUERIDGE_PLUMBING, HARBOR_PLUMBING];

export const DEFAULT_ORG_ID = BLUERIDGE_PLUMBING.id;

export function getOrgById(orgId: string): MockOrganization | undefined {
  return ALL_ORGS.find((o) => o.id === orgId);
}

export function getLocationById(orgId: string, locationId: string): MockLocation | undefined {
  return getOrgById(orgId)?.locations.find((l) => l.id === locationId);
}

export function getServiceAreaById(orgId: string, areaId: string): ServiceArea | undefined {
  return getOrgById(orgId)?.serviceAreas.find((a) => a.id === areaId);
}

/**
 * The "now" the entire mock dataset is anchored to.
 *
 * Every fixture timestamp is expressed relative to this instant, so "created today",
 * "aging past threshold", and "trailing 30 days" are stable and reproducible instead of
 * drifting with the wall clock.
 */
export const MOCK_NOW_UTC = '2026-07-09T15:20:00.000Z';

export function mockNow(): Date {
  return new Date(MOCK_NOW_UTC);
}
