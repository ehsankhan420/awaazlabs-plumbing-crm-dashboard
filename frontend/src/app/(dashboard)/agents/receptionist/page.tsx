import type { Metadata } from 'next';

import { ReceptionistClient } from './receptionist-client';

export const metadata: Metadata = { title: 'Receptionist' };

/** Spec §6 — inbound voice agent analytics, rendered through the §2.6 template. */
export default function ReceptionistPage() {
  return <ReceptionistClient />;
}
