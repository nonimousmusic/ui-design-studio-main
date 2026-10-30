SMART INDIA HACKATHON 2026 \| AICTE REGULATION BUREAU

# AICTE Smart FDR Lifecycle Management Portal

### ENHANCED PRODUCT REQUIREMENTS DOCUMENT

A secure, explainable and auditable workflow for institutional security deposits, bank-issued FDRs, renewal obligations and authorized release decisions.

Version 2.0 • 30 October 2026 • Status: Proposed / SIH prototype

| **Item**                  | **Reference**                                                                               |
|---------------------------|---------------------------------------------------------------------------------------------|
| SIH problem statement     | SIH26265 — Streamline of security deposit/ FDR portal.                                      |
| Organization / department | AICTE / Regulation Bureau                                                                   |
| Theme / category          | Smart Automation / Software                                                                 |
| Primary source            | Official SIH 2026 Problem Statement Directory                                               |
| Regulatory reference      | AICTE Approval Process Handbook 2024–2027, particularly clauses 1.12 and 6.46               |
| Product approach          | Real full-stack MVP + labelled demo integrations; production controls documented separately |

> **What changed in v2.0** Added explicit SIH requirement traceability, an obligation-versus-instrument data model, evidence provenance, APH-linked release clearances, measurable demo baselines, more rigorous acceptance tests, and a focused build sequence.

### Reading guide

Sections 1–4 explain the problem and SIH fit. Sections 5–11 specify behavior, data, security and integrations. Sections 12–17 define the demo, delivery plan, testing and unresolved policy decisions. P0 = required for the judged prototype; P1 = strong differentiator; P2 = post-prototype.

Important: This is an engineering proposal, not an official AICTE application, approval, banking integration or legal interpretation. Applicability of a regulation must be confirmed by the competent authority.

## 1. Executive summary and problem interpretation

AICTE needs a consolidated way to know which institution owes or holds a particular security deposit, which financial instrument supports it, whether the submitted information has been scrutinized or independently verified, what is due next, and whether a release can lawfully proceed. Existing fragmented records and manual follow-ups create visibility gaps around pending reviews, maturity and release cases. This is the explicit focus of SIH26265.

### 1.1 Simple explanation for the team

A college submits an FDR as evidence of a required security deposit. AICTE needs to see its amount, bank, dates and documents; verify the submission; get alerted before key deadlines; retain evidence of renewals or replacements; and, when a release is requested, coordinate clearances and record a competent-authority decision. The portal is the shared case file and action tracker, not a bank or an automatic approval engine.

### 1.2 Why the v1 PRD was a good starting point

- It already covered a live database, separate institutional and official views, private documents, submission and scrutiny, renewal history, reminders, audit logs, and strong authorization rules.
- It correctly required simulated bank checks to be clearly distinguished from real third-party confirmation.
- It included secure implementation guidance (PostgreSQL, server authorization, RLS and protected documents).

### 1.3 Gaps corrected in this version

| **Gap in v1**                                                          | **v2 correction**                                                                                   |
|------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| Release/refund was “secondary” in the MVP.                             | Release is P0: the SIH brief explicitly expects an authorized workflow and end-to-end testing.      |
| An FDR record was also treated as the deposit obligation.              | Separate regulatory deposit obligations from actual instruments and evidence; deadlines may differ. |
| Verification status lacked clear evidence provenance.                  | Use institution-reported, official-reviewed, bank-confirmed and demo-simulated evidence types.      |
| Approval path was generic.                                             | Introduce a configurable clearance matrix, documented blockers and decision evidence.               |
| Risk dashboard was mostly descriptive.                                 | Add a transparent “next action” queue, assigned owner, SLA/ageing and reason codes.                 |
| Success metrics were not operationalized.                              | Specify repeatable task baselines, fixed demo dataset and expected observable outcomes.             |
| Maturity reminders were not distinguished from statutory requirements. | Separate bank FDR maturity, regulatory holding term and workflow due dates; rules are versioned.    |

## 2. Normative source mapping and guardrails

### 2.1 What the official SIH statement requires

The SIH 2026 listing for PS SIH26265 names ten expected solution capabilities. Every capability below is included in the intended product; “demo proof” describes what judges should be able to see rather than a promise of live AICTE/bank access.

