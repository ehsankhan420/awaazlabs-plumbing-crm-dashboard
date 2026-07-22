'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { Session } from '@/mock/data-access';
import { recordLoginEvent, setAuditIdentity } from '@/lib/audit-live';
import { ALL_ORGS, DEFAULT_ORG_ID, getOrgById } from '@/mock/orgs';
import { getFixture } from '@/mock/fixtures';
import { isMultiLocation } from '@/mock/schema';
import type { MockOrganization } from '@/mock/schema';
import type { Role } from '@/shared/status-models';

/**
 * Frontend-only build: the session is a local mock. The demo controls in the user menu
 * switch role and organization; in a real deployment both arrive with the
 * authenticated session and none of this is self-serve.
 */
export const DEMO_CONTROLS_ENABLED = true;

interface SessionContextValue {
  readonly session: Session;
  readonly org: MockOrganization;
  readonly orgs: readonly MockOrganization[];
  readonly showLocationFilter: boolean;
  readonly authenticatedRole: Role;
  readonly setRole: (role: Role) => void;
  readonly setOrgId: (orgId: string) => void;
  readonly setLocationId: (locationId: string | null) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = 'plumbing-dashboard.session';

interface PersistedSession {
  orgId?: string;
  role?: Role;
  locationId?: string | null;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}

function readPersisted(): PersistedSession {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const p = parsed as PersistedSession;
    const out: PersistedSession = {};
    if (typeof p.orgId === 'string' && getOrgById(p.orgId)) out.orgId = p.orgId;
    if (p.role === 'OWNER_ADMIN' || p.role === 'MANAGER' || p.role === 'DISPATCHER' || p.role === 'VIEWER') {
      out.role = p.role;
    }
    if (p.locationId === null || typeof p.locationId === 'string') out.locationId = p.locationId;
    return out;
  } catch {
    return {};
  }
}

/** The signed-in actor is the org's owner member, so audit rows carry a real name. */
function actorFor(orgId: string, role: Role): string {
  try {
    const fixture = getFixture(orgId);
    const member = fixture.members.find((m) => m.role === role) ?? fixture.members[0];
    return member?.name ?? 'Dashboard User';
  } catch {
    return 'Dashboard User';
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [orgId, setOrgIdState] = useState<string>(DEFAULT_ORG_ID);
  const [role, setRoleState] = useState<Role>('OWNER_ADMIN');
  const [locationId, setLocationIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const loginRecorded = React.useRef(false);

  React.useEffect(() => {
    const p = readPersisted();
    if (p.orgId) setOrgIdState(p.orgId);
    if (p.role) setRoleState(p.role);
    if (typeof p.locationId !== 'undefined') setLocationIdState(p.locationId);
    setHydrated(true);
  }, []);

  const org = getOrgById(orgId) ?? getOrgById(DEFAULT_ORG_ID)!;
  const scopedLocationId = org.locations.some((l) => l.id === locationId) ? locationId : null;
  const actor = actorFor(org.id, role);

  const session = useMemo<Session>(
    () => ({ actor, role, orgId: org.id, locationId: scopedLocationId }),
    [actor, role, org.id, scopedLocationId],
  );

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: PersistedSession = { orgId, role, locationId };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage failures.
    }
  }, [hydrated, orgId, role, locationId]);

  React.useEffect(() => {
    setAuditIdentity(actor, role);
  }, [actor, role]);

  React.useEffect(() => {
    if (loginRecorded.current) return;
    loginRecorded.current = true;
    recordLoginEvent().catch(() => undefined);
  }, []);

  const setLocationId = useCallback((next: string | null) => setLocationIdState(next), []);
  const setRole = useCallback((next: Role) => {
    if (!DEMO_CONTROLS_ENABLED) return;
    setRoleState(next);
  }, []);
  const setOrgId = useCallback((next: string) => {
    if (!getOrgById(next)) return;
    setOrgIdState(next);
    setLocationIdState(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      org,
      orgs: ALL_ORGS,
      showLocationFilter: isMultiLocation(org),
      authenticatedRole: role,
      setRole,
      setOrgId,
      setLocationId,
    }),
    [session, org, role, setRole, setOrgId, setLocationId],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
