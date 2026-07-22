import type { Metadata } from 'next';

import { LinesClient } from './lines-client';

export const metadata: Metadata = { title: 'Lines and Numbers' };

/** Spec §16.5. Milestone 2. */
export default function Page() {
  return <LinesClient />;
}
