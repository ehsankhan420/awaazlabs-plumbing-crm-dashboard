'use client';

/**
 * §16.5 Consent and Do-Not-Call (SETTINGS).
 *
 *  - Suppression list: phone + source of suppression (customer opt-out / manual add /
 *    complaint). The phone numbers are do-not-call numbers — people who asked to be left
 *    alone — so they are ALWAYS rendered masked via the same `maskPhone` used by
 *    `MaskedValue`. The raw `phoneE164` never reaches the DOM.
 *  - Manual add and remove — audited, Owner and Manager. Both route through
 *    `recordConsentListChange`, which throws `PermissionDeniedError` for a Viewer; the UI is
 *    additionally gated on `canEditConsentList`.
 *  - Consent basis field per contact where captured.
 *  - Quiet-hours configuration for outbound calling windows (local demo state).
 *
 * This surface holds phone numbers but NO customer identity, so it survives restricted mode.
 */

import React, { useMemo, useState } from 'react';
import { Clock, PhoneOff, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { canEditConsentList, maskPhone, PermissionDeniedError, recordConsentListChange } from '@/mock/data-access';
import { getFixture } from '@/mock/fixtures';
import { mockNow } from '@/mock/orgs';
import { useSession } from '@/shared/session-context';
import { SUPPRESSION_SOURCE_LABELS, SUPPRESSION_SOURCES } from '@/shared/status-models';
import type { SuppressionSource } from '@/shared/status-models';
import type { SuppressionEntry } from '@/mock/schema';

const SOURCE_OPTIONS = SUPPRESSION_SOURCES.map((s) => ({ value: s, label: SUPPRESSION_SOURCE_LABELS[s] }));

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { value: String(h), label: `${h12}:00 ${period}` };
});

export function ConsentClient() {
  const { session } = useSession();
  const fixture = getFixture(session.orgId);
  const canEdit = canEditConsentList(session);

  const [entries, setEntries] = useState<readonly SuppressionEntry[]>(fixture.suppressionList);
  const [newPhone, setNewPhone] = useState('');
  const [newSource, setNewSource] = useState<SuppressionSource>('manual_add');
  const [newBasis, setNewBasis] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Quiet-hours config — local demo state; fixtures carry no quiet-hours field.
  const [quietStart, setQuietStart] = useState('21');
  const [quietEnd, setQuietEnd] = useState('8');

  const startLabel = useMemo(() => HOUR_OPTIONS.find((o) => o.value === quietStart)?.label ?? '', [quietStart]);
  const endLabel = useMemo(() => HOUR_OPTIONS.find((o) => o.value === quietEnd)?.label ?? '', [quietEnd]);

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const raw = newPhone.trim();
    if (raw === '') return;
    const masked = maskPhone(raw);
    try {
      recordConsentListChange(session, masked, 'add');
      const entry: SuppressionEntry = {
        id: `sup_local_${entries.length + 1}_${masked.slice(-4)}`,
        phoneE164: raw,
        source: newSource,
        addedAtUtc: mockNow().toISOString(),
        consentBasis: newBasis.trim() === '' ? null : newBasis.trim(),
      };
      setEntries((prev) => [entry, ...prev]);
      setNewPhone('');
      setNewBasis('');
      setNewSource('manual_add');
      setError(null);
    } catch (e) {
      setError(e instanceof PermissionDeniedError ? 'Adding to the suppression list is not permitted.' : 'Unable to add.');
    }
  };

  const handleRemove = (entry: SuppressionEntry) => {
    const masked = maskPhone(entry.phoneE164);
    try {
      recordConsentListChange(session, masked, 'remove');
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setError(null);
    } catch (e) {
      setError(e instanceof PermissionDeniedError ? 'Removing from the suppression list is not permitted.' : 'Unable to remove.');
    }
  };

  const displayTz = useMemo(() => {
    const loc = fixture.org.locations[0];
    return loc?.timezone ?? 'UTC';
  }, [fixture.org.locations]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Consent and Do-Not-Call"
        description="The suppression list checked before every outbound dial, plus quiet-hours for outbound calling. Numbers are masked; add and remove are audited."
      />

      {error ? (
        <Banner variant="destructive" title="Action failed">
          {error}
        </Banner>
      ) : null}

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Add to suppression list</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleAdd}>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">Phone number</span>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground tabular-nums"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">Source</span>
                <Select
                  aria-label="Suppression source"
                  value={newSource}
                  onValueChange={(v) => setNewSource(v as SuppressionSource)}
                  options={SOURCE_OPTIONS}
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">Consent basis (optional)</span>
                <input
                  type="text"
                  value={newBasis}
                  onChange={(e) => setNewBasis(e.target.value)}
                  placeholder="e.g. SMS STOP received"
                  className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                />
              </label>
              <Button type="submit">
                <span className="inline-flex items-center gap-1.5">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add
                </span>
              </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              The number is masked before it is stored or audited. Adds and removes are recorded to
              the audit log.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Banner variant="default">
          You have read-only access to the suppression list. Adding and removing numbers is limited
          to Owner and Manager roles.
        </Banner>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Suppression list</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <EmptyState
              icon={<PhoneOff className="h-8 w-8" />}
              title="No suppressed numbers"
              description="Numbers that opt out, are manually added, or are flagged by a complaint will appear here."
            />
          ) : (
            <Table caption="Suppressed phone numbers with source and consent basis">
              <TableHeader>
                <TableRow>
                  <TableHead>Phone (masked)</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Consent basis</TableHead>
                  <TableHead>Added</TableHead>
                  {canEdit ? <TableHead>Action</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium text-foreground tabular-nums">
                      {maskPhone(entry.phoneE164)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{SUPPRESSION_SOURCE_LABELS[entry.source]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.consentBasis ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(entry.addedAtUtc, displayTz)}</TableCell>
                    {canEdit ? (
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Remove ${maskPhone(entry.phoneE164)} from the suppression list`}
                          onClick={() => handleRemove(entry)}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Remove
                          </span>
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Quiet hours for outbound calling
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-foreground">
            Outbound agents will not dial between{' '}
            <span className="font-medium tabular-nums">{startLabel}</span> and{' '}
            <span className="font-medium tabular-nums">{endLabel}</span> (location local time).
          </p>
          {canEdit ? (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">Quiet start</span>
                <Select
                  aria-label="Quiet hours start"
                  value={quietStart}
                  onValueChange={setQuietStart}
                  options={HOUR_OPTIONS}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">Quiet end</span>
                <Select
                  aria-label="Quiet hours end"
                  value={quietEnd}
                  onValueChange={setQuietEnd}
                  options={HOUR_OPTIONS}
                />
              </label>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Quiet-hours configuration is read-only for your role.</p>
          )}
          <p className="text-xs text-muted-foreground">
            Quiet-hours configuration is local demo state and is not persisted.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
