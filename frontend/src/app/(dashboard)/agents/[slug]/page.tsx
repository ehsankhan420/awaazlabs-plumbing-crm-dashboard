import type { Metadata } from 'next';

import { CustomAgentClient } from './custom-agent-client';

export const metadata: Metadata = { title: 'Agent' };

/**
 * Spec §2.6 — the custom-agent rendering framework.
 *
 * Async server component (Next 15): it awaits `params`, then hands the slug to the client
 * component, which resolves the agent from the registry and renders the standard analytics
 * template. An unknown slug becomes a real `notFound()` inside the client.
 */
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CustomAgentClient slug={slug} />;
}
