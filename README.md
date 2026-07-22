# Plumbing Automation Dashboard

The operations dashboard for a plumbing business's AI automation. It brings day-to-day
work into one place for multi-location plumbing companies: jobs, dispatch, customer
conversations, escalations, agent performance, reviews, campaigns, reporting, and admin
settings.

The application is a **self-contained Next.js frontend** that runs entirely on realistic
mock data — no backend, no authentication service, and no network calls. Its data layer is
structured so real APIs can be connected later without changing the pages.

## Repository layout

```text
AwaazLabs-client-Dashboard/
|-- frontend/    Next.js dashboard app (the entire product)
`-- README.md    this file
```

The whole product lives in `frontend/`. There is no backend, service layer, or auth
project — the dashboard is a self-contained frontend running on mock data.

## Product areas

- Overview
- Jobs
- Dispatch Queue
- Conversations (Calls / Chats)
- Escalations
- Agents (Receptionist, Dispatch, Chat, Review Taker, Reengagement)
- Quality
- Knowledge
- Reviews
- Campaigns
- Reports
- Audit Log
- Settings (Organization & Locations, Members, Notifications, Lines & Numbers, Consent,
  Billing)

Roles: `OWNER_ADMIN`, `MANAGER`, `DISPATCHER`, `VIEWER`.

## Local development

Requirements: Node.js `>=20.9.0`.

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). No environment variables are required.

Useful scripts (run from `frontend/`):

- `npm run dev` — development server
- `npm run build` — production build
- `npm start` — serve the production build
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`

## Mock data

The dashboard runs on deterministic fixtures under `frontend/src/mock/`. Two organizations
are provided (a three-location company and a single-location one) so multi-location and
single-location behavior can both be exercised. Switch organization and role from the top
bar's user menu. Workflow actions (status changes, notes, escalation handling) persist in an
in-memory overlay for the duration of the session.

See [frontend/README.md](./frontend/README.md) for the data-layer details and for how to
connect a real backend later.

## Verification

```bash
cd frontend
npm run typecheck
npm run lint
npm run build
```
