/**
 * Display helpers for the Chats sub-view (§5.3).
 *
 * Outcome labels come from the canonical `CHAT_OUTCOME_LABELS` in status-models.ts;
 * nothing is re-declared here.
 */

import type { ChatMessage } from '@/mock/schema';
import type { ChatInteractionView } from '@/mock/data-access';

export { CHAT_OUTCOME_LABELS } from '@/shared/status-models';

/** Display label for a chat thread's customer column (web chats are often anonymous). */
export function chatCustomerDisplayName(chat: ChatInteractionView): string {
  const identity = chat.contact?.identity ?? null;
  if (identity) {
    const full = `${identity.firstName} ${identity.lastName}`.trim();
    if (full) return full;
  }
  return 'Anonymous visitor';
}

/** Main topic / purpose shown in the chats table. */
export function chatPurposeLabel(chat: ChatInteractionView): string {
  return chat.intent.trim() || 'General question';
}

export function speakerLabel(speaker: ChatMessage['speaker']): string {
  switch (speaker) {
    case 'agent':
      return 'Agent';
    case 'customer':
      return 'Customer';
    case 'human_staff':
      return 'Staff';
    default:
      return speaker;
  }
}
