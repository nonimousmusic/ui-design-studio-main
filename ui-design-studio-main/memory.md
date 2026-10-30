# Project Memory

Living implementation context for the AICTE Smart FDR Lifecycle Management Portal.
Durable specifications are maintained in `docs/`.

## Project state

- Problem statement: SIH26265; source PRD is `../AICTE_SIH26265_Enhanced_PRD_v2.md`.
- Stack: TanStack Start, React 19, TypeScript, Tailwind 4, shadcn/ui.
- Phase 0 (standalone foundation): complete.
- Phase 1 (role-aware clickable frontend): complete and manually smoke-tested.
- Phase 2 (Supabase database foundation): local CLI scaffold and initial schema/RLS
  migration started; not yet validated against a running database or deployed.
- Supabase Auth integration, Storage, audited mutations, scheduler, and adapters remain
  unimplemented.
- All fixtures are synthetic. No real bank connection, payment, NOC issuance, or
  automatic approval exists.

## Architecture and fixed context

```text
SessionProvider (seeded demo personas, localStorage)
  └─ PortalProvider (synthetic seed, audited actions, localStorage)
       └─ TanStack file routes
            └─ pure selectors (tenant scope, permissions, blockers, KPIs)
```

- Demo clock: `DEMO_TODAY = "2026-10-30"` in `src/lib/format.ts`.
- Storage keys: `aicte-fdr-portal-v1` and `aicte-fdr-session-v1`.
- Domain source of truth: `src/lib/types.ts`, `seed.ts`, `selectors.ts`, `store.tsx`.
- Generated `src/routeTree.gen.ts` must only be updated by dev/build.
- Supabase scaffold: `supabase/config.toml` and timestamped SQL in `supabase/migrations/`.
- No Supabase project is linked. CLI login lists unrelated projects; do not link or
  modify them without explicit project selection.
- `docs/SUPABASE_SETUP.md` documents project-linking safety and required local setup.

## Product guardrails

1. Maturity is not release eligibility; maturity and regulatory hold are separate.
2. Documentary review is not bank confirmation.
3. Simulated bank responses never become authorized confirmation.
4. Required clearances, checklist items, and high findings block release decisions.
5. Only the delegated decision authority can record a release outcome.
6. Institution data is tenant-scoped in selectors; production must enforce this in RLS.
7. Audit events are append-only in the application; production must deny mutation/deletion.
8. Synthetic fixtures and simulated outcomes must remain visibly labelled.

## Demo personas

| User                | Role                      | Scope                                            |
| ------------------- | ------------------------- | ------------------------------------------------ |
| A. Mehta            | Case officer              | All institutions                                 |
| R. Iyer             | Clearance reviewer        | Clearances                                       |
| S. Rao              | Decision authority        | Delegated release decisions                      |
| P. Sharma           | Institution administrator | Institution A / Shri Ram Institute of Technology |
| M. Krishnan         | Institution administrator | Institution C / Kaveri Institute of Management   |
| System Admin        | Administrator             | Directory, policy, reset                         |
| Auditor (read-only) | Auditor                   | Read-only records                                |

## Key fixtures

- Institution A: `fdr-1001` nearing maturity; submitted replacement `fdr-1004` has
  a date discrepancy.
- Institution B: `fdr-1002` has a cross-institution duplicate-reference finding.
- Institution C: matured `fdr-1003`, unconfirmed hold, blocked release
  `REL-2026-0042` (PGRC clearance, checklist, and high finding gates).
- Institution D: `fdr-1005` returned for a missing signature page.
- Institution E: `fdr-1006` is the clean replacement walkthrough candidate under
  obligation `obl-e1`.

## Verification log (2026-10-30)

| Check                             | Result                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `bun install`                     | pass                                                                                         |
| `bunx tsc --noEmit`               | pass                                                                                         |
| `bun run lint`                    | pass, 0 errors; 8 existing React Fast Refresh warnings in shared UI/provider files           |
| `bun run test`                    | pass, 2 files / 3 tests                                                                      |
| `bun run build`                   | pass                                                                                         |
| Browser persona/route smoke       | pass, 35/35 checks; no runtime exceptions or console errors                                  |
| Replacement lifecycle walkthrough | pass, 36/36 checks; submission, scrutiny, acceptance, supersession, audit and chain verified |
| `supabase db lint --local`        | blocked: local PostgreSQL is unavailable; Docker/Podman is not installed                     |

Dashboard UI refresh (2026-10-30): role-aware welcome panel, KPI card hierarchy,
urgency-sorted work list, concise deadline links, maturities limited to the next year,
and refinements to shared sidebar and stat cards. Typecheck, test, lint, and production
build pass after the update. Post-refresh browser smoke was 34/36 because the reused
browser retained its prior session; direct P. Sharma dashboard rendering was confirmed,
and the remaining role/route checks had no runtime or console errors.

## Next work

1. Confirm/create the intended Supabase project and hosting region with the user.
2. Install Docker Desktop or Podman, then run local Supabase migrations and RLS tests.
3. Add audited server-side mutation RPCs before enabling any browser writes; then
   integrate Auth and private Storage without importing demo personas as real users.
4. Do not add live bank, payment, or notification integrations to the prototype.
5. Address eight existing `react-refresh/only-export-components` warnings only if
   shared UI module boundaries are being refactored.
6. For each behavioral change, update `docs/` and this verification log, then run
   the commands in `AGENTS.md` and acceptance walkthrough in `docs/TEST_PLAN.md`.

## Implementation notes

- Providers seed synchronously for SSR parity, then hydrate from localStorage in an effect.
- Release parent routes and registry parent routes render `<Outlet />` for detail children.
- Tests use the actual providers/store; `src/test/release-flow.test.tsx` covers role gates,
  tenant scope, immutable release decisions, release transitions, and alert deduplication.
- Do not commit environment secrets or real institutional/bank documents or identifiers.
