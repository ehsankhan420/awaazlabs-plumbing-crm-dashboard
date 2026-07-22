/**
 * NAVIGATION TREE — spec §4.14, built exactly. Nothing more, nothing less.
 *
 * FROZEN FILE (Foundation).
 *
 * Labels are `MessageKey`s, not strings — the nav is the chrome the i18n framework
 * translates. The English text lives in `src/i18n/messages/en.ts`.
 *
 * Every entry carries the spec subsection it implements, so an auditor can trace each nav
 * item to a spec line and delete anything that cannot be traced.
 */

import type { MessageKey } from '@/i18n/messages/en';
import type { Session } from '@/mock/data-access';
import { canExport, canSeeAuditLog, canSeeBilling, canSeeMembers } from '@/mock/data-access';

export interface NavItem {
  readonly labelKey: MessageKey;
  readonly href: string;
  /** lucide-react icon name, resolved through an allow-list in the shell. */
  readonly icon: string;
  /** The spec subsection this surface implements. Used by the Phase 3 coverage audit. */
  readonly specRef: string;
  readonly subItems?: readonly NavItem[];
  /** Gate. Absent means "visible to everyone in every mode". */
  readonly visibleWhen?: (session: Session) => boolean;
}

export interface NavGroup {
  readonly titleKey: MessageKey;
  readonly items: readonly NavItem[];
  readonly visibleWhen?: (session: Session) => boolean;
}

/**
 * §4.14, in the spec's exact order. The order here is a product decision, not a style
 * choice. Do not sort it.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    titleKey: 'nav.group.home',
    items: [{ labelKey: 'nav.overview', href: '/', icon: 'LayoutDashboard', specRef: '§5.1' }],
  },
  {
    titleKey: 'nav.group.operations',
    items: [
      { labelKey: 'nav.jobs', href: '/jobs', icon: 'CalendarDays', specRef: '§5.2' },
      {
        labelKey: 'nav.conversations',
        href: '/conversations/calls',
        icon: 'MessagesSquare',
        specRef: '§5.3',
        subItems: [
          { labelKey: 'nav.calls', href: '/conversations/calls', icon: 'PhoneCall', specRef: '§5.3' },
          { labelKey: 'nav.chats', href: '/conversations/chats', icon: 'MessageSquare', specRef: '§5.3' },
        ],
      },
      { labelKey: 'nav.escalations', href: '/escalations', icon: 'TriangleAlert', specRef: '§5.4' },
      { labelKey: 'nav.dispatchQueue', href: '/dispatch-queue', icon: 'ClipboardCheck', specRef: '§5.5' },
    ],
  },
  {
    titleKey: 'nav.group.agents',
    items: [
      { labelKey: 'nav.receptionist', href: '/agents/receptionist', icon: 'Headset', specRef: '§5.6' },
      { labelKey: 'nav.dispatchAgent', href: '/agents/dispatch', icon: 'PhoneForwarded', specRef: '§5.7' },
      { labelKey: 'nav.chatAgents', href: '/agents/chat', icon: 'Bot', specRef: '§4.14' },
      { labelKey: 'nav.reviewTaker', href: '/agents/review-taker', icon: 'Star', specRef: '§4.14' },
      { labelKey: 'nav.reengagement', href: '/agents/reengagement', icon: 'PhoneOutgoing', specRef: '§4.14' },
      // §4.14: Post-Service Follow-Up appends here from the agent registry; the shell
      // renders custom registry entries at this position via /agents/[slug].
    ],
  },
  {
    titleKey: 'nav.group.quality',
    items: [
      { labelKey: 'nav.quality', href: '/quality', icon: 'Sparkles', specRef: '§4.14' },
      { labelKey: 'nav.knowledge', href: '/knowledge', icon: 'BookOpen', specRef: '§4.14' },
    ],
  },
  {
    titleKey: 'nav.group.growth',
    items: [
      { labelKey: 'nav.reviews', href: '/reviews', icon: 'ThumbsUp', specRef: '§4.14' },
      { labelKey: 'nav.campaigns', href: '/campaigns', icon: 'Megaphone', specRef: '§4.14' },
    ],
  },
  {
    titleKey: 'nav.group.insights',
    items: [
      { labelKey: 'nav.reports', href: '/reports', icon: 'FileDown', specRef: '§4.14', visibleWhen: canExport },
    ],
  },
  {
    // Audit Log: Owner only.
    titleKey: 'nav.group.compliance',
    visibleWhen: canSeeAuditLog,
    items: [{ labelKey: 'nav.auditLog', href: '/audit-log', icon: 'ScrollText', specRef: '§4.14' }],
  },
  {
    titleKey: 'nav.group.settings',
    items: [
      { labelKey: 'nav.members', href: '/settings/members', icon: 'Users', specRef: '§4.14', visibleWhen: canSeeMembers },
      { labelKey: 'nav.billing', href: '/settings/billing', icon: 'Receipt', specRef: '§4.14', visibleWhen: canSeeBilling },
      { labelKey: 'nav.organization', href: '/settings/organization', icon: 'Building2', specRef: '§4.14' },
      { labelKey: 'nav.lines', href: '/settings/lines', icon: 'Hash', specRef: '§4.14' },
      { labelKey: 'nav.consent', href: '/settings/consent', icon: 'PhoneOff', specRef: '§4.14' },
      { labelKey: 'nav.notifications', href: '/settings/notifications', icon: 'Bell', specRef: '§4.14' },
    ],
  },
];

/** Apply role/mode gating. A hidden group with no visible items disappears entirely. */
export function visibleNavGroups(session: Session): readonly NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.visibleWhen?.(session) ?? true),
  })).filter((group) => (group.visibleWhen?.(session) ?? true) && group.items.length > 0);
}

/** Flat list of every route the nav can reach, for the Phase 3 coverage audit. */
export function allNavRoutes(): readonly { href: string; specRef: string }[] {
  return NAV_GROUPS.flatMap((g) =>
    g.items.flatMap((i) => [
      { href: i.href, specRef: i.specRef },
      ...(i.subItems ?? []).map((s) => ({ href: s.href, specRef: s.specRef })),
    ]),
  );
}

export function isRouteActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
