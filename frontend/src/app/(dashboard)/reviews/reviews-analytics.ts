/**
 * §13.2 REVIEWS (growth) — derivations.
 *
 * The outcome surface for reputation, scoped to the Review Taker agent. It reports outcomes
 * only — there is deliberately NO review responding, listings management or social
 * publishing here (that is Birdeye/Podium territory, out of scope by spec).
 *
 * All timestamps are stored UTC and rendered in the location's timezone (§2.7); trend labels
 * are built here in a supplied IANA zone, anchored to MOCK_NOW so nothing drifts.
 */

import { ratio } from '@/lib/format';
import { isThisMonth, scopeToLocation } from '@/lib/metrics';
import { mockNow } from '@/mock/orgs';
import type { Session } from '@/mock/data-access';
import type { MockOrganization, OrgFixture, PublishedReview } from '@/mock/schema';

const WEEK_MS = 7 * 86_400_000;

/* ==================================================================================
 * Rating trend — the business's Google rating over time (cumulative average), with the
 * review-agent go-live marked as an annotation.
 * ================================================================================== */

export interface RatingTrend {
  readonly labels: readonly string[];
  /** Cumulative mean rating up to each week end; `null` where no reviews exist yet. */
  readonly values: readonly (number | null)[];
  /** Index into `labels` of the week the review agent went live, or `null`. */
  readonly goLiveIndex: number | null;
}

export function ratingTrend(
  fixture: OrgFixture,
  session: Session,
  weeks: number,
  timeZone: string,
): RatingTrend {
  const reviews = scopeToLocation(fixture.publishedReviews, session);
  const requests = scopeToLocation(fixture.reviewRequests, session);
  const nowMs = mockNow().getTime();

  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' });

  const labels: string[] = [];
  const values: (number | null)[] = [];
  for (let i = 0; i < weeks; i += 1) {
    const endMs = nowMs - (weeks - 1 - i) * WEEK_MS;
    labels.push(fmt.format(new Date(endMs)));
    const upTo = reviews.filter((r) => new Date(r.atUtc).getTime() <= endMs);
    const sum = upTo.reduce((acc, r) => acc + r.rating, 0);
    values.push(ratio(sum, upTo.length));
  }

  // Go-live = the earliest review-agent call. Its bucket is the first whose week end covers it.
  const callTimes = requests
    .map((r) => r.calledAtUtc)
    .filter((t): t is string => t !== null)
    .map((t) => new Date(t).getTime());
  let goLiveIndex: number | null = null;
  if (callTimes.length > 0) {
    const goLiveMs = Math.min(...callTimes);
    const windowStartMs = nowMs - (weeks - 1) * WEEK_MS - WEEK_MS;
    if (goLiveMs >= windowStartMs) {
      for (let i = 0; i < weeks; i += 1) {
        const endMs = nowMs - (weeks - 1 - i) * WEEK_MS;
        if (endMs >= goLiveMs) {
          goLiveIndex = i;
          break;
        }
      }
    }
  }

  return { labels, values, goLiveIndex };
}

/* ==================================================================================
 * Reviews over time — attributed vs organic, per week.
 * ================================================================================== */

export interface ReviewsOverTime {
  readonly labels: readonly string[];
  readonly attributed: readonly number[];
  readonly organic: readonly number[];
}

export function reviewsOverTime(
  fixture: OrgFixture,
  session: Session,
  weeks: number,
  timeZone: string,
): ReviewsOverTime {
  const reviews = scopeToLocation(fixture.publishedReviews, session);
  const nowMs = mockNow().getTime();
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' });

  const labels: string[] = [];
  const attributed: number[] = Array.from({ length: weeks }, () => 0);
  const organic: number[] = Array.from({ length: weeks }, () => 0);

  for (let i = 0; i < weeks; i += 1) {
    labels.push(fmt.format(new Date(nowMs - (weeks - 1 - i) * WEEK_MS)));
  }

  for (const r of reviews) {
    const weeksAgo = Math.floor((nowMs - new Date(r.atUtc).getTime()) / WEEK_MS);
    const idx = weeks - 1 - weeksAgo;
    if (idx < 0 || idx >= weeks) continue;
    if (r.attributed) attributed[idx] += 1;
    else organic[idx] += 1;
  }

  return { labels, attributed, organic };
}

/* ==================================================================================
 * Recent attributed reviews.
 * ================================================================================== */

export function recentAttributedReviews(
  fixture: OrgFixture,
  session: Session,
): readonly PublishedReview[] {
  return scopeToLocation(fixture.publishedReviews, session)
    .filter((r) => r.attributed)
    .slice()
    .sort((a, b) => new Date(b.atUtc).getTime() - new Date(a.atUtc).getTime());
}

/* ==================================================================================
 * Per-location comparison (multi-location only).
 * ================================================================================== */

export interface LocationComparisonRow {
  readonly locationId: string;
  readonly locationName: string;
  readonly rating: number | null;
  readonly attributedThisMonth: number;
  readonly agreementRate: number | null;
}

export function locationComparison(
  fixture: OrgFixture,
  org: MockOrganization,
): readonly LocationComparisonRow[] {
  return org.locations.map((loc): LocationComparisonRow => {
    const reviews = fixture.publishedReviews.filter((r) => r.locationId === loc.id);
    const ratingSum = reviews.reduce((acc, r) => acc + r.rating, 0);

    const requests = fixture.reviewRequests.filter((r) => r.locationId === loc.id);
    const asked = requests.filter((r) =>
      ['asked', 'agreed', 'link_sent', 'posted', 'declined', 'opt_out'].includes(r.status),
    ).length;
    const agreed = requests.filter((r) => ['agreed', 'link_sent', 'posted'].includes(r.status)).length;

    return {
      locationId: loc.id,
      locationName: loc.name,
      rating: ratio(ratingSum, reviews.length),
      attributedThisMonth: reviews.filter((r) => r.attributed && isThisMonth(r.atUtc)).length,
      agreementRate: ratio(agreed, asked),
    };
  });
}

/** True when there is any published-review or review-request activity in scope. */
export function hasReviewsData(fixture: OrgFixture, session: Session): boolean {
  return (
    scopeToLocation(fixture.publishedReviews, session).length > 0 ||
    scopeToLocation(fixture.reviewRequests, session).length > 0
  );
}
