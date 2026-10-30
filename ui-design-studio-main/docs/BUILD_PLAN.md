# Build Plan

This plan converts `AICTE_SIH26265_Enhanced_PRD_v2.md` into ordered, testable
phases. Each phase ends with a demo-able outcome, not merely merged code.

## Guiding decisions

1. **Obligation first, instrument second.** A deposit obligation is the parent case;
   FDR/RTGS/RPGF instruments are evidence attached over time.
2. **Dates are independent.** Bank maturity, regulatory hold end, review SLA, and
   clearance due dates are never collapsed into one status.
3. **Provenance is explicit.** `INSTITUTION_DECLARED`, `OFFICIAL_DOCUMENT_REVIEW`,
   `BANK_CONFIRMED_AUTHORIZED`, `SIMULATED_BANK_RESPONSE`.
4. **Server is the authority.** The UI hides impossible actions, but the backend
   (Phase 2+) must enforce every permission and transition.
5. **Demo honesty.** All synthetic fixtures, simulations, and limitations are visible.

## Phase 0 — Standalone foundation (complete)

**Goal:** an independent, reproducible repository with no generated-editor runtime or branding.

Tasks:

- Remove editor-specific dependencies, hidden configuration, telemetry and metadata.
- Replace the Vite config with direct TanStack Start, React, Tailwind, and TS paths plugins.
- Rewrite README, AGENTS.md, `bunfig.toml`; regenerate the lockfile.
- Establish `/docs` and root `memory.md`.
- Add project identity: AICTE Smart FDR Portal, synthetic-data banner, demo clock.

Exit criteria:

- `bun install && bun run build` succeeds without editor-specific packages.
- No editor-specific runtime dependencies, hidden configuration or branding remain.
- The app boots and routes render.

## Phase 1 — Frontend completion (complete)

**Goal:** every P0 screen exists, is role-aware, responsive, and backed by a
consistent synthetic data store with working in-memory actions and audit events.

Tasks:

- Domain types and seed dataset (5 institutions, obligations, instruments, documents,
  findings, releases, clearances, work items, alerts, policy versions, audit events).
- Demo session provider with seven personas; sign-in page and account request.
- Shared shell: desktop sidebar, mobile sheet navigation, role badge, global search,
  demo clock banner, notification/alert badge.
- Overview: role-scoped KPIs, charts, next-action queue, deadlines, release cases.
- Institutions list and detail with obligations, instruments, release history.
- Registry with multi-filter search, scoped results, CSV export, pagination.
- Instrument detail: overview, documents/versions, verification provenance,
  renewal chain, append-only timeline, scrutiny/accept/return/reject actions.
- New submission: 4-step guided form, deterministic checks, file metadata + SHA-256,
  draft and submit paths, replacement prefill.
- Scrutiny queue: SLA/priority/reason, age, assigned owner, date-monitor demo run.
- Renewal & replacement: side-by-side immutable history, gap detection, pending review.
- Release list + workspace: checklist, per-bureau clearances, blockers, delegated
  decision gate, recorded outcome, audit.
- Alerts: separate date types, acknowledgement, escalation, dedupe explanation.
- Reports: holdings, maturity buckets, status mix, region mix, metric sheet, CSV.
- Audit: scoped filterable log with before/after detail.
- Administration: users/roles, versioned policy rules, demo reset, integration status.
- Guard rails: cross-tenant scope denial, read-only auditor, decision authority gate.

Exit criteria:

- All routes in `docs/UI_SPEC.md` render on desktop and mobile.
- Every action appends an audit event and survives refresh via `localStorage`.
- The AC-01…AC-12 walkthrough can be performed without a backend.
- `bun run build`, `bun run lint`, and `bun run test` pass.

## Phase 2 — Backend foundation and real tenancy (in progress)

**Goal:** replace the demo store with PostgreSQL + identity + enforced authorization.

Tasks:

