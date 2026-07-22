import type { Metadata } from 'next';

import { QualityClient } from './quality-client';

export const metadata: Metadata = { title: 'Quality and Optimization' };

/** Spec §12 — the Quality loop. Milestone 1. */
export default function Page() {
  return <QualityClient />;
}
