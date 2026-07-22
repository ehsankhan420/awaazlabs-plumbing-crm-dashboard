import type { Metadata } from 'next';
import React from 'react';

import { ChatsClient } from './chats-client';

export const metadata: Metadata = { title: 'Conversations · Chats' };

/**
 * §10.2 Chats sub-view. Server wrapper delegating to the client body (gating state lives in
 * the session context).
 */
export default function ConversationsChatsPage(): React.JSX.Element {
  return <ChatsClient />;
}
