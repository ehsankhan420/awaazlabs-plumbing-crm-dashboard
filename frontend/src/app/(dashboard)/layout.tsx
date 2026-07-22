import React from 'react';

import { DashboardDataProvider } from '@/shared/dashboard-data-context';
import { SessionProvider } from '@/shared/session-context';
import { DashboardShell } from '../dashboard-shell/DashboardShell';

/**
 * Layout for every authenticated dashboard route.
 *
 * `(dashboard)` is a route group: it adds no URL segment, so `/jobs` is still
 * `/jobs`. Its only job is to separate the routes that render inside the shell
 * from `/sign-in`, which must not.
 *
 * Access is enforced in `src/middleware.ts` before this ever renders. This layout does not
 * re-check auth — a second, weaker check here would invite someone to "simplify" the
 * middleware away later.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <SessionProvider>
      <DashboardDataProvider>
        <DashboardShell>{children}</DashboardShell>
      </DashboardDataProvider>
    </SessionProvider>
  );
}