| **SIH requirement**              | **Priority** | **Visible demo proof**                                                               |
|----------------------------------|--------------|--------------------------------------------------------------------------------------|
| 1\. Centralized repository       | P0           | Institution + obligation + FDR records persist and are searchable.                   |
| 2\. Digital document management  | P0           | Private PDF upload, controlled preview, versions and checksum.                       |
| 3\. Verification & discrepancies | P0           | Official records scrutiny; missing/duplicate fields flagged; provenance shown.       |
| 4\. Validity & maturity tracking | P0           | Configurable reminder generated against a seeded date.                               |
| 5\. Renewal & replacement        | P0           | Linked old/new instruments with full history.                                        |
| 6\. Release/refund workflow      | P0           | Request, checklist, clearances, human decision and closure.                          |
| 7\. Alerts & escalation          | P0           | In-app deadline alert and overdue owner escalation.                                  |
| 8\. Dashboard & reports          | P0           | Actual database counts, ageing queue and safe export (P1).                           |
| 9\. Audit & access control       | P0           | Before/after event and denied cross-institution access.                              |
| 10\. Integration & security      | P0/P1        | Secure adapter interface; explicitly simulated external reply; real integrations P2. |

### 2.2 Regulatory context: do not equate maturity with release eligibility

AICTE Approval Process Handbook (APH) 2024–2027 clause 1.12 addresses security deposits for certain new technical institutions, including exemptions, amounts and ten-year holding provisions as applicable. Clause 6.46 describes release documentation, clearances and distinct outcomes for FDR/RPGF versus RTGS. The system must record which policy edition and rule actually applies to each obligation; do not hardcode one universal amount, maturity period, exemption or authorization.

> **Critical distinction** Bank FDR maturity date is an instrument event. The applicable regulatory hold end date is a separate obligation event. Neither should automatically mark a security deposit “releasable” or “released.”

### 2.3 Product guardrails

- No transfer of money, encashment or bank account action.
- No bank validation without written authorization and documented verification mechanism.
- No automatic statutory approval, clearance, NOC or sanction order.
- Never describe AI/OCR extraction, checksums, institution upload, or official review as bank authenticity confirmation.
- Use synthetic organizations, dummy instruments and plainly labelled demonstration fixtures; protect real identifiers and documents.

## 3. Product outcomes, actors and scope

### 3.1 Success outcomes

- One searchable, traceable record for each applicable deposit obligation and its linked evidence/instruments.
- An AICTE official can identify the next pending action, owner, age and reason for delay.
- Institutions receive actionable deadlines rather than generic reminders.
- Renewal/replacement and release cases preserve prior evidence, approvals and decisions.
- Access rules prevent one institution from seeing another institution’s finances.

### 3.2 Roles and authority

| **Role**                                      | **Responsibilities / access**                                                                                             |
|-----------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| Super admin                                   | Provision verified organizations/users, manage policy versions, authorized delegated roles; view all audit history.       |
| Institution administrator                     | Own institution obligations, submit/replace documents, see observations, file renewal and release requests.               |
| AICTE case officer                            | Scrutinize assigned cases, request clarification, record observations and provenance; cannot bypass approval permissions. |
| Regional / supervisory officer                | View scoped workload, assign work, escalate, record assigned review/clearance actions.                                    |
| Clearance reviewer (PGRC / Vigilance / other) | Record a domain-specific clearance or objection when formally assigned; cannot decide release by default.                 |
| Competent authority                           | Record final decision only under explicit delegation and validated prerequisites.                                         |
| Auditor (read-only)                           | Read authorized case documents, event timelines and decisions; no state changes.                                          |

MVP role consolidation: implement Institution, Case Officer, Decision Authority and Admin as separate seeded accounts; assign a “clearance reviewer” permission to one official account if time is tight. Preserve the complete authority matrix in configuration, not in UI-only checks.

### 3.3 Included and excluded

| **Included in judged prototype (P0)**                                                                                                                                          | **Excluded or delayed**                                                                                                                        |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| Institution onboarding, FDR & security deposit case records, secure upload, scrutiny, date rules, renewal links, release clearance checklist, dashboards, audit, auth and RLS. | Real banking transactions, actual AICTE single sign-on, real AICTE master-record sync, official certificates, production legal determinations. |
| Explainable discrepancy rules and simulated external verification clearly marked as simulated.                                                                                 | AI fraud scoring, untested predictions, blockchain for its own sake, payment gateways, automatic fund disbursal.                               |

## 4. Domain model: obligation first, instrument second

The v1 “one FDR record” model should be enhanced with a parent Security Deposit Obligation. An institution may owe a defined deposit under a particular policy context; this obligation can be supported by one or more instruments, receipts or replacement instruments across time. This prevents one matured instrument from incorrectly implying the regulatory obligation is complete.

