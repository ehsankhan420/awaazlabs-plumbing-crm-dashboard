import { redirect } from 'next/navigation';

/**
 * §3 lists Conversations with two sub-views (Calls, Chats) and no index of its own. The
 * nav links straight to `/conversations/calls`, but a user can still type the bare URL —
 * which would 404. Redirect to the primary sub-view rather than inventing an index page
 * the spec does not describe.
 */
export default function ConversationsIndex(): never {
  redirect('/conversations/calls');
}
