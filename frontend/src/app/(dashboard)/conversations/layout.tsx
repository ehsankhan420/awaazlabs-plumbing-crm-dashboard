'use client';

/**
 * §5.3 Conversations tab shell — "the unified interaction record."
 *
 * Two sub-views (Calls, Chats) that SHARE one persistent filter bar. This layout owns
 * everything common to both:
 *   - the page header,
 *   - the sub-view tabs (Calls | Chats), and
 *   - the single shared filter bar.
 *
 * Because the App Router keeps this layout mounted while navigating between the two child
 * routes, the filter state held in `ConversationsProvider` genuinely persists across the
 * Calls ↔ Chats switch.
 */

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';

import { useDashboardPrefetch } from '@/shared/dashboard-data-context';
import { useSession } from '@/shared/session-context';

import { ConversationsProvider } from './_components/conversations-provider';
import { ConversationsFilterBar } from './_components/filter-bar';

const SUB_VIEWS = [
  { href: '/conversations/calls', label: 'Calls' },
  { href: '/conversations/chats', label: 'Chats' },
] as const;

function SubViewTabs(): React.JSX.Element {
  const pathname = usePathname();
  const { prefetchRoute } = useDashboardPrefetch();
  return (
    <nav aria-label="Conversations sub-views" className="flex w-full flex-wrap items-center gap-2">
      {SUB_VIEWS.map((v) => {
        const active = pathname === v.href || pathname.startsWith(`${v.href}/`);
        return (
          <Link
            key={v.href}
            href={v.href}
            prefetch
            aria-current={active ? 'page' : undefined}
            onMouseEnter={() => prefetchRoute(v.href, 'high')}
            onFocus={() => prefetchRoute(v.href, 'high')}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm transition-colors',
              active ? 'border-border bg-muted/60 font-medium text-foreground' : 'border-transparent bg-transparent hover:bg-muted/40',
            )}
          >
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function ConversationsLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { org, showLocationFilter } = useSession();

  return (
    <ConversationsProvider>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Conversations"
          description="Review every customer and plumber interaction handled by the automation agents."
        />

        <div className="flex flex-col gap-4">
          <SubViewTabs />
          <ConversationsFilterBar locations={org.locations} showLocationFilter={showLocationFilter} />
        </div>

        {children}
      </div>
    </ConversationsProvider>
  );
}