| **Object**            | **Minimum required fields / relationship**                                                                                                           |
|-----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| Institution           | id, AICTE Permanent ID (verified or demo), name, region, organization type, approval references, owner.                                              |
| Deposit obligation    | id, institution_id, applicable policy/rule version, purpose, obligation amount, start date, regulatory hold end date (if known), requirement status. |
| Deposit instrument    | id, obligation_id, type (FDR/RTGS/RPGF/other permitted), bank, branch, masked reference, amount, issue/maturity dates, provenance, statuses.         |
| Instrument linkage    | previous_instrument_id, replacement_instrument_id, relationship type, explanatory reason; unique successor controls.                                 |
| Submission & document | case id, uploader, timestamps, document category, version, SHA-256 checksum, private path, reviewer status.                                          |
| Verification evidence | method, source category, observations, evidence reference, reviewed_by, reviewed_at, validity period, simulation flag.                               |
| Release case          | instrument/obligation references, reason, submission evidence, clearance tasks, eligibility flags, authority decision and outcome.                   |
| Action & audit        | task owner, due date, status, event actor, timestamp, changed fields, correlation id; append-only event history.                                     |

### 4.1 Default field and rule handling

- All dates are stored as UTC timestamps where applicable; date-only regulatory and bank dates preserve local calendar meaning and are evaluated using Asia/Kolkata.
- The instrument reference is normalized for duplicate checks but shown masked by default. Duplicate checks compare issuer + instrument type + normalized reference, subject to legitimate reuse and human review.
- Financial amounts use NUMERIC/DECIMAL; no floating-point calculations for amounts.
- Policy amount requirements, exemptions, holding periods and checklists depend on a versioned rule set, effective dates, institution category and human validation.
- Unknown or not-applicable maturity, bank details or regulatory due dates are represented explicitly, not invented.

## 5. Detailed functional requirements

#### FR-01 • Account and institution onboarding \[P0\]

- Verified or administrator-seeded institution profile linked to AICTE Permanent ID where available; self-registration is a pending request, not self-approval.
- Email-verified login, password reset, session expiry and privileged MFA where configured.
- User may belong only to authorized institution scopes; officials assigned role + region/case scopes.
- Acceptance: Institution A cannot retrieve B’s case by URL, API or document link.

#### FR-02 • Deposit obligation and instrument registry \[P0\]

- Authorized user creates an obligation and attaches one or more instruments or proofs; chooses FDR, RTGS, RPGF or other configured type.
- Capture issuer, masked reference, amount, issue/maturity dates, beneficiary, purpose, policy edition, institution and supporting evidence.
- Draft, submit, withdraw/return-for-correction through audited transitions; keep prior submitted revisions.
- Acceptance: new record appears in official queue, in the institution view and in database-backed aggregates after reload.

#### FR-03 • Secure document vault \[P0\]

- Document categories include FDR copy, bank confirmation, deposit/payment proof, LoA/EoA, Affidavit 6, release request and clearance evidence as applicable.
- Private storage; validate file signature, size and extension; short-lived authorized retrieval; store SHA-256 and version sequence.
- Reviewer can mark each document accepted/needs clarification; all replacements retain previous version history.
- Acceptance: unauthorized account cannot view a signed URL or generate one for another case.

#### FR-04 • Scrutiny, discrepancy and provenance \[P0\]

- Apply deterministic checks: missing documents, negative/zero amount, invalid dates, suspicious duplicate instrument references, conflicting amounts and broken replacement links.
- Show finding type, field, expected/observed value, rule version, evidence and next action. Flags are prompts for review, not allegations of fraud.
- Explicit evidence provenance values: INSTITUTION_DECLARED, OFFICIAL_DOCUMENT_REVIEW, BANK_CONFIRMED_AUTHORIZED, SIMULATED_BANK_RESPONSE.
- An official can request clarification, record remarks, attach evidence, reject with reason, or mark documentary scrutiny complete. External bank confirmation remains separate.
- Acceptance: submitted record + field mismatch generates a review task; simulated response displays a prominent SIMULATED badge.

#### FR-05 • Monitoring, alert engine and case ageing \[P0\]

- Track independent dates: instrument maturity, regulatory hold end, review due date, clarification due date, renewal/replacement target and clearance due dates.
- Default demonstration windows are 90/60/30/15/7 days and on/after deadline; actual thresholds are configurable per rule and recipient.
- Daily server-side scheduler generates deduplicated alert instances per event + recipient + policy threshold; escalations route to assigned supervisor without changing case state.
- Every alert has a reason, linked record, recipient, trigger date, acknowledgement and delivery outcome.
- Acceptance: re-run a scheduled job three times; a particular alert event appears once; overdue record appears in “My actions.”

#### FR-06 • Renewal and replacement tracking \[P0\]

