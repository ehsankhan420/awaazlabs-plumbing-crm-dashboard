import type { Metadata } from 'next';

import { ReviewTakerClient } from './review-taker-client';

export const metadata: Metadata = { title: 'Review Taker' };

/** Spec §13.1 — renders through the standard agent analytics template (§2.6). */
export default function ReviewTakerPage() {
  return <ReviewTakerClient />;
}
