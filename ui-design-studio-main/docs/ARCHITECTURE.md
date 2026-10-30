# Architecture

## Current (Phase 0–1): frontend-complete prototype

```
Browser
  ├─ TanStack Router (file-based routes)
  ├─ React 19 + Tailwind 4 + shadcn/ui
  ├─ SessionProvider  ── demo personas, localStorage session
  ├─ PortalStore      ── seeded domain state, actions, audit, localStorage
  └─ Selectors        ── role scoping, KPIs, blockers, date maths
```

No server functions are used for domain data yet. All reads/writes happen in the
browser against `src/lib/seed.ts`. This is intentional: the judge sees a complete,
consistent workflow before the database exists.

### Source layout

```
src/
  routes/            file-based screens
    __root.tsx       providers, error boundaries, head metadata
    login.tsx        demo sign-in + account request
    index.tsx        role-scoped overview
    institutions.tsx / institutions.$id.tsx
    registry.tsx / registry.$id.tsx
    submissions.new.tsx
    scrutiny.tsx
    renewals.tsx
    release.tsx / release.$id.tsx
    alerts.tsx
    reports.tsx
    audit.tsx
    admin.tsx
  components/
    portal.tsx       shell, headers, pills, strips, panels, empty states
    charts.tsx       Recharts wrappers
    action-dialog.tsx
    ui/              shadcn primitives (generated)
  lib/
    types.ts         domain types and enums
    seed.ts          synthetic fixture dataset
    store.tsx        PortalProvider + actions + persistence
    session.tsx      SessionProvider + persona sign-in
    selectors.ts     scoping, KPIs, blockers, formatting
    format.ts        INR, dates, checksums, CSV
```

### State flow

1. `__root.tsx` mounts `SessionProvider` and `PortalProvider`.
2. Each provider initialises from seed to keep SSR and hydration identical, then
   hydrates from `localStorage` in an effect.
3. Screens read state through `usePortal()` and derive scoped views via selectors.
4. Mutating actions validate role/state, append an audit event, update related work
   items/alerts, then persist the next snapshot.
5. `resetDemo()` restores the seed and clears the session only on explicit request.

### Timestamps and money

- Demo clock is fixed at **2026-10-30** (`DEMO_TODAY`) for deterministic SLA and
  maturity calculations.
- Date-only values (`YYYY-MM-DD`) are formatted by parsing parts; never shifted by
  the browser timezone.
- Money is integer rupees in fixtures (`NUMERIC(18,2)` in the target schema), formatted
  with `en-IN` grouping.

## Phase 2 scaffold: Supabase database (not yet deployed)

`supabase/migrations/202610300001_initial_schema.sql` establishes the normalized
PostgreSQL entities, same-tenant foreign keys, indexes, role/profile membership
tables, tenant-scoped read policies, and an append-only audit trigger. Browser
roles currently have SELECT only; INSERT/UPDATE/DELETE paths remain closed until
audited, role-checked RPCs/server functions exist. The migration has not yet been
applied to a local or hosted database because Docker is unavailable and no target
project has been selected.

The migration uses database UUIDs. A future adapter will map these rows to the
prototype's prefixed string IDs; the existing localStorage prototype remains the
active app data source until auth and server actions are ready.

## Target (Phase 2+): trusted backend

```
TanStack Start server functions / route handlers
  └─ Domain service (single transaction boundary)
       ├─ authorization + tenant scope
       ├─ state transition validation
       ├─ rule engine (versioned)
       └─ audit + work items + outbox
Supabase PostgreSQL (RLS, constraints, indexes)
Supabase Auth (email, sessions, MFA)
Supabase Storage (private buckets, short-lived signed URLs)
Scheduler (daily alerts, idempotent)
Notification outbox (in-app first; email/SMS adapters later)
```

### Non-negotiable backend properties

- Every mutation validates actor, role, tenant, current state, evidence, and policy
  version in one transaction.
- RLS plus server-side checks; UI-only hiding is never sufficient.
- Audit events are append-only; no update/delete grants for application roles.
- Signed URLs are generated server-side after authorization; buckets are private.
- Alerts dedupe on `event + recipient + threshold + policy version`.
- External adapters are versioned and default to `MOCK`; a simulated response is
  never stored as `BANK_CONFIRMED_AUTHORIZED`.

## Integration boundaries

| Adapter           | Current                                  | Authorized future                                 |
| ----------------- | ---------------------------------------- | ------------------------------------------------- |
| Bank verification | Deterministic simulation, explicit badge | Bank-origin API/proof with written authorization  |
| AICTE registry    | Synthetic permanent IDs                  | Approved sync with reconciliation and credentials |
| Documents         | Metadata + SHA-256 in browser            | Private object storage + malware scan             |
| Notifications     | In-app only                              | Email/SMS outbox with retries                     |

## Security posture (prototype)

- No secrets in the client; no service-role key exists yet.
- Demo session and data are browser-local and clearly labelled synthetic.
- Read-only auditor, role gates, scope-denied screens, and decision gates are
  demonstrated in the UI and must be re-enforced server-side.
- No real personal, financial, or document data should be entered.
