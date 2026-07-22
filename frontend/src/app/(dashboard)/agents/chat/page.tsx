import type { Metadata } from 'next';

import { ChatClient } from './chat-client';

export const metadata: Metadata = { title: 'Chat Agents' };

/** Spec §9 — WhatsApp + web-chat analytics, rendered through the §2.6 template. */
export default function ChatAgentsPage() {
  return <ChatClient />;
}
