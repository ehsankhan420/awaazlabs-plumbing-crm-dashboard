import type { Session } from '@/mock/data-access';
import {
  fetchLiveJobs,
  fetchLiveCalls,
  fetchLiveChats,
  fetchLiveDispatchAgentStats,
  fetchLiveDispatchQueue,
  fetchLiveEscalations,
  fetchLiveNotifications,
  fetchLiveQuality,
  fetchLiveReceptionistStats,
  fetchLiveRevenue,
  fetchLiveTelemetry,
  type DispatchAgentStatsDto,
  type LiveCallsSnapshot,
  type LiveChatsSnapshot,
  type LiveDispatchQueueSnapshot,
  type LiveEscalationsSnapshot,
  type LiveJobsSnapshot,
  type LiveNotificationCounts,
  type QualityStatsDto,
  type ReceptionistStatsDto,
  type RevenueStatsDto,
  type TelemetryStatsDto,
} from '@/lib/dashboard-live';

export const LIVE_REFRESH_MS = 5000;
export const LIVE_CALLS_REFRESH_MS = 1500;
/** Allow all live resources to warm in parallel so tab switches hit cache immediately. */
const MAX_CONCURRENT_FETCHES = 6;

export type DashboardResource =
  | 'jobs'
  | 'escalations'
  | 'calls'
  | 'chats'
  | 'notifications'
  | 'dispatch_queue'
  | 'telemetry_stats'
  | 'revenue_stats'
  | 'quality_stats'
  | 'receptionist_stats'
  | 'dispatch_agent_stats';

export type DashboardResourceData = {
  jobs: LiveJobsSnapshot;
  escalations: LiveEscalationsSnapshot;
  calls: LiveCallsSnapshot;
  chats: LiveChatsSnapshot;
  notifications: LiveNotificationCounts;
  dispatch_queue: LiveDispatchQueueSnapshot;
  telemetry_stats: TelemetryStatsDto;
  revenue_stats: RevenueStatsDto;
  quality_stats: QualityStatsDto;
  receptionist_stats: ReceptionistStatsDto;
  dispatch_agent_stats: DispatchAgentStatsDto;
};

interface CacheEntry<T> {
  data: T | null;
  error: string | null;
  fetchedAt: number;
  inflight: Promise<void> | null;
  snapshot: CacheSnapshot<T>;
}

interface CacheSnapshot<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  fetchedAt: number;
}

const EMPTY_SNAPSHOT: CacheSnapshot<never> = {
  data: null,
  error: null,
  isLoading: false,
  isRefreshing: false,
  fetchedAt: 0,
};

const entries = new Map<string, CacheEntry<unknown>>();
const listeners = new Map<string, Set<() => void>>();
const subscriberCounts = new Map<string, number>();
const warmResources = new Set<string>();

let pollTimer: ReturnType<typeof setInterval> | null = null;
let callsPollTimer: ReturnType<typeof setInterval> | null = null;
let pollSession: Session | null = null;
let pollResources: DashboardResource[] = [];

let activeFetches = 0;
const fetchQueue: Array<() => void> = [];

function sessionKey(session: Session): string {
  return `${session.orgId}|${session.locationId ?? ''}|${session.role}`;
}

function cacheKey(resource: DashboardResource, session: Session): string {
  return `${resource}:${sessionKey(session)}`;
}

function createSnapshot<T>(entry: CacheEntry<T>): CacheSnapshot<T> {
  return {
    data: entry.data,
    error: entry.error,
    isLoading: entry.data === null && entry.error === null,
    isRefreshing: entry.data !== null && entry.inflight !== null,
    fetchedAt: entry.fetchedAt,
  };
}

function syncSnapshot<T>(entry: CacheEntry<T>): boolean {
  const next = createSnapshot(entry);
  const prev = entry.snapshot;
  if (
    prev.data === next.data &&
    prev.error === next.error &&
    prev.isLoading === next.isLoading &&
    prev.isRefreshing === next.isRefreshing &&
    prev.fetchedAt === next.fetchedAt
  ) {
    return false;
  }
  entry.snapshot = next;
  return true;
}

function getEntry<T>(key: string): CacheEntry<T> {
  let entry = entries.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    const base = { data: null, error: null, fetchedAt: 0, inflight: null } as CacheEntry<T>;
    base.snapshot = createSnapshot(base);
    entry = base;
    entries.set(key, entry);
  }
  return entry;
}

