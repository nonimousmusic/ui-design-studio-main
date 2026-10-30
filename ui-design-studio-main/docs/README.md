# Documentation Index

AICTE Smart FDR Lifecycle Management Portal — SIH26265.

All project knowledge lives here. `memory.md` at the repository root is the living
implementation log; this folder is the durable specification.

| Document                                     | Purpose                                                     |
| -------------------------------------------- | ----------------------------------------------------------- |
| [BUILD_PLAN.md](./BUILD_PLAN.md)             | Phased execution plan, deliverables, exit criteria          |
| [PRD_TRACEABILITY.md](./PRD_TRACEABILITY.md) | SIH requirement → feature → route → acceptance test         |
| [ARCHITECTURE.md](./ARCHITECTURE.md)         | Stack, frontend structure, target backend, boundaries       |
| [DATA_MODEL.md](./DATA_MODEL.md)             | Entities, relationships, state machines, permission matrix  |
| [UI_SPEC.md](./UI_SPEC.md)                   | Routes, navigation, components, design system               |
| [TEST_PLAN.md](./TEST_PLAN.md)               | Acceptance tests AC-01…AC-12 and demo verification          |
| [RUNBOOK.md](./RUNBOOK.md)                   | Local setup, build, demo walkthrough, reset, deploy         |
| [DECISIONS.md](./DECISIONS.md)               | Architecture decision records                               |
| [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)     | Supabase scaffold status, safe linking and local validation |

## Current milestone

**Phase 0 — Standalone foundation: complete**
**Phase 1 — Frontend completion: complete (clickable, data-backed prototype)**
**Phase 2 — Supabase foundation: local schema/RLS scaffold started; not deployed**

The frontend runs entirely on an in-browser demo store seeded with synthetic data.
Persistence uses `localStorage`; no real bank, AICTE, or payment integration exists.
Every simulated result is labelled.

The Supabase CLI scaffold and initial tenant-scoped schema migration are in `supabase/`.
Direct client writes are intentionally disabled until audited server-side RPCs are built.
No Supabase project has been linked and no remote project has been changed.

## Non-negotiables

- Maturity ≠ release eligibility.
- Documentary review ≠ bank confirmation.
- No automatic approval, NOC, or money movement.
- Institution A can never read Institution B's records.
- Audit history is append-only in the UI.
- Synthetic data only; never commit real institution documents or identifiers.
