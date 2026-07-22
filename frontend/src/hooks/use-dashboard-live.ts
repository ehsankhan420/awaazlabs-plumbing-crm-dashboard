'use client';

import { useCallback, useSyncExternalStore } from 'react';

import {
  getDashboardResourceSnapshot,
  invalidateDashboardResource,
  prefetchDashboardResource,
  subscribeDashboardResource,
  type DashboardResource,
  type DashboardResourceData,
} from '@/lib/dashboard-cache';
import { useSession } from '@/shared/session-context';

interface UseDashboardResourceResult<R extends DashboardResource> {
  readonly data: DashboardResourceData[R] | null;
  readonly error: string | null;
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly refresh: () => void;
  readonly invalidate: () => void;
}

function useDashboardResource<R extends DashboardResource>(resource: R): UseDashboardResourceResult<R> {
  const { session } = useSession();

  const subscribe = useCallback(
    (onStoreChange: () => void) => subscribeDashboardResource(resource, session, onStoreChange),
    [resource, session],
  );

  const getSnapshot = useCallback(
    () => getDashboardResourceSnapshot(resource, session),
    [resource, session],
  );

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const refresh = useCallback(() => {
    prefetchDashboardResource(resource, session);
  }, [resource, session]);

  const invalidate = useCallback(() => {
    invalidateDashboardResource(resource, session);
  }, [resource, session]);

  return {
    data: snapshot.data,
    error: snapshot.error,
    isLoading: snapshot.isLoading,
    isRefreshing: snapshot.isRefreshing,
    refresh,
    invalidate,
  };
}

export function useLiveJobs() {
  return useDashboardResource('jobs');
}

export function useLiveEscalations() {
  return useDashboardResource('escalations');
}

export function useLiveCalls() {
  return useDashboardResource('calls');
}

export function useLiveChats() {
  return useDashboardResource('chats');
}

export function useLiveNotifications() {
  return useDashboardResource('notifications');
}

export function useLiveDispatchQueue() {
  return useDashboardResource('dispatch_queue');
}

export function useLiveTelemetry() {
  return useDashboardResource('telemetry_stats');
}

export function useLiveRevenue() {
  return useDashboardResource('revenue_stats');
}

export function useLiveQuality() {
  return useDashboardResource('quality_stats');
}

export function useLiveReceptionist() {
  return useDashboardResource('receptionist_stats');
}

export function useLiveDispatchAgent() {
  return useDashboardResource('dispatch_agent_stats');
}
