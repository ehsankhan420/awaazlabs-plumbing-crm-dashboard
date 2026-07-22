'use client';

/**
 * DASHBOARD SHELL — spec §3 navigation architecture.
 *
 * The left nav renders `visibleNavGroups(session)` and nothing else. Every item is
 * traceable to a spec subsection via its `specRef`. Ten nav items from the previous
 * scaffold were on the Phase 0 REMOVE list and are gone; adding anything back that is not
 * in §3 is a defect the Phase 3 audit will catch.
 *
 * §3 design rule, quoted so it is not lost: "OPERATIONS is where staff work daily
 * (actionable rows), AGENTS is where performance is reviewed (analytics), QUALITY is the
 * trust and moat surface, GROWTH is where outbound value is proven. The demo narrative
 * walks top to bottom in exactly this order." The group order is therefore a product
 * decision — never sort it.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { useLiveNotifications } from '@/hooks/use-dashboard-live';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/i18n/locale-context';
import { useDashboardPrefetch } from '@/shared/dashboard-data-context';
import { useSession } from '@/shared/session-context';
import { isRouteActive, visibleNavGroups } from '@/shared/nav';
import { getFixture } from '@/mock/fixtures';
import { resolveIcon } from './icons';
import { TopBar } from './TopBar';

/**
 * Takes an already-resolved label. Nav-tree items resolve theirs through `t(labelKey)`;
 * custom agents (§2.6) carry a human name from the registry, which is data, not chrome, and
 * is therefore never translated.
 */
function NavLink({
  href,
  icon,
  label,
  collapsed,
  depth = 0,
  onPrefetch,
}: {
  href: string;
  icon: string;
  label: string;
  collapsed: boolean;
  depth?: number;
  onPrefetch: (href: string, priority?: 'high' | 'normal') => void;
}): React.JSX.Element {
  const pathname = usePathname();
  const active = isRouteActive(pathname, href);
  const Icon = resolveIcon(icon);

  const handlePrefetch = () => {
    onPrefetch(href, 'high');
  };

  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent',
        active && 'bg-accent font-medium text-accent-foreground',
        depth > 0 && 'ml-4',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-foreground' : 'text-muted-foreground')} aria-hidden="true" />
      {!collapsed ? <span className="flex-1 truncate">{label}</span> : <span className="sr-only">{label}</span>}
    </Link>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { session, org } = useSession();
  const { prefetchRoute } = useDashboardPrefetch();
  const t = useTranslations();
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    prefetchRoute(pathname, 'high');
  }, [pathname, prefetchRoute]);

  const fixture = getFixture(session.orgId);
  const groups = useMemo(() => visibleNavGroups(session), [session]);

  /**
   * §3: "(custom agents append here from the registry)" · §2.6: a custom agent gets a
   * dashboard page with zero frontend work. This is where that claim is proven — the
   * registry entry alone puts it in the nav and routes it through /agents/[slug].
   */
  const customAgents = useMemo(() => fixture.agents.filter((a) => a.isCustom), [fixture.agents]);

  const { data: notifications, invalidate: invalidateNotifications } = useLiveNotifications();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t('shell.skipToContent')}
      </a>

      <div className="flex">
        <aside
          className={cn(
            'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border md:flex',
            collapsed ? 'w-16' : 'w-64',
          )}
        >
          <div className="flex h-14 items-center justify-between border-b border-border px-3">
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Plumbing Automation</p>
                <p className="truncate text-xs text-muted-foreground">{org.name}</p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
              aria-label={collapsed ? t('shell.expandNavigation') : t('shell.collapseNavigation')}
              aria-expanded={!collapsed}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 pb-6" aria-label={t('shell.mainNavigation')}>
            {groups.map((group) => (
              <div key={group.titleKey} className="mt-4 first:mt-2">
                {!collapsed ? (
                  <h2 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t(group.titleKey)}
                  </h2>
                ) : (
                  <div className="mx-2 my-2 h-px bg-border" aria-hidden="true" />
                )}

                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const parentActive =
                      isRouteActive(pathname, item.href) || item.subItems?.some((s) => isRouteActive(pathname, s.href));
                    return (
                      <React.Fragment key={item.href}>
                        <NavLink
                          href={item.href}
                          icon={item.icon}
                          label={t(item.labelKey)}
                          collapsed={collapsed}
                          onPrefetch={prefetchRoute}
                        />
                        {!collapsed && item.subItems && parentActive
                          ? item.subItems.map((sub) => (
                              <NavLink
                                key={sub.href}
                                href={sub.href}
                                icon={sub.icon}
                                label={t(sub.labelKey)}
                                collapsed={collapsed}
                                depth={1}
                                onPrefetch={prefetchRoute}
                              />
                            ))
                          : null}
                      </React.Fragment>
                    );
                  })}

                  {group.titleKey === 'nav.group.agents'
                    ? customAgents.map((agent) => (
                        <NavLink
                          key={agent.slug}
                          href={`/agents/${agent.slug}`}
                          icon={agent.icon}
                          // Registry data, not chrome — an agent's name is never translated.
                          label={agent.name}
                          collapsed={collapsed}
                          onPrefetch={prefetchRoute}
                        />
                      ))
                    : null}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar notifications={notifications} onNotificationsChanged={invalidateNotifications} />
          <main id="main-content" className="flex-1 px-4 py-6 md:px-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
