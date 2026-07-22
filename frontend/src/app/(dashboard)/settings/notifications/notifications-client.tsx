'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  ClockAlert,
  Inbox,
  Mail,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useSession } from '@/shared/session-context';

import {
  NotificationApiError,
  addNotificationRecipient,
  listNotificationDeliveryHistory,
  listNotificationEvents,
  listNotificationSettings,
  markAllNotificationsRead,
  markNotificationRead,
  removeNotificationRecipient,
  retryNotificationDelivery,
  type NotificationAgentDto,
  type NotificationChannel,
  type NotificationDeliveryDto,
  type NotificationDeliveryHealthDto,
  type NotificationDeliveryStatus,
  type NotificationEventDto,
  type NotificationEventType,
  type NotificationPriority,
  type NotificationRecipientDto,
  type NotificationSettingsDto,
} from './notification-api';

const EVENT_ICONS: Record<NotificationEventType, LucideIcon> = {
  job_created: CalendarCheck,
  escalation_created: ShieldAlert,
  dispatch_exhausted: ClipboardList,
  job_needs_review: AlertTriangle,
  after_hours_job: ClockAlert,
  emergency_detected: ShieldAlert,
};

const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  normal: 'Normal',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const DELIVERY_EVENT_OPTIONS = [
  { value: 'all', label: 'All events' },
  { value: 'job_created', label: 'Job created' },
  { value: 'escalation_created', label: 'Escalation created' },
  { value: 'dispatch_exhausted', label: 'Dispatch exhausted' },
  { value: 'job_needs_review', label: 'Job needs review' },
  { value: 'after_hours_job', label: 'After-hours job' },
  { value: 'emergency_detected', label: 'Emergency detected' },
] as const;

const HISTORY_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
  { value: 'sending', label: 'Sending' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'suppressed', label: 'Suppressed' },
  { value: 'unread', label: 'Unread in-app' },
  { value: 'read', label: 'Read in-app' },
] as const;

type HistoryStatusFilter = NotificationDeliveryStatus | 'read' | 'unread' | 'all';

interface HistoryFilters {
  readonly eventType: NotificationEventType | 'all';
  readonly status: HistoryStatusFilter;
  readonly dateFrom: string;
  readonly dateTo: string;
}

const DELIVERY_CHANNEL_OPTIONS = [
  { value: 'all', label: 'All channels' },
  { value: 'email', label: 'Email' },
  { value: 'in_app', label: 'In-app' },
] as const;

const DELIVERY_STATUS_OPTIONS = HISTORY_STATUS_OPTIONS;

interface DeliveryFilters extends HistoryFilters {
  readonly channel: NotificationChannel | 'all';
}

function emailLooksValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function priorityVariant(priority: NotificationPriority): BadgeVariant {
  if (priority === 'urgent') return 'destructive';
  if (priority === 'high' || priority === 'medium') return 'warning';
  return 'secondary';
}

function deliveryStatusVariant(status: NotificationDeliveryStatus): BadgeVariant {
  if (status === 'failed') return 'destructive';
  if (status === 'sent') return 'default';
  if (status === 'pending' || status === 'sending') return 'warning';
  return 'secondary';
}

function isDeliveryStatus(value: HistoryStatusFilter): value is NotificationDeliveryStatus {
  return value !== 'all' && value !== 'read' && value !== 'unread';
}