- Institution submits a new instrument linked to the prior one, including dates/amounts/replacement justification and documents.
- Old instrument remains immutable as history; replacement is pending scrutiny until accepted. Do not treat the new submission as automatic satisfaction of the deposit obligation.
- Reject duplicate active replacement chains, detect missing intervals and provide a visual chronological timeline.
- Acceptance: old and new records display together; “previous” record is not overwritten by a new maturity date.

#### FR-07 • Release / discharge / refund cases \[P0\]

- Create a request for the applicable obligation/instrument and reason; automatically assemble a configurable checklist without declaring eligibility.
- For APH 2024–27 clause 6.46 scenarios, default checklist includes request letter, Affidavit 6, FDR/online payment/other proof as applicable and latest LoA/EoA; capture PGRC, Vigilance and other relevant bureau/cell clearances.
- The reviewer records clearances individually: NOT_REQUESTED, PENDING, CLEARED, OBJECTED, NOT_APPLICABLE (with reason/evidence). Block decision submission if required clearance is absent or objected.
- Human decision authority approves/rejects/returns case with reason; route outcome based on instrument type: FDR/RPGF NOC record or RTGS sanction-order record as applicable. Both remain PROPOSED/RECORDED in prototype, not issued official documents.
- Support special-condition checklists for closure, mergers, conversion, complaints and third-party NOC blockers, activated by approved policy configuration.
- Acceptance: submit a release with a missing PGRC clearance: final approval action is denied; after all required mock clearances and delegated authority, a traceable decision can be recorded.

#### FR-08 • Dashboards, search and reporting \[P0\]

- AICTE overview: total obligations/instruments/amounts by status, awaiting scrutiny, expiring FDRs, overdue actions, held release cases, renewal coverage and assignee ageing.
- Institution overview: own deposits, actionable reminders, submitted evidence and their cases; regional officers get only scoped data.
- Filter by permanent ID, institution, region, bank, obligation policy, instrument type, maturity window, status, owner and discrepancy.
- Prioritized intervention queue uses transparent rule reasons and overdue age; do not use arbitrary AI risk scores.
- Exports (P1) must respect row-level scope, record exporter and mask sensitive fields.

#### FR-09 • Audit, status timelines and evidence export \[P0\]

- Server-generated events for creation, submission, file change, rules evaluation, official comments, clearance, decision, notifications, role changes and reassignments.
- Include actor, role, tenant scope, event type, entity, event time, prior/new permitted values, reason, request correlation ID and source.
- Case detail presents a readable timeline; audit_log cannot be deleted or edited through ordinary application accounts.
- Acceptance: every release decision displays the approving identity, evidence checklist and exact timestamp; auditor sees same history read-only.

#### FR-10 • Assisted document extraction (optional demo differentiator) \[P1\]

- Opt-in OCR/AI prefill extracts bank, amount, instrument number and dates from synthetic PDFs and shows per-field confidence and page evidence.
- User must review and confirm every extracted field; no automatic verification, approval or external API claim.
- If unavailable or unreliable, the portal falls back to a complete manual path; sample-only model performance is not a quality claim.

## 6. Roles, authorization and workflow states

### 6.1 Permission decisions (server + database, not hidden buttons)

| **Capability**                 | **Institution** | **Case officer**               | **Clearance role** | **Authority**  | **Admin / auditor** |
|--------------------------------|-----------------|--------------------------------|--------------------|----------------|---------------------|
| Submit/edit own draft          | Yes             | No                             | No                 | No             | Admin only / No     |
| Review submitted FDR           | No              | Assigned                       | No                 | Read           | Delegated / Read    |
| Record independent bank result | No              | Only if evidence+authorization | No                 | No             | Config / Read       |
| Approve domain clearance       | No              | If delegated                   | Assigned only      | Read           | Delegated / Read    |
| Record final release decision  | No              | No                             | No                 | Delegated      | Delegated / No      |
| View cross-institution data    | No              | Assigned scope                 | Assigned cases     | Assigned scope | Admin / Scoped      |
| Modify system policies         | No              | No                             | No                 | No             | Admin only / No     |

### 6.2 Independent state dimensions

| **Dimension** | **Examples**                                                                             | **Important invariant**                                                |
|---------------|------------------------------------------------------------------------------------------|------------------------------------------------------------------------|
| Submission    | DRAFT → SUBMITTED → UNDER_SCRUTINY → RETURNED/ACCEPTED/REJECTED                          | All returned/rejected changes require a reason.                        |
| Verification  | NOT_CHECKED / DOC_REVIEWED / BANK_PENDING / BANK_CONFIRMED / DISCREPANCY                 | “DOC_REVIEWED” is not BANK_CONFIRMED.                                  |
| Instrument    | ACTIVE / APPROACHING_MATURITY / MATURED / SUPERSEDED / RELEASED                          | Date calculation must not directly assert regulatory release.          |
| Obligation    | OPEN / REVIEW_REQUIRED / SATISFIED / RELEASE_PENDING / CLOSED                            | May remain OPEN after one instrument matures.                          |
| Release case  | DRAFT / SUBMITTED / CLEARANCES_PENDING / DECISION_PENDING / APPROVED / REJECTED / CLOSED | Approval requires explicitly delegated human authority and conditions. |

