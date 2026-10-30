# AICTE Smart FDR Portal

A clickable, role-aware frontend prototype for the AICTE Smart FDR clearance and
release workflow (problem statement SIH26265). The prototype turns the enhanced
PRD into a working demo: institution onboarding, obligation-first submissions,
documentary scrutiny, renewal chains, release gates, alerts, reports and an
append-only audit trail.

All data is synthetic and lives in the browser. There is no backend, no bank
connection, no money movement and no automatic approval.

## Stack

- TanStack Start + TanStack Router (file-based routes)
- React 19 + TypeScript (strict, `exactOptionalPropertyTypes`)
- Tailwind CSS v4 + shadcn/ui primitives
- Recharts for scoped reporting charts
- Vitest + Testing Library
- Bun for install and scripts

## Run locally

```sh
bun install
bun run dev
```

Open <http://localhost:8080>. Pick a demo persona on the sign-in screen.

Other scripts:

```sh
bun run build     # production build (also regenerates routeTree.gen.ts)
bun run test      # unit/component tests
bun run lint      # ESLint and Prettier checks
bun run format    # Prettier write
```

## Demo personas

| Persona             | Role                      | Scope                              |
| ------------------- | ------------------------- | ---------------------------------- |
| P. Sharma           | Institution administrator | Shri Ram Institute of Technology   |
| M. Krishnan         | Institution administrator | Kaveri Institute of Management     |
| A. Mehta            | Case officer              | All institutions                   |
| R. Iyer             | Clearance reviewer        | All institutions, clearances only  |
| S. Rao              | Decision authority        | Delegated release decisions        |
| System Admin        | System administrator      | Directory, policy, demo reset      |
| Auditor (read-only) | Auditor                   | Read-only across permitted records |

The fixed demo clock is **30 October 2026** so maturity, SLA and alert
thresholds stay deterministic.

## Guardrails

- Maturity is an instrument event; it is never release eligibility.
- Documentary review is not bank confirmation.
- An approved release produces a **proposed** NOC or sanction-order record. No
  NOC is issued and no money moves.
- Tenant scope is enforced in selectors for the demo and documented as a
  backend requirement for production.
- Audit events are append-only in the application; production must deny
  update/delete grants at the database layer.

## Project map

```
src/
  components/        shared portal UI and shadcn primitives
  lib/
    types.ts         domain types, enums, state machines
    seed.ts          synthetic demo dataset
    store.tsx        lifecycle actions, persistence, audit
    selectors.ts     scoping, permissions, KPIs, blockers
    session.tsx      demo personas and sign-in
    format.ts        dates, currency, CSV, hashing helpers
  routes/            all screens (login, dashboard, registry, ...)
docs/                build plan, architecture, data model, UI spec, test plan
memory.md            living project state and verification log
```

## Documentation

Start with [`docs/README.md`](docs/README.md). The PRD traceability matrix,
permission model and acceptance walkthrough are in `docs/`.
Supabase scaffold status and safe setup steps are in [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md).

## Status

The frontend prototype is feature-complete for the P0 demo scope. Backend
integration, real identity, object storage, notifications and bank adapters are
deliberately out of scope for this phase and documented in `docs/BUILD_PLAN.md`.
