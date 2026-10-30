# PRD Traceability

Every SIH expectation maps to a P0 feature, a route, and a test. “Frontend” means
the clickable demo; “backend phase” is the production path.

| SIH requirement                 | PRD FR       | Frontend surface                                 | Backend phase | Test                |
| ------------------------------- | ------------ | ------------------------------------------------ | ------------- | ------------------- |
| 1. Centralized repository       | FR-02, FR-08 | `/institutions`, `/registry`, detail             | 2–3           | AC-02, AC-10        |
| 2. Digital document management  | FR-03        | Detail → Documents, submission upload            | 3             | AC-02, AC-11        |
| 3. Verification & discrepancies | FR-04        | Detail → Verification, scrutiny queue            | 4             | AC-03, AC-04        |
| 4. Validity & maturity tracking | FR-05        | `/alerts`, overview dates, detail dates          | 5             | AC-05               |
| 5. Renewal & replacement        | FR-06        | `/renewals`, submission `replaces`               | 5             | AC-06               |
| 6. Release/refund workflow      | FR-07        | `/release`, `/release/$id`                       | 6             | AC-07, AC-08        |
| 7. Alerts & escalation          | FR-05        | `/alerts`, notification badge                    | 5             | AC-05               |
| 8. Dashboard & reports          | FR-08        | `/`, `/reports`                                  | 7             | AC-10               |
| 9. Audit & access control       | FR-09        | `/audit`, scope denial, role gates               | 2, 7          | AC-01, AC-09, AC-12 |
| 10. Integration & security      | FR-04, §10   | SIMULATED verification, admin integration status | 4, 8          | AC-04               |

## Functional requirements

| FR               | Status (frontend) | Notes                                                                |
| ---------------- | ----------------- | -------------------------------------------------------------------- |
| FR-01 Onboarding | Complete demo     | `/login`, seven personas, account-request form; real auth in Phase 2 |
| FR-02 Registry   | Complete demo     | Obligation parent + instrument children, scoped views                |
| FR-03 Vault      | Complete demo     | File metadata + SHA-256, versions, reviewer status                   |
| FR-04 Scrutiny   | Complete demo     | Deterministic findings, provenance, simulated bank response          |
| FR-05 Monitoring | Complete demo     | Date types, threshold rules, dedupe simulation, ack/escalate         |
| FR-06 Renewal    | Complete demo     | Immutable old record, replacement link, gap warning                  |
| FR-07 Release    | Complete demo     | Checklist, clearances, blocker gate, authority decision              |
| FR-08 Dashboards | Complete demo     | Role-scoped KPIs, filters, charts, CSV                               |
| FR-09 Audit      | Complete demo     | Append-only events, before/after, scoped read                        |
| FR-10 OCR        | Not started (P1)  | Explicitly deferred                                                  |

## Domain constraints encoded

- `holdEndDate` is independent of `maturityDate` and may be `null`.
- A matured instrument never becomes `RELEASED` automatically.
- `SIMULATED_BANK_RESPONSE` cannot be promoted to `BANK_CONFIRMED_AUTHORIZED`
  without a real adapter result.
- Release decisions are blocked while a required clearance is `PENDING` or `OBJECTED`.
- Only `DECISION_AUTHORITY` (or explicitly delegated admin) can record a decision.
- `AUDITOR` has read-only access everywhere.
- Institution admins are scoped to their `institutionId`; cross-tenant routes render
  a scope-denied panel (AC-01).

## Deliberate prototype limitations

- No money movement, encashment, NOC issuance, or statutory approval.
- No real bank/AICTE API; every external response is simulated and labelled.
- No OCR, fraud scoring, blockchain, or payment gateway.
- Policy rules are illustrative, not legal interpretations.
- Frontend persistence is browser-local; clearing storage resets to seed.
