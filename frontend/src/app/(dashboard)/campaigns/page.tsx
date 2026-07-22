import type { Metadata } from 'next';

import { CampaignsClient } from './campaigns-client';

export const metadata: Metadata = { title: 'Campaigns' };

/** Spec §14.2 — GROWTH section. Not an agent tab; does not use the §2.6 template. */
export default function Page() {
  return <CampaignsClient />;
}
