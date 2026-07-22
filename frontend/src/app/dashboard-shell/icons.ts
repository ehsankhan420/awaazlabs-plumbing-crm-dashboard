import {
  Bell,
  BookOpen,
  Bot,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileDown,
  Hash,
  Headset,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  PhoneOutgoing,
  Receipt,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  TriangleAlert,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Icon allow-list.
 *
 * `nav.ts` and the agent registry (§2.6) carry icons as *strings*. Resolving an arbitrary
 * string to a component at render time would let a registry entry name any export in the
 * icon package — a small but real rendering-injection surface, and a runtime crash waiting
 * to happen when a name does not exist.
 *
 * This map is the only bridge from string to component. An unknown name falls back to a
 * neutral icon rather than throwing, because a broken icon must never take down a page.
 */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  LayoutDashboard,
  CalendarDays,
  MessagesSquare,
  PhoneCall,
  PhoneForwarded,
  MessageSquare,
  TriangleAlert,
  ClipboardCheck,
  Headset,
  ShieldCheck,
  Bot,
  Star,
  PhoneOutgoing,
  Sparkles,
  BookOpen,
  ThumbsUp,
  Megaphone,
  FileDown,
  ScrollText,
  Users,
  Receipt,
  Building2,
  Hash,
  PhoneOff,
  Bell,
};

export function resolveIcon(name: string): LucideIcon {
  return ICONS[name] ?? Bot;
}
