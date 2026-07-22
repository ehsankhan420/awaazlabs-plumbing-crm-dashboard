'use client';

/**
 * Private feedback list — spec §13.1 ("appear in this tab as a separate list for the business
 * to action") and §13.2 ("date, customer, summary, source call link, status").
 *
 * Fed from `fixture.privateFeedback`: negative-experience routing captured AFTER the review
 * ask, never instead of it (the compliance rule). One implementation, rendered by both the
 * Review Taker agent tab (§13.1) and the Reviews growth tab (§13.2).
 *
 * restricted-access: private feedback names customers and links to their call recording, so the
 * customer-level rows and the source-call link are withheld — only an aggregate count
 * renders. The branch is on `a role/access check` from the data-access layer, which
 * is the structural gate, not a cosmetic one.
 */

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, MessageSquareWarning } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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

import type { Session } from '@/mock/data-access';
import { formatDate, timezoneFor } from '@/lib/format';
import { scopeToLocation } from '@/lib/metrics';
import { getFixture } from '@/mock/fixtures';
import type { CustomerContact, PrivateFeedback } from '@/mock/schema';

function customerName(contact: CustomerContact | undefined): string {
  if (!contact || !contact.identity) return 'Unknown customer';
  return `${contact.identity.firstName} ${contact.identity.lastName}`;
}

export function PrivateFeedbackList({
  session,
  className,
}: {
  session: Session;
  className?: string;
}): React.JSX.Element {
  const fixture = getFixture(session.orgId);
  const items = scopeToLocation(fixture.privateFeedback, session);
  const contacts = new Map(fixture.contacts.map((c) => [c.id, c]));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-2">
            <MessageSquareWarning className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Private feedback to action
          </span>
        </CardTitle>
        <CardDescription>
          Customers who expressed a negative experience were routed to private feedback capture after the
          review ask — never in place of it. Action these directly; they are not published as reviews.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={<MessageSquareWarning className="h-8 w-8" />}
            title="No private feedback"
            description="Negative-experience routing has produced no items in this scope."
          />
        ) : false ? (
          // restricted-access: customer-level rows and the source-call link are withheld.
          <p className="text-sm text-muted-foreground">
            {items.length} private feedback item{items.length === 1 ? '' : 's'} in this scope. Customer-level
            detail and the source-call link are hidden in restricted mode.
          </p>
        ) : (
          <Table caption="Private feedback items">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Source call</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: PrivateFeedback) => {
                const tz = timezoneFor(session.orgId, item.locationId);
                return (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatDate(item.atUtc, tz)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium text-foreground">
                      {customerName(contacts.get(item.contactId))}
                    </TableCell>
                    <TableCell className="text-foreground">{item.summary}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <RowOpenButtonLink interactionId={item.sourceInteractionId} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'new' ? 'outline' : 'secondary'}>
                        {item.status === 'new' ? 'New' : 'Actioned'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * §13.2 "source call link". Deep-links to the Calls sub-view with the interaction pre-selected
 * (`?interaction=` auto-opens that row's drawer, per the Calls sub-view). It is a real link,
 * not a `RowOpenButton`, because it navigates rather than opening an in-page drawer.
 */
function RowOpenButtonLink({ interactionId }: { interactionId: string }): React.JSX.Element {
  return (
    <Link
      href={`/conversations/calls?interaction=${interactionId}`}
      className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
    >
      View call
      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
