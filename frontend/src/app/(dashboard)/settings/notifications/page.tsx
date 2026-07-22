import type { Metadata } from 'next';

import { NotificationsClient } from './notifications-client';

export const metadata: Metadata = { title: 'Notifications' };

/** Spec §16.6. Milestone 2. */
export default function Page() {
  return <NotificationsClient />;
}
