/**
 * English message catalogue — the source of truth for message keys.
 *
 * `MessageKey` is derived from this object, and `es.ts` is typed as
 * `Record<MessageKey, string>`. Adding a key here without translating it in `es.ts` is a
 * **compile error**, not a runtime fallback to English.
 *
 * Scope note: the application *chrome* — navigation, top bar, shared empty/placeholder
 * states — is translated. Page bodies ship English, with Spanish as the second locale
 * target. Extending coverage is adding keys here and there; nothing structural changes.
 */

export const en = {
  // --- Navigation groups (§4.14, in the spec's order) ---
  'nav.group.home': 'HOME',
  'nav.group.operations': 'OPERATIONS',
  'nav.group.agents': 'AGENTS',
  'nav.group.quality': 'QUALITY',
  'nav.group.growth': 'GROWTH',
  'nav.group.insights': 'INSIGHTS',
  'nav.group.compliance': 'COMPLIANCE',
  'nav.group.settings': 'SETTINGS',

  // --- Navigation items (§4.14) ---
  'nav.overview': 'Overview',
  'nav.jobs': 'Jobs',
  'nav.conversations': 'Conversations',
  'nav.calls': 'Calls',
  'nav.chats': 'Chats',
  'nav.escalations': 'Escalations',
  'nav.dispatchQueue': 'Dispatch Queue',
  'nav.receptionist': 'AI Receptionist',
  'nav.dispatchAgent': 'Plumber Dispatch Agent',
  'nav.chatAgents': 'Chat Agents',
  'nav.reviewTaker': 'Review Taker',
  'nav.reengagement': 'Reengagement',
  'nav.quality': 'Quality and Optimization',
  'nav.knowledge': 'Agent Knowledge',
  'nav.reviews': 'Reviews',
  'nav.campaigns': 'Campaigns',
  'nav.reports': 'Reports and Exports',
  'nav.auditLog': 'Audit Log',
  'nav.members': 'Members',
  'nav.billing': 'Usage and Billing',
  'nav.organization': 'Organization and Locations',
  'nav.lines': 'Lines and Numbers',
  'nav.consent': 'Consent and Do-Not-Call',
  'nav.notifications': 'Notifications',

  // --- Shell chrome ---
  'shell.skipToContent': 'Skip to main content',
  'shell.mainNavigation': 'Main navigation',
  'shell.expandNavigation': 'Expand navigation',
  'shell.collapseNavigation': 'Collapse navigation',

  // --- Top bar (§4.3) ---
  'topbar.organization': 'Organization',
  'topbar.changeOrganization': 'Change organization',
  'topbar.allLocations': 'All locations',
  'topbar.changeLocation': 'Change location',
  'topbar.locationFilter': 'Business Location filter',
  'topbar.notifications': 'Notifications',
  'topbar.unread': 'unread',
  'topbar.notificationsNone': 'Notifications: none unread',
  'topbar.notificationsEscalations': 'Escalations to acknowledge or resolve',
  'topbar.notificationsDispatch': 'Dispatch records needing attention',
  'topbar.userMenu': 'User menu',
  'topbar.signedInAs': 'Signed in as',
  'topbar.demoControls': 'Demo controls',
  'topbar.demoControlsNote':
    'Not a product feature. In a real deployment the role and organization arrive with the authenticated session and are never self-serve.',
  'topbar.role': 'Role',
  'topbar.interfaceLanguage': 'Interface language',
  'topbar.interfaceLanguageNote':
    'The i18n framework is in place. Application chrome is translated; page bodies ship English, with Spanish as the second locale target.',

  // --- Under construction placeholder ---
  'underConstruction.badge': 'Under construction',
  'underConstruction.spec': 'Spec:',
  'underConstruction.plannedFor': 'Planned for:',
  'underConstruction.milestone2': 'Milestone 2',

  // --- Route guard ---
  'guard.notAvailable': 'is not available',
  'guard.explanation':
    'Your role does not grant access to this surface. If you believe this is wrong, contact your organization owner.',
} as const;

export type MessageKey = keyof typeof en;
export type Messages = Readonly<Record<MessageKey, string>>;