### 6.3 Business rules

- Every transition checks current state, actor permission, record ownership, required evidence and applicable policy version in one transaction.
- A matured FDR is a monitoring finding; do not automatically renew, close the obligation or approve release.
- Release eligibility is a computed, explainable checklist, not a synonym for “FDR matured.”
- Store human overrides with explicit reason, authority identity and evidence, never silently mutate the earlier record.
- A bank-issued verification, when supported, includes authoritative response identity, timestamp and provenance; a demo stub can never be promoted to BANK_CONFIRMED.

## 7. Technical design and persistence

### 7.1 Proposed stack

| **Layer**           | **Technology / responsibility**                                                                                 |
|---------------------|-----------------------------------------------------------------------------------------------------------------|
| Frontend            | Next.js + React + TypeScript, Tailwind CSS and shadcn/ui; keyboard accessible tables and forms.                 |
| Backend             | Next.js route handlers/server functions or FastAPI; one trusted domain-service layer for transitions and roles. |
| Persistence         | Supabase PostgreSQL; relational foreign keys, RLS, constraints, indexes, transactional case changes.            |
| Identity/files      | Supabase Auth and PRIVATE Supabase Storage buckets; short-lived URL generation server-side.                     |
| Automation          | Cron/scheduled server job, dedupe keys, outbox notification pattern, structured event logs.                     |
| Hosting             | Vercel or compatible app host; private credentials only in trusted server environment.                          |
| External connectors | Versioned bank/AICTE adapter contracts; MOCK/SIMULATED mode only until formally authorized.                     |

### 7.2 Proposed tables (minimum working relational schema)

| **Table**                                   | **Key fields / constraints**                                                                                           |
|---------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| institutions, profiles, institution_members | Unique aicte_permanent_id where applicable; membership and region scopes; deny self-assigned roles.                    |
| policy_versions, policy_rules               | Rule code, effective_from/to, source clause, parameters, mandatory evidence, approval scope.                           |
| deposit_obligations                         | Institution FK, policy FK, purpose, amount, hold-end date if applicable, obligation status.                            |
| deposit_instruments                         | Obligation FK, instrument type, issuer/reference, amounts, dates, instrument status, unique normalized comparison key. |
| instrument_links                            | Prior and replacement instrument FKs, reason, date; prevent self-links and cycles.                                     |
| submissions, documents, document_versions   | Case FK, storage key, SHA-256, category, mime, file size, owner, version, reviewer and timestamps.                     |
| verification_checks, discrepancy_findings   | Check type, source/provenance enum, result, reason, evidence, reviewer and simulation flag.                            |
| release_requests, clearances, decisions     | Request state, required reviewer type, clearance evidence, blocker, delegated authority, rationale.                    |
| work_items, alerts, notification_outbox     | Assigned user/role, due date, alert idempotency key, read/acknowledgement, send attempt metadata.                      |
| audit_events                                | Append-only actor, role, case, prior/new values, reason, correlation id and timestamp.                                 |

### 7.3 Integrity requirements

- All IDs are UUIDs; amounts NUMERIC(18,2) or a domain-appropriate precision; dates and timestamps stored consistently.
- Foreign keys restrict deletion of historical, documented or approved cases; use soft deactivation when needed.
- Create indexes on institution, obligation, normalized reference+issuer, maturity date, case status, assigned officer, event time and alert dedupe key.
- Ensure idempotency for submission, alert, release transition and outbound notification retry.
- Transaction boundaries combine a decision, state transition, created work items and audit entry; no partial completion.

## 8. Security, privacy and operational non-functional requirements

### 8.1 Security P0 checks

- Authentication on protected endpoints; validated authorization on every read/write; RLS on all exposed institution-owned tables.
- Institution A cannot query Institution B by ID, URL, direct REST call or private file path; build explicit negative tests.
- No service-role key in client bundles, no public file buckets and no sensitive records in browser localStorage.
- Files: permitted PDF/PNG/JPG as configured, signature and size validation, isolated private path, safe preview, download authorization and malware scanning if available.
- Rate limit authentication, submissions and signing endpoints; prevent mass assignment, XSS, CSRF (as relevant), injection and request replay.
- Read-only auditors; official decisions require least-privilege role assignment and are permanently logged.
- Do not place personal data, FDR reference numbers, financial details, signing URLs or token secrets in publicly accessible logs or screenshots.

