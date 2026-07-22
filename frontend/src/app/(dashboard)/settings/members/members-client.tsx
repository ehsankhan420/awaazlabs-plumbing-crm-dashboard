'use client';

/**
 * §16.3 Members (SETTINGS, Owner only).
 *
 * "User list with role, last active, MFA status. Invite by email with role assignment
 * (Owner only). Role changes audited. MFA required for Owner and Manager for elevated-access roles."
 *
 * Everything here is Owner-only by construction: the page is wrapped in
 * `<RouteGuard capability="members">`, and the two mutating actions (role change, invite)
 * additionally route through the data-access layer, which throws `PermissionDeniedError`
 * for any non-Owner. There is no fake email service — invites become an optimistic
 * "pending" row and nothing is sent.
 */

import React, { useMemo, useState } from 'react';
import { Mail, ShieldAlert, ShieldCheck, UserPlus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import { getFixture } from '@/mock/fixtures';
import { PermissionDeniedError, recordPermissionChange } from '@/mock/data-access';
import { useSession } from '@/shared/session-context';
import { ROLE_LABELS, ROLES } from '@/shared/status-models';
import type { Role } from '@/shared/status-models';
import type { Member } from '@/mock/schema';

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

/** §16.3 "MFA required for Owner and Manager for elevated-access roles." */
function requiresMfa(role: Role): boolean {
  return role === 'OWNER_ADMIN' || role === 'MANAGER';
}

interface PendingInvite {
  readonly email: string;
  readonly role: Role;
}

export function MembersClient() {
  const { session, org } = useSession();
  const fixture = getFixture(session.orgId);

  // Fixtures are read-only; role edits live as an optimistic overlay keyed by member id.
  // The audit event written by `recordPermissionChange` is the real record of the change.
  const [roleOverrides, setRoleOverrides] = useState<Readonly<Record<string, Role>>>({});
  const [pendingInvites, setPendingInvites] = useState<readonly PendingInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('VIEWER');
  const [error, setError] = useState<string | null>(null);

  const displayTz = org.locations[0]?.timezone ?? 'UTC';

  const members = useMemo<readonly Member[]>(
    () => fixture.members.map((m) => ({ ...m, role: roleOverrides[m.id] ?? m.role })),
    [fixture.members, roleOverrides],
  );

  const nonCompliantCount = members.filter((m) => requiresMfa(m.role) && !m.mfaEnabled).length;

  const handleRoleChange = (memberId: string, from: Role, to: Role) => {
    if (from === to) return;
    try {
      recordPermissionChange(session, memberId, from, to);
      setRoleOverrides((prev) => ({ ...prev, [memberId]: to }));
      setError(null);
    } catch (e) {
      setError(e instanceof PermissionDeniedError ? 'Role change not permitted.' : 'Unable to change role.');
    }
  };

  const handleInvite = (event: React.FormEvent) => {
    event.preventDefault();
    const email = inviteEmail.trim();
    if (email === '') return;
    setPendingInvites((prev) => [{ email, role: inviteRole }, ...prev]);
    setInviteEmail('');
    setInviteRole('VIEWER');
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Members"
        description="Team members with role, last-active time, and MFA status. Inviting and role changes are Owner-only and audited."
      />

      {error ? (
        <Banner variant="destructive" title="Action failed">
          {error}
        </Banner>
      ) : null}

      {/* §16.3 compliance statement — rendered as a standing rule, not a transient alert. */}
      <Banner
        variant={nonCompliantCount > 0 ? 'destructive' : 'default'}
        title="Multi-factor authentication policy"
      >
        MFA is required for the Owner/Admin and Manager roles.{' '}
        {nonCompliantCount > 0
          ? `${nonCompliantCount} member${nonCompliantCount === 1 ? '' : 's'} in a privileged role ${
              nonCompliantCount === 1 ? 'does' : 'do'
            } not have MFA enabled and ${nonCompliantCount === 1 ? 'is' : 'are'} non-compliant.`
          : 'All privileged members are compliant.'}
      </Banner>

      <Card>
        <CardHeader>
          <CardTitle>Invite a member</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleInvite}>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Email address</span>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@example.com"
                className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Role</span>
              <Select
                aria-label="Role for invited member"
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as Role)}
                options={ROLE_OPTIONS}
              />
            </label>
            <Button type="submit">
              <span className="inline-flex items-center gap-2">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Send invite
              </span>
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            This demo has no email service connected, so no message is actually sent. The invite is
            added below as a pending row to illustrate the flow.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table caption="Organization members with role, last active, and MFA status">
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead>MFA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const nonCompliant = requiresMfa(m.role) && !m.mfaEnabled;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{m.name}</span>
                        <span className="text-xs text-muted-foreground">{m.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        aria-label={`Change role for ${m.name}`}
                        value={m.role}
                        onValueChange={(v) => handleRoleChange(m.id, m.role, v as Role)}
                        options={ROLE_OPTIONS}
                        className="min-w-[10rem]"
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(m.lastActiveUtc, displayTz)}
                    </TableCell>
                    <TableCell>
                      {m.mfaEnabled ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                          Enabled
                        </span>
                      ) : nonCompliant ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-destructive">
                          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                          Not enabled — required
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                          Not enabled
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {pendingInvites.map((invite, i) => (
                <TableRow key={`pending-${i}`} className="bg-muted/20">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span className="text-foreground">{invite.email}</span>
                      <Badge variant="outline">Pending invite</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ROLE_LABELS[invite.role]}</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