function eventLabel(eventType: string): string {
  return DELIVERY_EVENT_OPTIONS.find((option) => option.value === eventType)?.label ?? eventType.replace(/_/g, ' ');
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function notificationHref(item: NotificationEventDto): string {
  if (item.entityType === 'job' && item.entityId) return `/jobs?jobId=${encodeURIComponent(item.entityId)}`;
  if (item.entityType === 'escalation' && item.entityId) return `/escalations?escalationId=${encodeURIComponent(item.entityId)}`;
  if (item.entityType === 'dispatch' && item.entityId) return `/dispatch-queue?dispatchId=${encodeURIComponent(item.entityId)}`;
  return '/settings/notifications';
}

function canManageNotifications(role: string): boolean {
  return role === 'OWNER_ADMIN' || role === 'MANAGER';
}

function AgentSelector({
  agents,
  selected,
  onSelect,
}: {
  agents: readonly NotificationAgentDto[];
  selected: NotificationAgentDto | null;
  onSelect: (agent: NotificationAgentDto) => void;
}) {
  const selectedKey = selected?.key ?? agents[0]?.key ?? 'receptionist';
  const selectedEnabled = selected?.enabled ?? false;

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Agent notifications
            </CardTitle>
            <CardDescription>Choose which agent notification rules and history to manage.</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={selectedKey}
              onValueChange={(value) => {
                const agent = agents.find((item) => item.key === value);
                if (agent) onSelect(agent);
              }}
              options={agents.map((agent) => ({
                value: agent.key,
                label: agent.enabled ? agent.label : `${agent.label} (soon)`,
              }))}
              aria-label="Select notification agent"
              className="min-w-[240px]"
            />
            {selectedEnabled ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Coming soon</Badge>}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}

function NotificationLoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-24 animate-pulse rounded-md border border-border bg-muted" />
      <div className="h-44 animate-pulse rounded-md border border-border bg-muted" />
      <div className="h-96 animate-pulse rounded-md border border-border bg-muted" />
    </div>
  );
}