### 8.2 Performance, reliability and accessibility

| **Attribute**            | **Prototype target / measurement**                                                                                 |
|--------------------------|--------------------------------------------------------------------------------------------------------------------|
| Dashboard responsiveness | \<3 seconds under documented fixture and test environment, excluding initial cold start; paginate long registries. |
| Integrity                | 0 missing audit events in required test transitions; no orphan documents or replacement links.                     |
| Alerts                   | Correct one-time event generation across repeat scheduler runs; safe retries for notification delivery.            |
| Availability             | Clear failure states and retries; demo must not claim production uptime without evidence.                          |
| Accessibility            | Keyboard reachable controls, accessible labels, contrast and understandable validation errors.                     |
| Mobile                   | Responsive institution dashboard and actions; tables remain readable through drill-down.                           |
| Operational readiness    | Environment template, schema migration, synthetic seed script, rollback notes and error monitoring.                |

## 9. UI specification and navigation

### 9.1 Role-based pages

| **Page**                         | **Key content / primary action**                                                       |
|----------------------------------|----------------------------------------------------------------------------------------|
| Login / account request          | Verified organization, sign-in, recovery, invitation flows.                            |
| Overview                         | Role-scoped KPIs, approaching maturity, pending work, alerts, last actions.            |
| Institutions / obligations       | Organization master, applicable requirement and supporting instruments.                |
| FDR registry + detail            | Search/filters, chronological evidence, dates, discrepancies, reviewer and actions.    |
| New submission / upload          | Guided fields, inline validations, secure document confirmation and draft state.       |
| Scrutiny queue                   | Reason-sorted review tasks, clarification form and provenance-controlled verification. |
| Calendar / alerts                | Separate dates by type; acknowledgment and escalation explanation.                     |
| Renewal & replacement            | Side-by-side old/new instrument and immutable link history.                            |
| Release workspace                | Required checklist, clearances per bureau, blockers and delegated decision.            |
| Reports / audit / administration | Scope-filtered reports, immutable history, account & rule configuration.               |

### 9.2 Design system

Use restrained government-enterprise visual language: white backgrounds, navy headings, teal action highlights, accessible neutral surfaces and consistent semantic status colors. Avoid a visually “busy” AI dashboard. Each case should answer: What is this? What is wrong or due? Who must act? By when? What evidence supports the state?

> **Key UI innovation** Every case card includes a clear “Next action” strip: ACTION → OWNER → DUE DATE → REASON → EVIDENCE. This converts a passive registry into an operational case-management tool.

## 10. Integration strategy and AI boundaries

### 10.1 Bank verification adapter

Define a server-side interface such as verifyInstrument({issuer, maskedReference, amount, maturityDate, authorizationContext}). Returned values must include source type, response time, evidence reference, result, authenticity claim level and mock flag. In SIH demo mode, generate a controlled response from synthetic fixtures and label every result “SIMULATED — NOT BANK VERIFIED”. A real result needs an authorized bank-origin proof or sanctioned API.

### 10.2 AICTE integration adapter

Institution lookup can use locally seeded, explicitly synthetic AICTE Permanent IDs for the demo. A real registry synchronization requires an approved interface, reconciliation rules, service credentials, security review and treatment of duplicate/obsolete records. Neither the demo nor this PRD claims access to an official database.

### 10.3 Assisted OCR and recommendation constraints

Optional OCR is a convenience step for data entry. It can highlight a mismatched value or missing page and display an extract source; a trained official still determines whether documentary evidence is acceptable. Explainable deterministic rules remain the authoritative mechanism for flags and deadlines. Do not add generative approval, autonomous NOC issuance or uncalibrated fraud scores.

## 11. Prototype feature tiers and build order

| **Tier**                 | **Deliverable**                                                                                            | **Completion gate**                                                                       |
|--------------------------|------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------|
| P0 Foundation            | Login, separate institution/official/authority accounts; RLS; seeded data; obligation & instrument schema. | Cross-tenant test fails safely; data persists across sessions.                            |
| P0 Lifecycle             | FDR form, private files, scrutiny, finding explanations, maturity job, renewal links.                      | Submission → review → notification → linked replacement works.                            |
| P0 Release               | Release request, document checklist, mock clearances, delegated human decision, audit trail.               | Case blocked until required clearance evidence; recorded decision visible to institution. |
| P0 Evidence              | Database dashboards, role work queue, clear simulation labels, scripted demo, basic tests.                 | Live demo follows the exact SIH acceptance scenarios.                                     |
| P1 Differentiation       | OCR review-assisted import, scoped exports, cohort analytics and advanced escalations.                     | Improves task time with measured prototype result.                                        |
| P2 Authorized production | Bank/AICTE integration, pen test, hosting approval, retention policy, production monitoring.               | Separate institutional authorization and independent security assurance.                  |

