import type { Metadata } from 'next';

import { ReviewsClient } from './reviews-client';

export const metadata: Metadata = { title: 'Reviews' };

/** Spec §13.2 — GROWTH tab. Not an agent tab; does not use the §2.6 template. */
export default function ReviewsPage() {
  return <ReviewsClient />;
}
