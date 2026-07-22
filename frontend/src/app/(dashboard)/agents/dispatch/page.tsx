import type { Metadata } from 'next';

import { DispatchAgentClient } from './dispatch-agent-client';

export const metadata: Metadata = { title: 'Plumber Dispatch Agent' };

/** Spec §5.7. */
export default function DispatchAgentPage() {
  return <DispatchAgentClient />;
}