### 11.1 Practical implementation sequence

- Milestone A: finalize minimal schema and permissions; seed two institutions and four official accounts; prove no cross-tenant leaks.
- Milestone B: complete data-backed submission and scrutiny; upload and download private files.
- Milestone C: add date-based findings, server scheduler and replacement links; show complete trace.
- Milestone D: implement release clearance and authority decision path; test blockers and audit.
- Milestone E: polish dashboards, deploy, collect measurable baseline numbers and rehearse the demo.
- For an eight-hour local build sprint, prioritize one complete instrument case plus one blocked release case; the SIH rules do not themselves prescribe an eight-hour product-development deadline.

## 12. Demonstration story and synthetic dataset

### 12.1 Six-minute walkthrough

| **Time**  | **Action**                                                                                     | **Judges see**                                                 |
|-----------|------------------------------------------------------------------------------------------------|----------------------------------------------------------------|
| 0:00–0:45 | Sign in as Institution A; open existing obligation and FDR.                                    | Real organization-specific record, amount, dates and document. |
| 0:45–1:35 | Submit FDR with one missing field / duplicate reference.                                       | Immediate explainable validation and official queue entry.     |
| 1:35–2:20 | Switch official; review discrepancy and request clarification.                                 | Role separation, observation and event history.                |
| 2:20–3:10 | Show maturity dashboard; run a safe demo-date alert job.                                       | Due event, notification, owner and deduplication.              |
| 3:10–4:00 | Submit replacement FDR; open old/new timeline.                                                 | Linked history without overwriting the old record.             |
| 4:00–5:10 | Request release; show PGRC clearance missing; then record demo clearance and authority action. | Guarded release workflow and decision audit.                   |
| 5:10–6:00 | Attempt cross-institution URL; open officer dashboard and audit.                               | Denied access, case-wide visibility and authenticity labels.   |

### 12.2 Seed fixtures

- Institution A: compliant active FDR approaching maturity, plus a pending renewal instrument.
- Institution B: another FDR with matching normalized number for discrepancy detection (issuer scope carefully chosen).
- Institution A: release request with missing PGRC clearance, then a reviewable simulated clearance response.
- Institution C: a matured instrument whose regulatory deposit holding period is not necessarily complete.
- At least one document mismatch, one successful document review, one simulated bank result and a complete audit sequence.

## 13. Acceptance tests (must pass in a recorded demo)

| **ID** | **Input / action**                                                    | **Expected outcome**                                                                            |
|--------|-----------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| AC-01  | Institution A logs in and opens institution B case ID.                | 403/404 without data leakage; security event recorded.                                          |
| AC-02  | Submit valid FDR and upload approved PDF.                             | Persistent record + private document + unique reference + audit.                                |
| AC-03  | Submit missing mandatory proof / invalid dates.                       | Blocked or review-flagged with named, actionable reason.                                        |
| AC-04  | Request independent verification with no authorized provider.         | Remains pending or clearly SIMULATED; never “bank verified.”                                    |
| AC-05  | Run date monitor repeatedly on same seeded event.                     | Single configured alert per recipient/threshold, not duplicates.                                |
| AC-06  | Replace FDR A with instrument A2.                                     | A unchanged and linked to A2; reviewer can see both.                                            |
| AC-07  | Attempt final release decision with PGRC pending.                     | Blocked; clear explanation and responsible reviewer shown.                                      |
| AC-08  | Record all applicable mock clearances + competent-authority decision. | Decision and provenance in audit; institution sees new state.                                   |
| AC-09  | Try institution account calling official decision endpoint.           | Permission denied at server/database layer.                                                     |
| AC-10  | Refresh dashboard and sign in from another account.                   | Numbers reconcile to underlying DB and role scope.                                              |
| AC-11  | Overwrite or delete an old accepted document version.                 | Denied or versioned; history remains discoverable.                                              |
| AC-12  | Modify policy version after a case is created.                        | Case retains linked applicable policy/evaluation evidence; new cases use new rules as intended. |

## 14. Evaluation methodology and evidence

The official SIH statement requests measurable improvements. Do not publish invented percentages. Run a small, controlled comparison against a documented manual workflow using the same synthetic dataset and report time, correctness and visibility together.

