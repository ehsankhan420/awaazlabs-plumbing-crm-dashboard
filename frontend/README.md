# Plumbing Automation Dashboard

The operations dashboard for a plumbing business's AI automation: jobs, dispatch, customer
conversations, escalations, agent performance, and admin settings across multiple locations.

This is a **self-contained frontend**. It has no backend, no authentication service, and no
network calls — every page runs on deterministic mock data so the whole product is
explorable offline. The data layer is structured so real APIs can be wired in later without
touching the pages.

## Local development

```bash
npm install
npm run dev
```

Then open [http://localhost:3001](http://localhost:3001). No environment variables and no
`.env` file are required (see `.env.example`).

## How it works

- **Mock data** lives in `src/mock/` — org fixtures (`orgs.ts`), the domain schema
  (`schema.ts`), and a deterministic generator (`fixtures/generate.ts`) anchored to a fixed
  "now" so charts and counts are stable across reloads.
- **Data access** (`src/mock/data-access.ts`) projects fixtures into role-gated views. The
  session (active org, location filter, role) is a pure local mock in
  `src/shared/session-context.tsx`; switch org and role from the top bar's user menu.
- **The live layer** (`src/lib/dashboard-live.ts`) is a mock adapter that reads the fixtures
  and holds an in-memory overlay for mutations (status changes, notes, escalation actions),
  so interactions persist for the session. It keeps the same fetch/cache/hook shape a real
  API would use (`src/hooks/use-dashboard-live.ts`, `src/lib/dashboard-cache.ts`).

## Product areas

Overview, Jobs, Dispatch Queue, Conversations (Calls / Chats), Escalations, Agents
(Receptionist, Dispatch, Chat, Review Taker, Reengagement), Quality, Knowledge, Reviews,
Campaigns, Reports, Audit Log, and Settings (Organization & Locations, Members,
Notifications, Lines & Numbers, Consent, Billing).

Roles: `OWNER_ADMIN`, `MANAGER`, `DISPATCHER`, `VIEWER`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server on port 3001 |
| `npm run build` | Production build |
| `npm start` | Serve the production build on port 3001 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Connecting a real backend later

Replace the fetchers in `src/lib/dashboard-live.ts` with real HTTP calls that return the same
view shapes from `src/mock/data-access.ts`. The pages, hooks, and cache layer consume those
shapes and need no changes.
