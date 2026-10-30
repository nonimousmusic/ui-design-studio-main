# Architecture Decisions

## ADR-001 — Use the upstream standalone toolchain

**Status:** accepted · **Phase 0**

Use upstream Vite plugins (`@tanstack/react-start/plugin/vite`, `@vitejs/plugin-react`,
`@tailwindcss/vite`, `vite-tsconfig-paths`) and remove editor-specific configuration,
telemetry, branding, and lockfile references. The repository must be reproducible on its own.

Consequence: we own the Vite configuration and must verify the build; there is no external editor sync.

## ADR-002 — Obligation-first domain model

**Status:** accepted · **Phase 1**

A `DepositObligation` is the parent; instruments are evidence. This prevents a matured
FDR from being treated as the regulatory requirement itself.

## ADR-003 — Clickable frontend before backend

**Status:** accepted · **Phase 1**

The hackathon demo needs a coherent end-to-end story before database plumbing. A typed
seed + store gives realistic behavior while keeping the Phase 2 migration mechanical.
The UI labels all synthetic/simulated elements and never claims real verification.

## ADR-004 — Fixed demo clock

**Status:** accepted · **Phase 1**

`DEMO_TODAY = 2026-10-30` keeps maturity/SLA calculations stable for judging and
screenshots. The future backend uses the real server clock in Asia/Kolkata.

## ADR-005 — Browser-local persistence for the demo

**Status:** accepted · **Phase 1**

State persists under `aicte-fdr-*` keys so refresh keeps submitted records. Providers
initialize from seed for SSR/hydration parity, then hydrate from storage in an effect.
Reset is explicit and auditable. This is not a security boundary.

## ADR-006 — Role gates in the UI are demonstrative only

**Status:** accepted · **Phase 1**

The client hides actions by role and shows scope-denied panels, but real enforcement
must live in server functions + RLS. AC-09 remains a backend acceptance item.

## ADR-007 — No automatic release on maturity

**Status:** accepted · **Phase 1+**

Bank maturity and regulatory hold end are separate fields. Release requires checklist,
mandatory clearances, and a delegated human decision. A matured instrument can remain
`MATURED` indefinitely.

## ADR-008 — Simulated external responses are a first-class provenance

**Status:** accepted · **Phase 1+**

`SIMULATED_BANK_RESPONSE` is distinct from `BANK_CONFIRMED_AUTHORIZED`. The UI shows a
dashed SIMULATED tag and the audit event records the adapter mode. Promotion is forbidden
without an authorized bank-origin proof.

## ADR-009 — Versioned policy, pinned evaluations

**Status:** accepted · **Phase 1+**

Every obligation references a `PolicyVersion`. Changing rules creates a new version;
existing cases retain their pinned evaluation (AC-12). Amounts/holding periods are never
hardcoded in UI copy.

## ADR-010 — P1 OCR is deliberately absent

**Status:** accepted · **Phase 1**

OCR/AI prefill adds demo risk without strengthening the P0 story. The submission wizard
is fully manual with deterministic checks. OCR will be added after P0 acceptance is green,
with per-field confidence and mandatory human confirmation.

## ADR-011 — Docs-as-code

**Status:** accepted · **Phase 0+**

Durable specifications live in `/docs`; `memory.md` is the living log of what changed,
what is verified, and what is next. Any behavior change updates both.
