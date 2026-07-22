'use client';

/**
 * TOP BAR — spec §4.3, verbatim:
 * "Organization switcher for multi-organization users. Business Location filter for
 *  multi-location organizations. Live clock in the active Business Location timezone.
 *  Notifications bell and unread count. User menu."
 *
 * Exactly those five. The access-tier badge is removed with no replacement.
 *
 * Demo controls: in a real deployment the role and organization arrive with the
 * authenticated session. The role switcher lives inside the user menu under an explicit
 * "Demo controls" heading — visibly not a product feature — so every gated surface can be
 * exercised in this frontend-only build.
 */

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell, Building2, Check, CheckCheck, ChevronDown, CircleUser, Clock, MapPin } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/locale-context';
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from '@/i18n/config';
import { DEMO_CONTROLS_ENABLED, useSession } from '@/shared/session-context';
import { markAllLiveNotificationsRead, markLiveNotificationRead, type LiveNotificationCounts, type LiveNotificationItem } from '@/lib/dashboard-live';
import { formatCount, formatLiveClock, displayTimezone } from '@/lib/format';
import { ROLES, ROLE_LABELS } from '@/shared/status-models';

const menuContentClass =
  'z-50 min-w-[14rem] max-w-[20rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md';
const menuItemClass =
  'relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground';
const triggerClass =
  'inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm hover:bg-accent';