function snapshotFor<T>(key: string): CacheSnapshot<T> {
  const entry = entries.get(key) as CacheEntry<T> | undefined;
  if (!entry) return EMPTY_SNAPSHOT as CacheSnapshot<T>;
  syncSnapshot(entry);
  return entry.snapshot;
}

function notifyIfChanged(key: string): void {
  const entry = entries.get(key);
  if (!entry) return;
  if (!syncSnapshot(entry)) return;
  listeners.get(key)?.forEach((listener) => listener());
}

function runFetchQueue(): void {
  while (activeFetches < MAX_CONCURRENT_FETCHES && fetchQueue.length > 0) {
    const job = fetchQueue.shift();
    if (!job) return;
    activeFetches += 1;
    job();
  }
}

function enqueueFetch(job: () => Promise<void>, priority: 'high' | 'normal' = 'normal'): Promise<void> {
  return new Promise((resolve, reject) => {
    const wrapped = () => {
      void job()
        .then(resolve, reject)
        .finally(() => {
          activeFetches -= 1;
          runFetchQueue();
        });
    };
    if (priority === 'high') fetchQueue.unshift(wrapped);
    else fetchQueue.push(wrapped);
    runFetchQueue();
  });
}

function scheduleFetch(
  resource: DashboardResource,
  session: Session,
  force = false,
  priority: 'high' | 'normal' = 'normal',
): void {
  const key = cacheKey(resource, session);
  const entry = getEntry<unknown>(key);

  if (entry.inflight) return;
  if (!force && entry.data !== null) return;

  entry.inflight = enqueueFetch(async () => {
    try {
      let data: unknown;
      switch (resource) {
        case 'jobs':
          data = await fetchLiveJobs(session);
          break;
        case 'escalations':
          data = await fetchLiveEscalations(session);
          break;
        case 'calls':
          data = await fetchLiveCalls(session);
          break;
        case 'chats':
          data = await fetchLiveChats(session);
          break;
        case 'notifications':
          data = await fetchLiveNotifications(session);
          break;
        case 'dispatch_queue':
          data = await fetchLiveDispatchQueue(session);
          break;
        case 'telemetry_stats':
          data = await fetchLiveTelemetry(session);
          break;
        case 'revenue_stats':
          data = await fetchLiveRevenue(session);
          break;
        case 'quality_stats':
          data = await fetchLiveQuality(session);
          break;
        case 'receptionist_stats':
          data = await fetchLiveReceptionistStats(session);
          break;
        case 'dispatch_agent_stats':
          data = await fetchLiveDispatchAgentStats(session);
          break;
      }
      entry.data = data;
      entry.error = null;
      entry.fetchedAt = Date.now();
    } catch (error: unknown) {
      entry.error = error instanceof Error ? error.message : 'Request failed';
    } finally {
      entry.inflight = null;
      notifyIfChanged(key);
    }
  }, priority);

  notifyIfChanged(key);
}

export function subscribeDashboardResource<R extends DashboardResource>(
  resource: R,
  session: Session,
  onStoreChange: () => void,
): () => void {
  const key = cacheKey(resource, session);
  const set = listeners.get(key) ?? new Set();
  set.add(onStoreChange);
  listeners.set(key, set);

  subscriberCounts.set(key, (subscriberCounts.get(key) ?? 0) + 1);
  warmResources.add(key);
  ensurePolling(session);

  const entry = getEntry(key);
  if (entry.data === null && entry.inflight === null) {
    queueMicrotask(() => scheduleFetch(resource, session));
  }

  return () => {
    set.delete(onStoreChange);
    if (set.size === 0) listeners.delete(key);

    const next = (subscriberCounts.get(key) ?? 1) - 1;
    if (next <= 0) {
      subscriberCounts.delete(key);
    } else {
      subscriberCounts.set(key, next);
    }

    syncPollingTargets();
  };
}

export function getDashboardResourceSnapshot<R extends DashboardResource>(
  resource: R,
  session: Session,
): CacheSnapshot<DashboardResourceData[R]> {
  return snapshotFor<DashboardResourceData[R]>(cacheKey(resource, session));
}

export function prefetchDashboardResource(
  resource: DashboardResource,
  session: Session,
  priority: 'high' | 'normal' = 'normal',
): void {
  const key = cacheKey(resource, session);
  warmResources.add(key);
  ensurePolling(session);
  queueMicrotask(() => scheduleFetch(resource, session, false, priority));
}

