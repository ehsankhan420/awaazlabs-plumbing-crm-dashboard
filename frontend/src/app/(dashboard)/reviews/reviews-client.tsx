'use client';

/**
 * §13.2 REVIEWS (GROWTH) tab — the outcome surface for reputation.
 *
 * This is NOT an agent tab: it does not render through the §2.6 agent template. It reports
 * outcomes of the Review Taker agent only. By deliberate scope (spec §13.2) it is NOT a
 * reputation-management suite — there is no review responding, no listings management and no
 * social publishing anywhere on this surface.
 *
 * Everything here is aggregate/public (ratings, review counts), so it renders in restricted-access
 * mode; the single identity-sensitive element, the private-feedback list, gates itself internally.
 */

import React from 'react';
import { ExternalLink, Star } from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart } from '@/components/charts/bar-chart';
import { LineChart } from '@/components/charts/line-chart';
import { REVIEW_ATTRIBUTION_SERIES } from '@/components/charts/series-map';
import { formatCount, formatDate, formatPercent, timezoneFor } from '@/lib/format';
import { getFixture } from '@/mock/fixtures';
import { isMultiLocation } from '@/mock/schema';
import { useSession } from '@/shared/session-context';

import { PrivateFeedbackList } from './private-feedback-list';
import {
  hasReviewsData,
  locationComparison,
  ratingTrend,
  recentAttributedReviews,
  reviewsOverTime,
} from './reviews-analytics';

const WEEKS = 12;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold tracking-tight text-foreground">{children}</h2>;
}

function pct(rate: number | null): string {
  return rate === null ? '—' : formatPercent(rate);
}

export function ReviewsClient(): React.JSX.Element {
  const { session, org } = useSession();
  const fixture = getFixture(session.orgId);

  // Trend labels render in a location's timezone (§2.7). Scope to the filtered location if
  // one is set, otherwise fall back to the org's first location.
  const trendTimeZone = timezoneFor(session.orgId, session.locationId ?? org.locations[0].id);

  const trend = ratingTrend(fixture, session, WEEKS, trendTimeZone);
  const overTime = reviewsOverTime(fixture, session, WEEKS, trendTimeZone);
  const recent = recentAttributedReviews(fixture, session);
  const comparison = locationComparison(fixture, org);

  if (!hasReviewsData(fixture, session)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Reviews"
          description="Reputation outcomes from the Review Taker agent."
        />
        <EmptyState
          icon={<Star className="h-8 w-8" />}
          title="No reviews yet"
          description="There is no published-review or review-request activity in this scope, so there are no reputation outcomes to report."
        />
      </div>
    );
  }

  const goLiveMarkers =
    trend.goLiveIndex !== null ? [{ x: trend.goLiveIndex, label: 'Review agent go-live' }] : [];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Reviews"
        description="Reputation outcomes from the Review Taker agent. Outcomes only — not a reputation-management suite."
      />

      {/* Rating trend with the go-live annotation */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Rating trend</SectionHeading>
        <LineChart
          title="Google rating over time"
          description="Cumulative average rating. The ringed point marks when the review agent went live."
          xLabels={trend.labels}
          series={[
            {
              key: 'rating',
              label: 'Google rating',
              color: 'var(--chart-1)',
              values: trend.values,
            },
          ]}
          markers={goLiveMarkers}
          formatValue={(v) => v.toFixed(1)}
          footnote={
            trend.goLiveIndex !== null
              ? `Review agent went live in the week of ${trend.labels[trend.goLiveIndex]}.`
              : undefined
          }
          tableData={{
            columns: ['Week', 'Rating'],
            rows: trend.labels.map((l, i) => [
              l,
              trend.values[i] === null ? '—' : (trend.values[i] as number).toFixed(1),
            ]),
          }}
        />
      </section>

      {/* Attributed vs organic reviews over time */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Reviews over time</SectionHeading>
        <BarChart
          title="Attributed vs organic reviews"
          description="New reviews per week, split by whether they were attributed to the Review Taker agent."
          variant="stacked"
          xLabels={overTime.labels}
          series={[
            {
              key: 'attributed',
              label: 'Attributed',
              color: REVIEW_ATTRIBUTION_SERIES.attributed,
              values: overTime.attributed,
            },
            {
              key: 'organic',
              label: 'Organic',
              color: REVIEW_ATTRIBUTION_SERIES.organic,
              values: overTime.organic,
            },
          ]}
          showStackTotals
          formatValue={(v) => formatCount(v)}
          tableData={{
            columns: ['Week', 'Attributed', 'Organic'],
            rows: overTime.labels.map((l, i) => [
              l,
              String(overTime.attributed[i]),
              String(overTime.organic[i]),
            ]),
          }}
        />
      </section>

      {/* Recent attributed reviews */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Recent attributed reviews</SectionHeading>
        <Card>
          <CardContent className="pt-6">
            {recent.length === 0 ? (
              <EmptyState
                icon={<Star className="h-8 w-8" />}
                title="No attributed reviews yet"
                description="No published reviews have been attributed to the agent in this scope."
              />
            ) : (
              <Table caption="Recent attributed reviews">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Excerpt</TableHead>
                    <TableHead>Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((r) => {
                    const tz = timezoneFor(session.orgId, r.locationId);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                          {formatDate(r.atUtc, tz)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-medium tabular-nums text-foreground">
                            <Star className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                            {r.rating.toFixed(1)}
                            <span className="sr-only"> out of 5 stars</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-foreground">{r.excerpt}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
                          >
                            View live review
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Private feedback (gates itself in restricted-access) */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Private feedback</SectionHeading>
        <PrivateFeedbackList session={session} />
      </section>

      {/* Per-location comparison — multi-location only */}
      {isMultiLocation(org) ? (
        <section className="flex flex-col gap-4">
          <SectionHeading>Location comparison</SectionHeading>
          <Card>
            <CardHeader>
              <CardTitle>Reputation by location</CardTitle>
              <CardDescription>
                Rating, attributed reviews this month, and agreement rate for each location.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table caption="Reputation outcomes by location">
                <TableHeader>
                  <TableRow>
                    <TableHead>Location</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Attributed reviews (this month)</TableHead>
                    <TableHead>Agreement rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.map((row) => (
                    <TableRow key={row.locationId}>
                      <TableCell className="whitespace-nowrap font-medium text-foreground">
                        {row.locationName}
                      </TableCell>
                      <TableCell className="tabular-nums text-foreground">
                        {row.rating === null ? '—' : row.rating.toFixed(1)}
                      </TableCell>
                      <TableCell className="tabular-nums text-foreground">
                        {formatCount(row.attributedThisMonth)}
                      </TableCell>
                      <TableCell className="tabular-nums text-foreground">{pct(row.agreementRate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
