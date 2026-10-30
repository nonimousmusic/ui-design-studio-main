# Data Model

The frontend model is a 1:1 preview of the target PostgreSQL schema. Field names,
enums, and relationships are chosen so the Phase 2 migration is mechanical.

## Relationship overview

```
Institution 1──* DepositObligation 1──* DepositInstrument 1──* DocumentRecord
      │                │                       │  │
      │                │                       │  └──* VerificationFinding
      │                │                       └────── previous / replacement link
      │                └──* ReleaseCase 1──* Clearance
      │                          └────────── Decision (0..1)
      ├──* WorkItem
      ├──* Alert
      └──* AuditEvent
PolicyVersion 1──* PolicyRule
User *──* Institution (membership; officials have region/case scope)
```

## Entities

### Institution

`id`, `permanentId` (unique where applicable), `name`, `shortName`, `region`,
`type`, `city`, `state`, `ownerName`, `ownerEmail`, `approvedSince`, `status`.

### DepositObligation

`id`, `institutionId`, `policyVersionId`, `purpose`, `amount`, `startDate`,
`holdEndDate` (nullable), `status`, `requirementStatus`, `notes`.

Invariant: one obligation may be supported by many instruments over time. A matured
instrument does **not** close the obligation.

### DepositInstrument

`id`, `obligationId`, `institutionId`, `type` (`FDR|RTGS|RPGF|OTHER`), `fdrNo`,
`bank`, `branch`, `ifsc`, `amount`, `issueDate`, `maturityDate`, `holdEndDate`,
`status` (`ACTIVE|APPROACHING_MATURITY|MATURED|SUPERSEDED|RELEASED`),
`submissionStatus`, `verificationStatus`, `provenance`, `officer`,
`previousInstrumentId`, `replacementInstrumentId`, `replacementReason`, `createdAt`,
`updatedAt`.

Comparison key: `issuer + type + normalized reference`. Reference is masked in lists
when it is sensitive; fixtures use synthetic numbers.

### DocumentRecord

`id`, `instrumentId`, `name`, `category`, `version`, `checksumSha256`, `sizeBytes`,
`mime`, `uploadedAt`, `uploadedBy`, `reviewerStatus`.

Version sequence is monotonic per document category. Previous versions remain
readable and cannot be overwritten.

### VerificationFinding

`id`, `instrumentId`, `code`, `field`, `expected`, `observed`, `severity`,
`ruleVersion`, `status` (`OPEN|RESOLVED|ACCEPTED_RISK`), `resolution`, `nextAction`.

Codes: `MISSING_DOCUMENT`, `DUPLICATE_REFERENCE`, `AMOUNT_MISMATCH`,
`DATE_MISMATCH`, `INVALID_DATE_ORDER`, `BROKEN_REPLACEMENT_LINK`,
`HOLD_UNCONFIRMED`.

### ReleaseCase

`id`, `obligationId`, `instrumentId`, `institutionId`, `status`, `requestedAt`,
`requestedBy`, `reason`, `checklist[]`, `clearances[]`, `decision?`, `createdAt`.

Checklist item: `id`, `label`, `required`, `done`, `evidence`, `updatedAt`.
Clearance: `id`, `bureau`, `required`, `status`
(`NOT_REQUESTED|PENDING|CLEARED|OBJECTED|NOT_APPLICABLE`), `note`, `reviewer`,
`reviewerRole`, `updatedAt`, `simulationFlag`.

Decision: `outcome` (`APPROVED|REJECTED`), `authorityId`, `authorityName`,
`decidedAt`, `rationale`, `conditions`, `instrumentRoute` (`NOC_RECORD|SANCTION_ORDER`).

Release is blocked when any required checklist item is incomplete or any required
clearance is `PENDING`, `OBJECTED`, or `NOT_REQUESTED`.

### WorkItem

`id`, `title`, `entityType`, `entityId`, `institutionId`, `assigneeId`, `assigneeName`,
`ownerRole`, `dueDate`, `priority`, `reasonCode`, `status`, `createdAt`.

### Alert

`id`, `type` (`BANK_MATURITY|REGULATORY_HOLD|WORKFLOW_SLA|RENEWAL|RELEASE|DOCUMENT`),
`title`, `detail`, `entityId`, `institutionId`, `recipient`, `triggerDate`, `threshold`,
`acknowledged`, `escalated`, `delivery`, `dedupeKey`.