export function invalidateDashboardResource(resource: DashboardResource, session: Session): void {
  queueMicrotask(() => scheduleFetch(resource, session, true, 'high'));
}

const ROUTE_RESOURCES: Partial<Record<string, readonly DashboardResource[]>> = {
  '/': ['jobs', 'calls', 'dispatch_queue', 'notifications', 'telemetry_stats', 'revenue_stats', 'quality_stats'],
  '/jobs': ['jobs'],
  '/escalations': ['escalations', 'notifications'],
  '/conversations/calls': ['calls'],
  '/conversations/chats': ['chats'],
  '/dispatch-queue': ['dispatch_queue', 'calls', 'notifications', 'jobs'],
  '/agents/dispatch': ['dispatch_agent_stats', 'dispatch_queue'],
  '/agents/receptionist': ['receptionist_stats'],
};

const ALL_LIVE_RESOURCES: readonly DashboardResource[] = [
  'jobs',
  'escalations',
  'calls',
  'chats',
  'notifications',
  'dispatch_queue',
  'telemetry_stats',
  'revenue_stats',
  'quality_stats',
  'receptionist_stats',
  'dispatch_agent_stats',
];

export function resourcesForRoute(href: string): readonly DashboardResource[] {
  const path = href.split('?')[0] ?? href;
  if (ROUTE_RESOURCES[path]) return ROUTE_RESOURCES[path]!;
  if (path.startsWith('/conversations/chats')) return ['chats'];
  if (path.startsWith('/conversations/calls')) return ['calls'];
  if (path.startsWith('/conversations')) return ['calls', 'chats'];
  return [];
}

export function prefetchDashboardRoute(
  href: string,
  session: Session,
  priority: 'high' | 'normal' = 'normal',
): void {
  for (const resource of resourcesForRoute(href)) {
    prefetchDashboardResource(resource, session, priority);
  }
}

export function warmAllLiveDashboardData(session: Session): void {
  for (const resource of ALL_LIVE_RESOURCES) {
    prefetchDashboardResource(resource, session);
  }
}

function sessionSuffix(session: Session): string {
  return `:${sessionKey(session)}`;
}

function resourceFromCacheKey(key: string, session: Session): DashboardResource | null {
  const suffix = sessionSuffix(session);
  if (!key.endsWith(suffix)) return null;
  const resource = key.slice(0, key.length - suffix.length) as DashboardResource;
  return (ALL_LIVE_RESOURCES as readonly string[]).includes(resource) ? resource : null;
}

function activeResourcesForSession(session: Session): DashboardResource[] {
  const active = new Set<DashboardResource>();

  for (const key of warmResources) {
    const resource = resourceFromCacheKey(key, session);
    if (resource) active.add(resource);
  }

  for (const key of subscriberCounts.keys()) {
    if ((subscriberCounts.get(key) ?? 0) <= 0) continue;
    const resource = resourceFromCacheKey(key, session);
    if (resource) active.add(resource);
  }

  return [...active];
}

function syncPollingTargets(): void {
  if (!pollSession) return;
  pollResources = activeResourcesForSession(pollSession);
  const hasCalls = pollResources.includes('calls');

  if (pollResources.length === 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  if (!hasCalls && callsPollTimer) {
    clearInterval(callsPollTimer);
    callsPollTimer = null;
  }
}

function ensurePolling(session: Session): void {
  pollSession = session;
  pollResources = activeResourcesForSession(session);
  const hasCalls = pollResources.includes('calls');

  if (!pollTimer && pollResources.length > 0) {
    pollTimer = setInterval(() => {
      if (!pollSession) return;
      pollResources = activeResourcesForSession(pollSession);
      for (const resource of pollResources) {
        if (resource === 'calls') continue;
        scheduleFetch(resource, pollSession, true);
      }
    }, LIVE_REFRESH_MS);
  }

  if (hasCalls && !callsPollTimer) {
    callsPollTimer = setInterval(() => {
      if (!pollSession) return;
      if (!activeResourcesForSession(pollSession).includes('calls')) return;
      scheduleFetch('calls', pollSession, true);
    }, LIVE_CALLS_REFRESH_MS);
  }

  syncPollingTargets();
}
