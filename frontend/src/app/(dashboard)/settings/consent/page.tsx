import type { Metadata } from 'next';

import { ConsentClient } from './consent-client';

export const metadata: Metadata = { title: 'Consent and Do-Not-Call' };

/** Spec §16.5. Milestone 2. */
export default function Page() {
  return <ConsentClient />;
}
