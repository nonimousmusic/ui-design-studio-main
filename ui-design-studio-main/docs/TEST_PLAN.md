# Test Plan

## Automated (frontend)

| Area    | Test                                                    | Command         |
| ------- | ------------------------------------------------------- | --------------- |
| Routing | `/` resolves to a real route, not root fallback         | `bun run test`  |
| Domain  | Date formatting does not shift date-only values         | `bun run test`  |
| Domain  | Release blockers computed from checklist + clearances   | `bun run test`  |
| Scope   | Institution persona only sees own instruments           | `bun run test`  |
| Dedupe  | Running the date monitor twice adds no duplicate alerts | `bun run test`  |
| Auth    | `can()` denies decision for non-authority roles         | `bun run test`  |
| Build   | Production build completes                              | `bun run build` |
| Lint    | No ESLint errors                                        | `bun run lint`  |

Recommended additions once the backend exists: Playwright journeys for the six-minute
demo, RLS integration tests, signed-URL negative tests, and scheduler idempotency.

## Acceptance scenarios (PRD §13)

These are exercised in the frontend demo with the seeded personas.

| ID    | Action                                                             | Expected                                                                 |
| ----- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| AC-01 | Sign in as Institution A, open Institution B's registry/detail URL | Scope-denied panel; no B data; event visible to admin/auditor            |
| AC-02 | Institution A submits a valid FDR with PDF                         | Persistent record, document metadata + SHA-256, audit, officer work item |
| AC-03 | Submit with missing proof or invalid dates                         | Blocked or review-flagged with named reason                              |
| AC-04 | Request independent verification without provider                  | Remains pending or SIMULATED; never “bank verified”                      |
| AC-05 | Run date monitor three times on same event                         | One alert per recipient/threshold; no duplicates                         |
| AC-06 | Replace FDR A with A2                                              | A unchanged and linked; reviewer sees both                               |
| AC-07 | Attempt decision with PGRC pending                                 | Locked; blocker names responsible reviewer                               |
| AC-08 | Record all mock clearances + authority decision                    | Decision + provenance in audit; institution sees state                   |
| AC-09 | Institution calls official decision action                         | Denied by UI role gate; server enforcement pending Phase 6               |
| AC-10 | Refresh dashboard / switch persona                                 | Counts reconcile to store; scope changes                                 |
| AC-11 | Overwrite or delete accepted document version                      | Denied; version history remains                                          |
| AC-12 | Change policy version after case creation                          | Existing case retains pinned policy; new cases use new rules             |

## Manual demo checklist

1. Login as `Institution A` — own only data; overview shows renewal action.
2. Submit replacement `?replaces=fdr-1001` — checks and document upload.
3. Switch to `Case officer` — scrutiny queue shows the new item; record review;
   run simulated bank check; verify SIMULATED badge.
4. Run date monitor twice — alert count stable; acknowledge one.
5. Open renewal chain — old and new visible; old not overwritten.
6. Switch to `Decision authority` — open release `REL-2026-0042`; decision locked
   (PGRC pending + hold unconfirmed).
7. Switch to `Clearance reviewer` — clear PGRC, confirm hold, complete checklist;
   decision becomes available to authority only.
8. As authority — approve with rationale/conditions; outcome marked PROPOSED.
9. Switch to `Auditor` — every event visible, no mutation controls.
10. Sign in as Institution A, paste Institution B detail URL — scope denied.

## Negative authorization matrix

| Actor              | Attempt                                 | Expected                           |
| ------------------ | --------------------------------------- | ---------------------------------- |
| Institution A      | Open Institution B route/data           | Denied, no data leak               |
| Institution        | Record release decision                 | No control; action impossible      |
| Case officer       | Record final decision                   | No control; action impossible      |
| Auditor            | Accept document / clear bureau / decide | Read-only controls absent/disabled |
| Clearance reviewer | Decide release                          | Denied                             |
| Any role           | Edit/delete audit event                 | No UI; server must deny Phase 2    |

## Evidence to record

- Screenshot per acceptance ID with persona and timestamp.
- Export CSV sample to prove scope/masking.
- Console/build/lint/test output.
- Metric sheet with fixture count, task timings, and exact method; no invented percentages.