| **Metric**              | **Method**                                                      | **Evidence to present**                                                |
|-------------------------|-----------------------------------------------------------------|------------------------------------------------------------------------|
| Record correctness      | Check stored fields for 20 seeded cases against fixture source. | Verified correct fields / total required fields; discrepancy findings. |
| Submission effort       | Time same operator entering 5 cases in manual sheet vs portal.  | Median seconds and error count, plus scope of test.                    |
| Verification turnaround | Time officer to discover and resolve 5 seeded mismatches.       | Median action time; no claim of bank authenticity.                     |
| Maturity alert coverage | Run scheduled rules against 10 known date scenarios.            | Correct alerts, false positives and idempotency replays.               |
| Renewal traceability    | Inspect all replacement chains in fixture.                      | Correctly linked replacements / eligible replacements.                 |
| Release compliance      | Test 4 clearance combinations including a blocker.              | No unauthorized final decisions; visible checklist evidence.           |
| Action visibility       | Count assigned unresolved tasks discoverable in one queue.      | Visible / expected actionable cases and ageing.                        |
| Access security         | Execute cross-tenant/read-only/unauthorized action tests.       | Explicit pass/fail log, not a certification assertion.                 |

### 14.1 Judging narrative

Problem: scattered evidence and follow-up delays. Design: one obligation-based case record with instrument history. Automation: rule-based monitoring and action queues. Trust: precise verification provenance, private evidence, clearance gates and audit trails. Impact: only measured reductions and successful negative tests from the working prototype. This framing is a recommendation for demonstrating the SIH requirements, not a statement about official judging weights.

## 15. Risk register, assumptions and decisions

| **Risk / uncertainty**                                        | **Mitigation or open decision**                                                    |
|---------------------------------------------------------------|------------------------------------------------------------------------------------|
| No authorized bank verification API                           | Use a clearly labelled simulation contract. Do not imply real authenticity checks. |
| Inconsistent APH applicability, exceptions and policy updates | Version policy rules and require AICTE validation before production use.           |
| Different release authorities by instrument and case          | Maintain configurable delegation and clearance matrix; never infer automatically.  |
| Maturity may precede statutory release eligibility            | Display separate dates and explicit blocker reason.                                |
| Unknown institution data / AICTE Permanent ID eligibility     | Seed synthetic data; real master-registry ingestion remains a dependency.          |
| Sensitive uploads and regulatory documents                    | Private storage, least privilege, size limits, masking, retention approval.        |
| Deadline or notification misfire                              | Idempotency keys, visible run logs, retry status and tests.                        |
| Scope inflation during hackathon                              | Complete P0 release + verification + renewal story before P1 OCR/analytics.        |
| Overclaim of operational improvement                          | Document fixture size, baseline process and observed result only.                  |

### 15.1 Questions for AICTE stakeholders before a real deployment

- Which APH editions, amendments and institution categories apply to each security deposit obligation?
- What is the authoritative bank verification mechanism (if any), and how is its result evidentially accepted?
- Which officers/bureaus may scrutinize, recommend, clear and approve each release instrument type?
- Which prescribed documents, mandatory clearances and exceptional release cases must be encoded?
- What official system provides institution identity, deposit proof, complaint/disciplinary blockers and historical cases?
- Where must data be hosted, how long retained, who can export, and which audit/backup obligations apply?

## 16. Delivery checklist

- Working hosted URL and seeded credentials for at least Institution A, Institution B, Case Officer and Decision Authority.
- SQL migrations and seed data; private file-storage policies; no repository secrets.
- Short architecture / data-model diagram showing institution → obligation → instrument → evidence → case → audit.
- End-to-end demo script, 12 acceptance results and 2 negative authorization tests.
- Clear disclaimer next to all simulated bank verification and clearance actions.
- Small metric sheet with task timing/test observations and precise sample size.
- README documenting setup, env vars, rule configuration, limitations and future authorized integration points.

## 17. References and document control

Primary problem source (official): Smart India Hackathon 2026 Problem Statements, SIH26265, “Streamline of security deposit/ FDR portal.” https://sih.gov.in/sih2026PS (checked 30 October 2026).

Regulatory reference (official): AICTE, Approval Process Handbook 2024–2027, especially clause 1.12 Security Deposit and clause 6.46 Release of Security Deposit. https://aicte.gov.in/sites/default/files/APH%20Final.pdf (checked 30 October 2026).

Source document provided by the user: “AICTE_Smart_FDR_Portal_PRD.docx”, PRD v1.0, 16 pages. This v2.0 preserves its core security and lifecycle requirements while adapting prioritization and regulatory workflow details to the cited problem statement and APH.

> **Status and approval** Proposed SIH engineering specification only. Bank integration, official institutional master data, release-clearance rules, hosting, data retention, legal correctness and signing authority require authorized stakeholder validation before production deployment.
