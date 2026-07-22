/**
 * FIXTURE REGISTRY — the single entry point the data-access layer reads.
 *
 * Keyed by organization id so `getFixture(orgId)` resolves the whole bundle. Nothing here
 * fetches or computes; the fixtures are deterministic and anchored to MOCK_NOW_UTC.
 */

import type { OrgFixture } from '@/mock/schema';
import { BLUERIDGE_FIXTURE } from './blueridge';
import { HARBOR_FIXTURE } from './harbor';

export const FIXTURES: Readonly<Record<string, OrgFixture>> = {
  [BLUERIDGE_FIXTURE.org.id]: BLUERIDGE_FIXTURE,
  [HARBOR_FIXTURE.org.id]: HARBOR_FIXTURE,
};

export function getFixture(orgId: string): OrgFixture {
  const fixture = FIXTURES[orgId];
  if (!fixture) {
    throw new Error(`No fixture registered for organization "${orgId}".`);
  }
  return fixture;
}

export { BLUERIDGE_FIXTURE } from './blueridge';
export { HARBOR_FIXTURE } from './harbor';