- Local Supabase CLI scaffold and initial normalized schema/RLS migration (started).
- Select/create the intended Supabase project; do not reuse an unrelated project.
- Validate migrations locally and add RLS isolation tests before any hosted deployment.
- Supabase project, migrations for institutions/profiles/members/scopes/policies.
- Auth: email verification, reset, session expiry, invitation flow, MFA for privileged roles.
- RLS on every institution-owned table; server-side role checks in the domain service.
- Seed script mirroring the frontend fixtures; environment template.
- Negative tests: cross-tenant ID, URL, REST, and signed-file access.

Exit criteria: AC-01, AC-09, AC-10 pass against the real database; no tenant leak.

## Phase 3 — Submission and document vault

- Obligation + instrument CRUD with audited transitions.
- Private storage buckets, MIME/signature/size checks, SHA-256, version sequence.
- Short-lived signed URLs generated server-side; reviewer document statuses.
- Submission → work item → notification outbox in one transaction.

Exit criteria: AC-02, AC-03, AC-11.

## Phase 4 — Scrutiny and verification provenance

- Deterministic rule engine with versioned rule codes and explainable findings.
- Discrepancy resolution, clarification requests, return/reject reasons.
- Bank adapter contract in `MOCK` mode only; simulated label persisted.
- Review queue with SLA ageing and assignment.

Exit criteria: AC-03, AC-04.

## Phase 5 — Monitoring, alerts, renewals

- Daily server scheduler with idempotency keys per event + recipient + threshold.
- Separate maturity / hold-end / workflow date types.
- Renewal chains, cycle prevention, missing-interval detection, immutable history.
- In-app alerts, escalation, delivery retry metadata.

Exit criteria: AC-05, AC-06.

## Phase 6 — Release, clearances, decision

- Release request, configurable checklist and clearance matrix.
- Clearance states including `OBJECTED` / `NOT_APPLICABLE` with evidence.
- Decision gate requires all mandatory clearances plus delegated authority.
- FDR/RPGF NOC record vs RTGS sanction-order record, both marked `PROPOSED`.
- Full audit and institution-visible outcome.

Exit criteria: AC-07, AC-08.

## Phase 7 — Reporting, audit, administration, hardening

- Database-backed dashboards and scoped exports with masking.
- Immutable audit log; auditor read-only.
- Policy version administration and case-level pinned rules (AC-12).
- Structured logs, rate limits, CSRF, replay protection, accessibility pass.
- Performance budget: dashboard < 3s at documented fixture size.

## Phase 8 — Demo readiness

- Hosted URL, seeded credentials, architecture diagram, 6-minute script.
- Record AC-01…AC-12 results; two explicit negative authorization tests.
- Metric sheet with sample size and observed timings; no invented percentages.
- README limitations and authorized-integration roadmap.

## Phase 9 — P1 differentiation (only after P0 is green)

- OCR-assisted prefill with per-field confidence and mandatory human confirmation.
- Scoped exports/cohort analytics; advanced escalations.
- Measured task-time comparison against the manual baseline.

## Work breakdown and ownership

| Track   | Frontend (Phase 0–1)               | Backend (Phase 2–6)                  |
| ------- | ---------------------------------- | ------------------------------------ |
| Data    | types, seed, selectors, store      | schema, migrations, RLS, seeds       |
| Intake  | submission wizard, vault UI        | storage, checksum, transitions       |
| Review  | scrutiny queue, detail actions     | rule engine, provenance, work items  |
| Time    | alert calendar, renewals           | scheduler, idempotency, escalation   |
| Release | checklist, clearances, decision UI | clearance matrix, authority gate     |
| Trust   | audit viewer, scope denial         | immutable events, server permissions |

## Risks and mitigations

| Risk                                | Mitigation                                         |
| ----------------------------------- | -------------------------------------------------- |
| Scope inflation                     | P0 release story before OCR/analytics; phase gates |
| Maturity confused with release      | Separate dates and blocking reasons everywhere     |
| Mock verification mistaken for real | Persistent SIMULATED badges, audit provenance      |
| Tenant leak                         | RLS + server checks + explicit negative tests      |
| Alert duplicates                    | Dedupe key and repeated-run test                   |
| Demo data drift                     | One seed module, reset action, fixed demo clock    |
| Timezone errors                     | Date-only values formatted without UTC shifting    |
