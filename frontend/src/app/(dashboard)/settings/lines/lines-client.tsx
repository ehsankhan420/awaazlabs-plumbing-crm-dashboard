'use client';

/**
 * §16.5 Lines and Numbers (SETTINGS).
 *
 *  - One row per known agent (Receptionist, Dispatch Agent, Chat Agents, Review Taker,
 *    Reengagement — the same five §3 nav tabs; Verifier is a real agent per §10.1 but has no
 *    nav tab, so it is not shown here either), per location. Each row is sourced server-side
 *    from whichever real table best represents that agent's activity — never a fixture. See
 *    `dashboard-api/lines.ts` for exactly which table backs each agent.
 *  - `number`/`channel`/`last active` are shown as "-" wherever no real signal exists for that
 *    agent (e.g. chat has no phone number; Review Taker/Reengagement have no known channel in
 *    this data model yet) — never fabricated.
 *  - No telephony health-check integration exists yet, so status is reported honestly as
 *    "Not monitored" rather than a fabricated Healthy/Failing signal.
 *  - Escalation forwarding target and recording-consent mode per location are real columns on
 *    the `locations` table.
 */

import React, { useEffect, useState } from 'react';
import { Mic, Phone, MessageCircle, PhoneForwarded } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import { fetchLiveLines, KNOWN_LINE_AGENTS } from '@/lib/dashboard-live';
import type { LiveAgentLine, LiveLinesSnapshot, LiveLocationConfig } from '@/lib/dashboard-live';
import { useSession } from '@/shared/session-context';
import { AGENT_LABELS } from '@/shared/status-models';
import type { RecordingConsentMode } from '@/shared/status-models';

/** No shipped *_LABELS map exists for RecordingConsentMode; these are display strings only. */
const CONSENT_MODE_LABELS: Readonly<Record<RecordingConsentMode, string>> = {
  one_party: 'One-party consent',
  two_party: 'Two-party consent',
};

const DASH = '–';

function ChannelCell({ kind }: { kind: LiveAgentLine['kind'] }) {
  if (kind === 'voice') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Phone className="h-4 w-4" aria-hidden="true" />
        Voice
      </span>
    );
  }
  if (kind === 'chat') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        Chat
      </span>
    );
  }
  return <span className="text-muted-foreground">{DASH}</span>;
}

function LocationLines({ location, lines }: { location: LiveLocationConfig; lines: readonly LiveAgentLine[] }) {
  const byAgent = new Map(lines.map((line) => [line.agent, line]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{location.name}</CardTitle>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <span className="inline-flex items-center gap-2">
            <Mic className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">Recording consent</span>
            <span className="font-medium text-foreground">
              {CONSENT_MODE_LABELS[location.recordingConsentMode]}
            </span>
          </span>
          <span className="inline-flex items-center gap-2">
            <PhoneForwarded className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">Escalation forwarding</span>
            <span className="font-medium text-foreground tabular-nums">
              {location.escalationForwardingNumber ?? 'Not set'}
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <Table caption={`Agent lines for ${location.name}`}>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead>Interactions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {KNOWN_LINE_AGENTS.map((agent) => {
              const line = byAgent.get(agent);
              return (
                <TableRow key={agent}>
                  <TableCell className="font-medium text-foreground">{AGENT_LABELS[agent]}</TableCell>
                  <TableCell className="tabular-nums text-foreground">{line?.number ?? DASH}</TableCell>
                  <TableCell>
                    <ChannelCell kind={line?.kind ?? null} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">Not monitored</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {line?.lastActiveUtc ? formatDateTime(line.lastActiveUtc, location.timezone) : DASH}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {line?.interactionCount ?? 0}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function LinesClient() {
  const { session } = useSession();
  const [snapshot, setSnapshot] = useState<LiveLinesSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLiveLines(session)
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load connected numbers.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const linesByLocation = new Map<string, LiveAgentLine[]>();
  for (const line of snapshot?.lines ?? []) {
    const list = linesByLocation.get(line.locationId) ?? [];
    list.push(line);
    linesByLocation.set(line.locationId, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lines and Numbers"
        description="Per-agent connected numbers and activity, derived from call and chat data, plus escalation forwarding and recording-consent mode."
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading connected numbers…</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : snapshot && snapshot.locations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No locations configured yet.</p>
      ) : (
        (snapshot?.locations ?? []).map((location) => (
          <LocationLines key={location.id} location={location} lines={linesByLocation.get(location.id) ?? []} />
        ))
      )}
    </div>
  );
}
