'use client';

/**
 * §10.3 Shared filter state for the Conversations tab.
 *
 * This provider is mounted by `conversations/layout.tsx`, which the Next App Router keeps
 * mounted while navigating between `/conversations/calls` and `/conversations/chats`. The
 * filter state therefore genuinely persists across the sub-view tab switch — it is not
 * re-initialised on each route change.
 *
 * The provider also owns the ONE place the free-text search is audited (§10.3 "free-text
 * search (audited)"): a debounced effect calls `recordLiveCustomerSearch`, which writes to the
 * real `audit_events` table (same backend action Jobs search already uses — see
 * `jobs-client.tsx`). Auditing here (rather than in each sub-view) means a single
 * search is recorded once regardless of which sub-view is active.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { recordLiveCustomerSearch } from '@/lib/dashboard-live';
import { useSession } from '@/shared/session-context';

import { DEFAULT_FILTERS, type ConversationFilters } from './filters';

interface ConversationsContextValue {
  readonly filters: ConversationFilters;
  readonly setFilters: (next: ConversationFilters) => void;
}

const ConversationsContext = createContext<ConversationsContextValue | null>(null);

export function useConversationFilters(): ConversationsContextValue {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error('useConversationFilters must be used within <ConversationsProvider>');
  return ctx;
}

export function ConversationsProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { session } = useSession();
  const [filters, setFilters] = useState<ConversationFilters>(DEFAULT_FILTERS);

  // §10.3 "free-text search (audited)". Debounced; skip empty input.
  useEffect(() => {
    const q = filters.search;
    const t = setTimeout(() => {
      if (q.trim()) void recordLiveCustomerSearch(session, q).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [filters.search, session]);

  const value = useMemo<ConversationsContextValue>(() => ({ filters, setFilters }), [filters]);

  return <ConversationsContext.Provider value={value}>{children}</ConversationsContext.Provider>;
}