Dedupe key: `type:entityId:threshold:recipient`. Re-running the date monitor must not
create a second alert for the same key.

### AuditEvent

`id`, `at`, `actorId`, `actorName`, `actorRole`, `action`, `entityType`, `entityId`,
`institutionId`, `reason`, `before`, `after`, `correlationId`, `source`.

Append-only. The UI never edits or deletes events. The production database must deny
update/delete to application roles.

### PolicyVersion / PolicyRule

`PolicyVersion`: `id`, `label`, `effectiveFrom`, `effectiveTo`, `sourceClause`,
`status`, `rules[]`. `PolicyRule`: `code`, `title`, `clause`, `requirement`, `amount?`,
`holdYears?`, `checklist[]`.

Cases pin the policy version used at evaluation time; changing a policy must not
silently re-evaluate old cases (AC-12).

## State machines

### Submission

```
DRAFT → SUBMITTED → UNDER_SCRUTINY → ACCEPTED
                          ├────────→ RETURNED → SUBMITTED
                          └────────→ REJECTED
```

Return/reject require a reason. Every transition appends audit.

### Verification

```
NOT_CHECKED → DOC_REVIEWED → BANK_PENDING → BANK_CONFIRMED
        └────────→ DISCREPANCY ────────→ DOC_REVIEWED
```

`DOC_REVIEWED` never equals `BANK_CONFIRMED`. Simulated responses are stored as
`SIMULATED_BANK_RESPONSE`, not `BANK_CONFIRMED_AUTHORIZED`.

### Instrument

```
ACTIVE → APPROACHING_MATURITY → MATURED
ACTIVE → SUPERSEDED (only when a replacement is accepted)
any approved release → RELEASED (requires decision, never date alone)
```

### Obligation

`OPEN → REVIEW_REQUIRED → SATISFIED → RELEASE_PENDING → CLOSED`, with `OPEN`
remaining valid after an instrument matures.

### Release

```
DRAFT → SUBMITTED → CLEARANCES_PENDING → DECISION_PENDING → APPROVED → CLOSED
                                             └───────────→ REJECTED
```

## Role and permission matrix

| Capability                         | Institution admin | Case officer | Clearance reviewer | Decision authority | Admin     | Auditor |
| ---------------------------------- | ----------------- | ------------ | ------------------ | ------------------ | --------- | ------- |
| View own institution               | ✓                 | assigned     | assigned           | assigned           | ✓         | ✓       |
| View cross-institution             | —                 | scope        | assigned cases     | scope              | ✓         | ✓       |
| Create/submit instrument           | ✓                 | —            | —                  | —                  | ✓         | —       |
| Scrutinize / request clarification | —                 | ✓            | —                  | read               | ✓         | —       |
| Record document review             | —                 | ✓            | —                  | read               | ✓         | —       |
| Run simulated bank check           | —                 | ✓            | —                  | —                  | ✓         | —       |
| Record clearance                   | —                 | delegated    | ✓                  | read               | ✓         | —       |
| Record release decision            | —                 | —            | —                  | ✓                  | delegated | —       |
| Manage users/policies              | —                 | —            | —                  | —                  | ✓         | read    |
| Read audit                         | own               | scope        | assigned           | scope              | ✓         | ✓       |
| Mutate audit                       | —                 | —            | —                  | —                  | —         | —       |

## Seed coverage

| Institution                              | Persona           | Scenario                                                              |
| ---------------------------------------- | ----------------- | --------------------------------------------------------------------- |
| Shri Ram Institute of Technology (A)     | Institution admin | Active FDR approaching maturity + pending replacement                 |
| Vidya Bharati College of Engineering (B) | —                 | Duplicate normalized reference discrepancy                            |
| Kaveri Institute of Management (C)       | —                 | Matured instrument; hold period not complete; release blocked by PGRC |
| Ganga Polytechnic (D)                    | —                 | Returned submission with missing page                                 |
| Sardar Patel Technical Campus (E)        | —                 | Clean compliant record (control case)                                 |

Additional fixtures: resolved document review, simulated bank result, one approved
release, full audit sequences, alerts at 90/60/30/15/7 thresholds, work items with
overdue ageing.
