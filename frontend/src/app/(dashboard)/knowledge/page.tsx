import type { Metadata } from 'next';

import { KnowledgeClient } from './knowledge-client';

export const metadata: Metadata = { title: 'Agent Knowledge' };

/** Spec §15. Read-only knowledge view with a controlled change-request workflow. */
export default function Page() {
  return <KnowledgeClient />;
}
