'use client';

import React, { createContext, useContext, useLayoutEffect, useMemo } from 'react';

import { useLiveJobs, useLiveCalls, useLiveChats, useLiveDispatchQueue, useLiveEscalations, useLiveNotifications } from '@/hooks/use-dashboard-live';
import { warmAllLiveDashboardData, prefetchDashboardRoute } from '@/lib/dashboard-cache';
import { useSession } from '@/shared/session-context';

interface DashboardDataContextValue {
  readonly prefetchRoute: (href: string, priority?: 'high' | 'normal') => void;
}

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

/** Keep live resources subscribed at the layout level so tab switches never cold-start. */
function DashboardWarmSubscriptions(): null {
  useLiveJobs();
  useLiveEscalations();
  useLiveCalls();
  useLiveChats();
  useLiveNotifications();
  useLiveDispatchQueue();
  return null;
}

export function DashboardDataProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { session } = useSession();

  useLayoutEffect(() => {
    warmAllLiveDashboardData(session);
  }, [session]);

  const value = useMemo<DashboardDataContextValue>(
    () => ({
      prefetchRoute: (href: string, priority: 'high' | 'normal' = 'normal') =>
        prefetchDashboardRoute(href, session, priority),
    }),
    [session],
  );

  return (
    <DashboardDataContext.Provider value={value}>
      <DashboardWarmSubscriptions />
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardPrefetch(): DashboardDataContextValue {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error('useDashboardPrefetch must be used within DashboardDataProvider');
  }
  return ctx;
}