function GlobalRecipientsCard({
  recipients,
  canManage,
  isSaving,
  onAdd,
  onRemove,
}: {
  recipients: readonly NotificationRecipientDto[];
  canManage: boolean;
  isSaving: boolean;
  onAdd: (email: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Notification recipients
            </CardTitle>
            <CardDescription>Global email recipients for every notification event.</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen((value) => !value)}
            className="justify-between sm:min-w-[170px]"
            aria-expanded={open}
          >
            <span className="inline-flex items-center gap-2">
              Manage recipients
              <Badge variant="secondary">{recipients.length}</Badge>
            </span>
            <ChevronDown
              className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-300', open && 'rotate-180')}
              aria-hidden="true"
            />
          </Button>
        </div>
      </CardHeader>
      <div className={cn('grid transition-all duration-300 ease-in-out', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="overflow-hidden">
          <CardContent className="border-t border-border pt-4">
            <RecipientManager
              recipients={recipients}
              canManage={canManage}
              isSaving={isSaving}
              onAdd={onAdd}
              onRemove={onRemove}
            />
          </CardContent>
        </div>
      </div>
    </Card>
  );
}

function RecipientManager({
  recipients,
  canManage,
  isSaving,
  onAdd,
  onRemove,
}: {
  recipients: readonly NotificationRecipientDto[];
  canManage: boolean;
  isSaving: boolean;
  onAdd: (email: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const trimmed = email.trim();
  const canSubmit = canManage && emailLooksValid(trimmed) && !isSaving;

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) return;
    await onAdd(trimmed);
    setEmail('');
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          disabled={!canManage || isSaving}
          className="min-h-9 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60"
          aria-label="Notification recipient email"
        />
        <Button type="submit" disabled={!canSubmit} className="sm:min-w-[112px]">
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Add
        </Button>
      </form>

        {recipients.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-8 w-8" />}
            title="No email recipients"
            description="Add at least one recipient to send instant notification emails."
            className="py-8"
          />
        ) : (
          <div className="grid gap-2">
            {recipients.map((recipient) => (
              <div
                key={recipient.id}
                className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{recipient.email}</p>
                  <p className="text-xs text-muted-foreground">Added {formatDateTime(recipient.createdAt)}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canManage || isSaving}
                  onClick={() => void onRemove(recipient.id)}
                  aria-label={`Remove ${recipient.email}`}
                  title="Remove recipient"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function ComingSoonPanel({ agent }: { agent: NotificationAgentDto }) {
  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="text-base">{agent.label}</CardTitle>
        <CardDescription>This agent is already represented in the notification model.</CardDescription>
      </CardHeader>
      <CardContent>
        <EmptyState
          icon={<Bell className="h-8 w-8" />}
          title="Rules coming soon"
          description="Receptionist Agent is the active notification surface in this phase."
        />
      </CardContent>
    </Card>
  );
}

function _InAppInbox({
  events,
  isLoading,
  busyEventId,
  onRefresh,
  onToggleRead,
  onMarkAllRead,
}: {
  events: readonly NotificationEventDto[];
  isLoading: boolean;
  busyEventId: string | null;
  onRefresh: () => void;
  onToggleRead: (event: NotificationEventDto) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}) {
  const unreadCount = events.filter((event) => event.readAt === null).length;

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              In-app notification history
            </CardTitle>
            <CardDescription>Recent Receptionist notifications from the live event stream.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => void onMarkAllRead()} disabled={unreadCount === 0 || isLoading}>
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Mark all read
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-md border border-border bg-muted" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-8 w-8" />}
            title="No in-app notifications yet"
            description="New Receptionist events will appear here as they happen."
            className="py-10"
          />
        ) : (
          <div className="grid gap-2">
            {events.map((event) => {
              const unread = event.readAt === null;
              const Icon = EVENT_ICONS[event.eventType] ?? Bell;
              return (
                <div
                  key={event.id}
                  className={cn(
                    'flex flex-col gap-3 rounded-md border border-border bg-background p-4 sm:flex-row sm:items-start sm:justify-between',
                    unread && 'border-primary/40 bg-primary/5',
                  )}
                >
                  <Link href={notificationHref(event)} className="flex min-w-0 flex-1 gap-3 rounded-sm outline-none focus:ring-2 focus:ring-ring">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {unread ? <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" /> : null}
                        <p className="font-medium text-foreground">{event.title}</p>
                        <Badge variant={priorityVariant(event.priority as NotificationPriority)}>
                          {PRIORITY_LABELS[event.priority as NotificationPriority] ?? event.priority}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{event.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDateTime(event.createdAt)} · {event.entityType}
                      </p>
                    </div>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void onToggleRead(event)}
                    disabled={busyEventId === event.id}
                    className="shrink-0"
                  >
                    {unread ? <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> : null}
                    {unread ? 'Mark read' : 'Mark unread'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function _DeliveryHistory({
  deliveries,
  filters,
  isLoading,
  busyDeliveryId,
  canManage,
  onFiltersChange,
  onRefresh,
  onRetry,
}: {
  deliveries: readonly NotificationDeliveryDto[];
  filters: DeliveryFilters;
  isLoading: boolean;
  busyDeliveryId: string | null;
  canManage: boolean;
  onFiltersChange: (filters: DeliveryFilters) => void;
  onRefresh: () => void;
  onRetry: (deliveryId: string) => Promise<void>;
}) {
  function update<K extends keyof DeliveryFilters>(key: K, value: DeliveryFilters[K]): void {
    onFiltersChange({ ...filters, [key]: value });
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Delivery history
            </CardTitle>
            <CardDescription>Email and in-app delivery attempts for notification events.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <Select
            value={filters.eventType}
            onValueChange={(value) => update('eventType', value as DeliveryFilters['eventType'])}
            options={DELIVERY_EVENT_OPTIONS}
            aria-label="Filter delivery history by event"
          />
          <Select
            value={filters.channel}
            onValueChange={(value) => update('channel', value as DeliveryFilters['channel'])}
            options={DELIVERY_CHANNEL_OPTIONS}
            aria-label="Filter delivery history by channel"
          />
          <Select
            value={filters.status}
            onValueChange={(value) => update('status', value as DeliveryFilters['status'])}
            options={DELIVERY_STATUS_OPTIONS}
            aria-label="Filter delivery history by status"
          />
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => update('dateFrom', event.target.value)}
            className="min-h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
            aria-label="Delivery history start date"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) => update('dateTo', event.target.value)}
            className="min-h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
            aria-label="Delivery history end date"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md border border-border bg-muted" />
            ))}
          </div>
        ) : deliveries.length === 0 ? (
          <EmptyState
            icon={<Send className="h-8 w-8" />}
            title="No deliveries match these filters"
            description="New notification sends and retry attempts will appear here."
            className="py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 font-medium">Channel</th>
                  <th className="px-3 py-2 font-medium">Recipient</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Provider message id</th>
                  <th className="px-3 py-2 font-medium">Error</th>
                  <th className="px-3 py-2 text-right font-medium">Retry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deliveries.map((delivery) => {
                  const failedEmail = delivery.channel === 'email' && delivery.status === 'failed';
                  return (
                    <tr key={delivery.id} className="align-top">
                      <td className="px-3 py-3">
                        <div className="max-w-[240px]">
                          <p className="truncate font-medium text-foreground">
                            {delivery.event ? eventLabel(delivery.event.eventType) : 'Unknown event'}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(delivery.createdAt)}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline">{delivery.channel === 'in_app' ? 'In-app' : 'Email'}</Badge>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        <span className="block max-w-[180px] truncate">{delivery.recipientEmail ?? '-'}</span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={deliveryStatusVariant(delivery.status)}>{delivery.status}</Badge>
                        <p className="mt-1 text-xs text-muted-foreground">{delivery.attemptCount} attempt{delivery.attemptCount === 1 ? '' : 's'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="block max-w-[220px] truncate font-mono text-xs text-muted-foreground">
                          {delivery.providerMessageId ?? '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="line-clamp-2 max-w-[260px] text-xs text-muted-foreground">
                          {delivery.errorMessage ?? '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canManage || !failedEmail || busyDeliveryId === delivery.id}
                          onClick={() => void onRetry(delivery.id)}
                          title={failedEmail ? 'Retry failed email' : 'Retry is available for failed emails'}
                        >
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Retry
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationHistory({
  events,
  deliveries,
  filters,
  isLoadingEvents,
  isLoadingDeliveries,
  busyEventId,
  busyDeliveryId,
  canManage,
  onFiltersChange,
  onRefresh,
  onToggleRead,
  onRetry,
}: {
  events: readonly NotificationEventDto[];
  deliveries: readonly NotificationDeliveryDto[];
  filters: DeliveryFilters;
  isLoadingEvents: boolean;
  isLoadingDeliveries: boolean;
  busyEventId: string | null;
  busyDeliveryId: string | null;
  canManage: boolean;
  onFiltersChange: (filters: DeliveryFilters) => void;
  onRefresh: () => void;
  onToggleRead: (event: NotificationEventDto) => Promise<void>;
  onRetry: (deliveryId: string) => Promise<void>;
}) {
  const isLoading = isLoadingEvents || isLoadingDeliveries;
  const deliveriesByEvent = useMemo(() => {
    const map = new Map<string, NotificationDeliveryDto[]>();
    for (const delivery of deliveries) {
      const list = map.get(delivery.notificationEventId) ?? [];
      list.push(delivery);
      map.set(delivery.notificationEventId, list);
    }
    return map;
  }, [deliveries]);

  function update<K extends keyof DeliveryFilters>(key: K, value: DeliveryFilters[K]): void {
    onFiltersChange({ ...filters, [key]: value });
  }

  const rows = useMemo(() => {
    const from = filters.dateFrom ? Date.parse(`${filters.dateFrom}T00:00:00.000Z`) : null;
    const to = filters.dateTo ? Date.parse(`${filters.dateTo}T23:59:59.999Z`) : null;

    return events.flatMap((event) => {
      const created = Date.parse(event.createdAt);
      if (filters.eventType !== 'all' && event.eventType !== filters.eventType) return [];
      if (from !== null && created < from) return [];
      if (to !== null && created > to) return [];
      if (filters.status === 'read' && event.readAt === null) return [];
      if (filters.status === 'unread' && event.readAt !== null) return [];

      const emailDeliveries = (deliveriesByEvent.get(event.id) ?? []).filter((delivery) => delivery.channel === 'email');
      const sourceRows = emailDeliveries.length > 0 ? emailDeliveries : [null];

      return sourceRows.flatMap((delivery) => {
        if (isDeliveryStatus(filters.status) && delivery?.status !== filters.status) return [];
        return [{ event, delivery }];
      });
    });
  }, [deliveriesByEvent, events, filters]);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Notification history
            </CardTitle>
            <CardDescription>Events, email delivery status, and in-app read state in one place.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <Select
            value={filters.eventType}
            onValueChange={(value) => update('eventType', value as DeliveryFilters['eventType'])}
            options={DELIVERY_EVENT_OPTIONS}
            aria-label="Filter notification history by event"
          />
          <Select
            value={filters.status}
            onValueChange={(value) => update('status', value as DeliveryFilters['status'])}
            options={HISTORY_STATUS_OPTIONS}
            aria-label="Filter notification history by status"
          />
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => update('dateFrom', event.target.value)}
            className="min-h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
            aria-label="Notification history start date"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) => update('dateTo', event.target.value)}
            className="min-h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
            aria-label="Notification history end date"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-md border border-border bg-muted" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-8 w-8" />}
            title="No notifications match these filters"
            description="New notification events, email sends, and in-app states will appear here."
            className="py-10"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium">Recipient email</th>
                  <th className="px-3 py-2 font-medium">Email status</th>
                  <th className="px-3 py-2 font-medium">In-app status</th>
                  <th className="px-3 py-2 font-medium">Linked record</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ event, delivery }) => {
                  const unread = event.readAt === null;
                  const Icon = EVENT_ICONS[event.eventType] ?? Bell;
                  const failedEmail = delivery?.channel === 'email' && delivery.status === 'failed';
                  const rowKey = `${event.id}-${delivery?.id ?? 'in-app'}`;

                  return (
                    <tr key={rowKey} className={cn('align-top', unread && 'bg-primary/5')}>
                      <td className="px-3 py-3">
                        <div className="flex max-w-[280px] gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{event.title}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{event.body}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDateTime(event.createdAt)}</td>
                      <td className="px-3 py-3">
                        <span className="block max-w-[190px] truncate text-muted-foreground">{delivery?.recipientEmail ?? '-'}</span>
                      </td>
                      <td className="px-3 py-3">
                        {delivery ? (
                          <>
                            <Badge variant={deliveryStatusVariant(delivery.status)}>{delivery.status}</Badge>
                            <p className="mt-1 text-xs text-muted-foreground">{delivery.attemptCount} attempt{delivery.attemptCount === 1 ? '' : 's'}</p>
                          </>
                        ) : (
                          <Badge variant="secondary">No email recipient</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={unread ? 'warning' : 'secondary'}>{unread ? 'Unread' : 'Read'}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={notificationHref(event)}
                          className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted/50"
                        >
                          Open
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void onToggleRead(event)}
                            disabled={busyEventId === event.id}
                          >
                            {unread ? <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> : null}
                            {unread ? 'Mark read' : 'Mark unread'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canManage || !failedEmail || busyDeliveryId === delivery?.id}
                            onClick={() => delivery ? void onRetry(delivery.id) : undefined}
                            title={failedEmail ? 'Retry failed email' : 'Retry is available for failed emails'}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            Retry
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function NotificationsClient() {
  const { session } = useSession();
  const [settings, setSettings] = useState<NotificationSettingsDto | null>(null);
  const [inAppEvents, setInAppEvents] = useState<readonly NotificationEventDto[]>([]);
  const [deliveries, setDeliveries] = useState<readonly NotificationDeliveryDto[]>([]);
  const [deliveryHealth, setDeliveryHealth] = useState<NotificationDeliveryHealthDto>({ sentToday: 0, failedToday: 0 });
  const [deliveryFilters, setDeliveryFilters] = useState<DeliveryFilters>({
    eventType: 'all',
    channel: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>('receptionist');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(true);
  const [isSavingRecipient, setIsSavingRecipient] = useState(false);
  const [busyInboxEventId, setBusyInboxEventId] = useState<string | null>(null);
  const [busyDeliveryId, setBusyDeliveryId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState('Notification error');

  const canManage = canManageNotifications(session.role);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listNotificationSettings(session);
      setSettings(data);
      setError(null);
    } catch (e) {
      setErrorTitle('Notifications not loaded');
      setError(e instanceof NotificationApiError ? e.message : 'Could not load notification settings.');
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const loadInAppEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      const data = await listNotificationEvents(session, { limit: 100 });
      setInAppEvents(data.events);
      setError(null);
    } catch (e) {
      setErrorTitle('Notification history not loaded');
      setError(e instanceof NotificationApiError ? e.message : 'Could not load notification history.');
    } finally {
      setIsLoadingEvents(false);
    }
  }, [session]);

  const loadDeliveries = useCallback(async () => {
    setIsLoadingDeliveries(true);
    try {
      const data = await listNotificationDeliveryHistory(session, {
        eventType: deliveryFilters.eventType === 'all' ? null : deliveryFilters.eventType,
        channel: null,
        status: isDeliveryStatus(deliveryFilters.status) ? deliveryFilters.status : null,
        dateFrom: deliveryFilters.dateFrom || null,
        dateTo: deliveryFilters.dateTo || null,
        limit: 100,
      });
      setDeliveries(data.deliveries);
      setDeliveryHealth(data.health);
      setError(null);
    } catch (e) {
      setErrorTitle('Delivery history not loaded');
      setError(e instanceof NotificationApiError ? e.message : 'Could not load delivery history.');
    } finally {
      setIsLoadingDeliveries(false);
    }
  }, [deliveryFilters, session]);

  useEffect(() => {
    void loadSettings();
    void loadInAppEvents();
  }, [loadSettings, loadInAppEvents]);

  useEffect(() => {
    void loadDeliveries();
  }, [loadDeliveries]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const selectedAgent = useMemo(
    () => settings?.agents.find((agent) => agent.key === selectedAgentKey) ?? settings?.agents[0] ?? null,
    [settings, selectedAgentKey],
  );

  async function addRecipient(email: string): Promise<void> {
    if (!canManage) return;
    setIsSavingRecipient(true);
    try {
      const recipient = await addNotificationRecipient(session, email);
      setSettings((prev) => prev
        ? { ...prev, recipients: [recipient, ...prev.recipients.filter((item) => item.id !== recipient.id)] }
        : prev);
      setNotice('Recipient saved.');
      setError(null);
    } catch (e) {
      setErrorTitle('Recipient not saved');
      setError(e instanceof NotificationApiError ? e.message : 'Could not save recipient.');
    } finally {
      setIsSavingRecipient(false);
    }
  }

  async function removeRecipient(id: string): Promise<void> {
    if (!canManage) return;
    setIsSavingRecipient(true);
    try {
      await removeNotificationRecipient(session, id);
      setSettings((prev) => prev ? { ...prev, recipients: prev.recipients.filter((item) => item.id !== id) } : prev);
      setNotice('Recipient removed.');
      setError(null);
    } catch (e) {
      setErrorTitle('Recipient not removed');
      setError(e instanceof NotificationApiError ? e.message : 'Could not remove recipient.');
    } finally {
      setIsSavingRecipient(false);
    }
  }

  async function toggleInboxRead(event: NotificationEventDto): Promise<void> {
    setBusyInboxEventId(event.id);
    try {
      const nextRead = event.readAt === null;
      await markNotificationRead(session, event.id, nextRead);
      setInAppEvents((prev) => prev.map((item) => item.id === event.id
        ? { ...item, readAt: nextRead ? new Date().toISOString() : null, readBy: nextRead ? session.actor : null }
        : item));
      setSettings((prev) => prev
        ? {
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount + (nextRead ? -1 : 1)),
        }
        : prev);
      setNotice(nextRead ? 'Notification marked read.' : 'Notification marked unread.');
      setError(null);
    } catch (e) {
      setErrorTitle('Notification not updated');
      setError(e instanceof NotificationApiError ? e.message : 'Could not update notification.');
    } finally {
      setBusyInboxEventId(null);
    }
  }

  async function _markInboxAllRead(): Promise<void> {
    try {
      await markAllNotificationsRead(session);
      const now = new Date().toISOString();
      setInAppEvents((prev) => prev.map((event) => event.readAt === null ? { ...event, readAt: now, readBy: session.actor } : event));
      setSettings((prev) => prev ? { ...prev, unreadCount: 0 } : prev);
      setNotice('All in-app notifications marked read.');
      setError(null);
    } catch (e) {
      setErrorTitle('Notifications not updated');
      setError(e instanceof NotificationApiError ? e.message : 'Could not mark notifications read.');
    }
  }

  async function retryDelivery(deliveryId: string): Promise<void> {
    if (!canManage) return;
    setBusyDeliveryId(deliveryId);
    try {
      const delivery = await retryNotificationDelivery(session, deliveryId);
      setDeliveries((prev) => prev.map((item) => item.id === delivery.id ? delivery : item));
      await loadDeliveries();
      setNotice(delivery.status === 'sent' ? 'Delivery retry sent.' : 'Delivery retry recorded.');
      setError(null);
    } catch (e) {
      setErrorTitle('Delivery retry failed');
      setError(e instanceof NotificationApiError ? e.message : 'Could not retry notification delivery.');
    } finally {
      setBusyDeliveryId(null);
    }
  }

  const unreadInAppCount = settings?.unreadCount ?? inAppEvents.filter((event) => event.readAt === null).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        description="Manage Receptionist Agent email and in-app notifications."
      />

      {notice ? (
        <div className="fixed right-5 top-5 z-50 flex max-w-sm items-center gap-3 rounded-md border border-border bg-background px-4 py-3 text-sm text-foreground shadow-lg" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="font-medium">Notifications updated</p>
            <p className="text-xs text-muted-foreground">{notice}</p>
          </div>
        </div>
      ) : null}

      {error ? (
        <Banner variant="destructive" title={errorTitle} onDismiss={() => setError(null)}>
          {error}
        </Banner>
      ) : null}

      {!canManage ? (
        <Banner variant="default" title="View only">
          Notification changes require Manager or Owner/Admin access.
        </Banner>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active recipients</CardDescription>
            <CardTitle className="text-2xl">{isLoading ? '-' : settings?.recipients.length ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Sent today</CardDescription>
            <CardTitle className="text-2xl">{isLoadingDeliveries ? '-' : deliveryHealth.sentToday}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Failed today</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {isLoadingDeliveries ? '-' : deliveryHealth.failedToday}
              {!isLoadingDeliveries && deliveryHealth.failedToday > 0 ? <XCircle className="h-5 w-5 text-destructive" aria-hidden="true" /> : null}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Unread in-app</CardDescription>
            <CardTitle className="text-2xl">{isLoading ? '-' : unreadInAppCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {isLoading ? (
        <NotificationLoadingState />
      ) : settings ? (
        <div className="flex min-w-0 flex-col gap-6">
          <GlobalRecipientsCard
            recipients={settings.recipients}
            canManage={canManage}
            isSaving={isSavingRecipient}
            onAdd={addRecipient}
            onRemove={removeRecipient}
          />
          <AgentSelector
            agents={settings.agents}
            selected={selectedAgent}
            onSelect={(agent) => setSelectedAgentKey(agent.key)}
          />

          {selectedAgent?.key === 'receptionist' ? (
              <NotificationHistory
                events={inAppEvents}
                deliveries={deliveries}
                filters={deliveryFilters}
                isLoadingEvents={isLoadingEvents}
                isLoadingDeliveries={isLoadingDeliveries}
                busyEventId={busyInboxEventId}
                busyDeliveryId={busyDeliveryId}
                canManage={canManage}
                onFiltersChange={setDeliveryFilters}
                onRefresh={() => {
                  void loadInAppEvents();
                  void loadDeliveries();
                }}
                onToggleRead={toggleInboxRead}
                onRetry={retryDelivery}
              />
          ) : selectedAgent ? (
            <ComingSoonPanel agent={selectedAgent} />
          ) : null}
        </div>
      ) : (
        <EmptyState
          icon={<Bell className="h-8 w-8" />}
          title="Notifications unavailable"
          description="Refresh the page after the backend is reachable."
          action={<Button onClick={() => void loadSettings()}>Retry</Button>}
        />
      )}
    </div>
  );
}