/** §4.3 "Organization switcher for multi-organization users" — hidden with only one org. */
function OrgSwitcher(): React.JSX.Element | null {
  const { org, orgs, setOrgId } = useSession();
  const { t } = useLocale();

  if (orgs.length <= 1) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={triggerClass} aria-label={t('topbar.changeOrganization')}>
        <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="hidden max-w-[12rem] truncate sm:inline">{org.name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={menuContentClass} align="start" sideOffset={6}>
          <DropdownMenu.Label className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('topbar.organization')}
          </DropdownMenu.Label>
          {orgs.map((candidate) => (
            <DropdownMenu.Item key={candidate.id} className={menuItemClass} onSelect={() => setOrgId(candidate.id)}>
              <Check className={cn('h-4 w-4', org.id === candidate.id ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
              <span className="truncate">{candidate.name}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** §4.3 "Business Location filter for multi-location organizations." */
function LocationFilter(): React.JSX.Element | null {
  const { session, org, showLocationFilter, setLocationId } = useSession();
  const { t } = useLocale();

  if (!showLocationFilter) return null;

  const activeName =
    session.locationId === null
      ? t('topbar.allLocations')
      : org.locations.find((l) => l.id === session.locationId)?.name ?? t('topbar.allLocations');

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={triggerClass} aria-label={t('topbar.locationFilter')}>
        <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="hidden max-w-[12rem] truncate sm:inline">{activeName}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={menuContentClass} align="start" sideOffset={6}>
          <DropdownMenu.Label className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('topbar.locationFilter')}
          </DropdownMenu.Label>
          <DropdownMenu.Item className={menuItemClass} onSelect={() => setLocationId(null)}>
            <Check className={cn('h-4 w-4', session.locationId === null ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
            <span>{t('topbar.allLocations')}</span>
          </DropdownMenu.Item>
          {org.locations.map((location) => (
            <DropdownMenu.Item key={location.id} className={menuItemClass} onSelect={() => setLocationId(location.id)}>
              <Check
                className={cn('h-4 w-4', session.locationId === location.id ? 'opacity-100' : 'opacity-0')}
                aria-hidden="true"
              />
              <span className="truncate">{location.name}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** §4.3 notifications bell — unread count with breakdown on hover / click. */
function notificationHref(item: LiveNotificationItem): string {
  if (item.entityType === 'escalation' && item.entityId) return `/escalations?escalationId=${encodeURIComponent(item.entityId)}`;
  if (item.entityType === 'dispatch' && item.entityId) return `/dispatch-queue?dispatchId=${encodeURIComponent(item.entityId)}`;
  if (item.entityType === 'line') return '/settings/lines';
  return '/settings/notifications';
}

function relativeTime(value: string): string {
  const delta = Date.now() - Date.parse(value);
  if (!Number.isFinite(delta)) return '';
  const minutes = Math.max(0, Math.floor(delta / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function NotificationsBell({
  counts,
  onNotificationsChanged,
}: {
  counts: LiveNotificationCounts | null;
  onNotificationsChanged: () => void;
}): React.JSX.Element {
  const { t } = useLocale();
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = counts?.unreadCount ?? 0;
  const items = counts?.items ?? [];

  const label =
    total > 0 ? `${t('topbar.notifications')}: ${total} ${t('topbar.unread')}` : t('topbar.notificationsNone');

  const clearCloseTimer = () => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 160);
  };

  useEffect(() => () => clearCloseTimer(), []);

  const badgeLabel = total > 99 ? '99+' : String(total);

  async function markOne(eventId: string): Promise<void> {
    try {
      await markLiveNotificationRead(session, eventId, true);
      onNotificationsChanged();
    } catch (e) {
      console.error('Failed to mark notification read', e);
    }
  }

  async function markAll(): Promise<void> {
    if (isMarking || total === 0) return;
    setIsMarking(true);
    try {
      await markAllLiveNotificationsRead(session);
      onNotificationsChanged();
      setOpen(false);
    } catch (e) {
      console.error('Failed to mark all notifications read', e);
    } finally {
      setIsMarking(false);
    }
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenu.Trigger
        className={cn(triggerClass, 'relative px-2')}
        aria-label={label}
        title={label}
        onPointerEnter={() => {
          clearCloseTimer();
          setOpen(true);
        }}
        onPointerLeave={scheduleClose}
      >
        <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {total > 0 ? (
          <span
            className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
            aria-hidden="true"
          >
            {badgeLabel}
          </span>
        ) : null}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(menuContentClass, 'min-w-[18rem]')}
          align="end"
          sideOffset={6}
          onPointerEnter={clearCloseTimer}
          onPointerLeave={scheduleClose}
        >
          <div className="flex items-center justify-between gap-3 px-2 py-1.5">
            <DropdownMenu.Label className="p-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('topbar.notifications')}
            </DropdownMenu.Label>
            {total > 0 ? (
              <button
                type="button"
                onClick={() => void markAll()}
                disabled={isMarking}
                className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Mark all read
              </button>
            ) : null}
          </div>
          {items.length > 0 ? (
            <div className="max-h-[22rem] overflow-y-auto">
              {items.map((item) => (
                <DropdownMenu.Item key={item.id} className={cn(menuItemClass, 'items-start gap-3 py-2')} asChild>
                  <Link href={notificationHref(item)} onClick={() => void markOne(item.id)}>
                    <span
                      className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', item.readAt === null ? 'bg-primary' : 'bg-border')}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate font-medium">{item.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(item.createdAt)}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">{item.body}</span>
                    </span>
                  </Link>
                </DropdownMenu.Item>
              ))}
            </div>
          ) : (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('topbar.notificationsNone')}</p>
          )}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item className={menuItemClass} asChild>
            <Link href="/settings/notifications">
              <span className="flex flex-1 items-center justify-between gap-3">
                <span>Open notification history</span>
                <span className="font-semibold tabular-nums">{formatCount(counts?.total ?? 0)}</span>
              </span>
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * §4.3 "user menu": the signed-in identity, the locale switcher, and the demo controls
 * for role — labeled as such so they are visibly not a product feature.
 */
function UserMenu(): React.JSX.Element {
  const { session, setRole } = useSession();
  const { t, locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger
        className={cn(triggerClass, 'px-2')}
        aria-label={`${t('topbar.userMenu')}. ${t('topbar.signedInAs')} ${session.actor}, ${ROLE_LABELS[session.role]}`}
      >
        <CircleUser className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={cn(menuContentClass, 'max-h-[80vh] overflow-y-auto')} align="end" sideOffset={6}>
          <div className="px-2 py-2">
            <p className="truncate text-sm font-medium">{session.actor}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[session.role]}</p>
          </div>

          {/* The i18n framework, exposed so it is demonstrably working rather than dead code. */}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Label className="px-2 text-xs font-medium text-muted-foreground">
            {t('topbar.interfaceLanguage')}
          </DropdownMenu.Label>
          <p className="px-2 pb-1.5 text-xs leading-snug text-muted-foreground">{t('topbar.interfaceLanguageNote')}</p>
          {SUPPORTED_LOCALES.map((l: Locale) => (
            <DropdownMenu.Item key={l} className={menuItemClass} onSelect={() => setLocale(l)}>
              <Check className={cn('h-4 w-4', locale === l ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
              <span>{LOCALE_LABELS[l]}</span>
            </DropdownMenu.Item>
          ))}

          {DEMO_CONTROLS_ENABLED ? (
            <>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Label className="px-2 text-xs font-medium text-muted-foreground">
                {t('topbar.demoControls')} — {t('topbar.role')}
              </DropdownMenu.Label>
              <p className="px-2 pb-1.5 text-xs leading-snug text-muted-foreground">{t('topbar.demoControlsNote')}</p>
              {ROLES.map((role) => (
                <DropdownMenu.Item key={role} className={menuItemClass} onSelect={() => setRole(role)}>
                  <Check className={cn('h-4 w-4', session.role === role ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                  <span>{ROLE_LABELS[role]}</span>
                </DropdownMenu.Item>
              ))}
            </>
          ) : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** §4.3 "Live clock in the active Business Location timezone." */
function SessionClock(): React.JSX.Element | null {
  const { session, org } = useSession();
  const timeZone = displayTimezone(session, org);
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  const timeString = formatLiveClock(time, timeZone);

  return (
    <div
      className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-muted-foreground"
      title={timeZone.replace(/_/g, ' ')}
    >
      <Clock className="h-4 w-4" aria-hidden="true" />
      <span className="font-medium">{timeString}</span>
    </div>
  );
}

export function TopBar({
  notifications,
  onNotificationsChanged,
}: {
  notifications: LiveNotificationCounts | null;
  onNotificationsChanged: () => void;
}): React.JSX.Element {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <OrgSwitcher />
        <LocationFilter />
      </div>
      <div className="flex items-center gap-2">
        <SessionClock />
        <NotificationsBell counts={notifications} onNotificationsChanged={onNotificationsChanged} />
        <UserMenu />
      </div>
    </header>
  );
}
