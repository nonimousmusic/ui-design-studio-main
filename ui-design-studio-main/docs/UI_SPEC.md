# UI Specification

## Design language

Restrained government-enterprise: white surfaces, navy headings/sidebar, teal action
accent, semantic status colors, IBM Plex Sans with IBM Plex Mono for identifiers.
No decorative AI-dashboard noise. Every case answers: **What is this? What is wrong
or due? Who acts? By when? What evidence supports the state?**

Core pattern — the **Next action strip**:

```
ACTION → OWNER → DUE → REASON → EVIDENCE
```

## Routes

| Route               | Access                    | Purpose                                                        |
| ------------------- | ------------------------- | -------------------------------------------------------------- |
| `/login`            | public                    | Demo persona sign-in, account request, guardrail notice        |
| `/`                 | signed in                 | Role-scoped overview, KPIs, charts, action queue               |
| `/institutions`     | officials/admin/auditor   | Institution master with holdings and risk                      |
| `/institutions/$id` | scoped                    | Institution profile, obligations, instruments, releases        |
| `/registry`         | signed in, scoped         | Filterable instrument registry + CSV export                    |
| `/registry/$id`     | scoped                    | Case detail: overview, documents, verification, renewal, audit |
| `/submissions/new`  | institution/admin         | 4-step guided submission with deterministic checks             |
| `/scrutiny`         | officials/admin           | SLA-sorted work queue + date-monitor demo                      |
| `/renewals`         | signed in, scoped         | Replacement chains, gap detection, pending reviews             |
| `/release`          | signed in, scoped         | Release case list; request a release                           |
| `/release/$id`      | scoped                    | Checklist, clearances, blocker gate, authority decision        |
| `/alerts`           | signed in, scoped         | Date types, acknowledgement, escalation, dedupe                |
| `/reports`          | officials/admin/auditor   | Portfolio charts, export, metric sheet                         |
| `/audit`            | signed in, scoped         | Append-only event log with before/after detail                 |
| `/admin`            | admin (auditor read-only) | Users/roles, policy versions, demo reset                       |

## Navigation

**Workspace**

- Overview
- FDR registry
- New submission (institution/admin)
- Renewals
- Release workspace

**Oversight**

- Institutions (officials/admin/auditor)
- Scrutiny queue (officials/admin)
- Calendar & alerts
- Reports (officials/admin/auditor)

**System**

- Audit trail
- Administration (admin/auditor)

Mobile: top bar with menu → left sheet; same sections. Bottom of sidebar shows
persona, role, and sign-out.

## Shared components

| Component         | Behavior                                                              |
| ----------------- | --------------------------------------------------------------------- |
| `AppShell`        | Session guard, sidebar, mobile sheet, top bar, demo banner            |
| `PageHeader`      | Title, subtitle, primary action                                       |
| `Panel`           | Bordered card with optional title/action                              |
| `StatCard`        | Label, value, hint, optional tone/icon                                |
| `StatusPill`      | Normalized status colors for all enums                                |
| `ProvenanceTag`   | Institution-declared / official-reviewed / bank-confirmed / SIMULATED |
| `NextActionStrip` | Five-cell action strip                                                |
| `ScopeDenied`     | Cross-tenant / insufficient-role explanation                          |
| `ReadOnlyBanner`  | Auditor and decided-case notice                                       |
| `ActionDialog`    | Reason + optional condition confirmation, audit-aware                 |
| `EmptyState`      | Icon, title, hint, optional action                                    |
| `Charts`          | Portfolio bar, maturity buckets, status donut, region bar             |

## Screen notes

### Login

Split screen. Left: product framing, SIH26265, guardrails. Right: persona quick-select,
email/password (any password accepted in demo), account request tab. On sign-in,
route to `/`. Persistent demo notice.

### Overview

- Shared dashboard: role/scope hero, five KPI cards, urgency-sorted attention queue,
  separate upcoming deadline list, release cards, and portfolio charts.
- Institution: own deposit totals, scoped open tasks, upcoming dates, and an
  instrument table with provenance and lifecycle status.
- New submissions CTA for institution; queue links for officials.

### Registry

Filters: text, status, region, instrument type, maturity window. Sort by maturity or
amount. Scoped rows. Result count and total value. CSV export respects scope and
masks reference numbers in exported “notes” only where required.

### Instrument detail

Header with identifier, institution, status, provenance, role-gated actions.
Overview: obligation context, separate date cards (bank maturity / regulatory hold /
review SLA), finding alert, next action strip.
Documents: versions, checksum, reviewer status; accept/clarify (officer), upload new
version (institution).
Verification: provenance ladder, checks, simulated bank response action; prominent
SIMULATED result card.
Renewal: side-by-side old/new, immutable old record, gap warning, file replacement.
Timeline: append-only audit events, newest first.

### Submission wizard

Steps: Institution & obligation → Instrument → Documents → Review.
Inline deterministic checks: amount vs obligation, duplicate reference, date order,
required documents. Draft saves quietly; submit creates work item, alert/audit, and
routes to detail. `?replaces=<instrumentId>` prefills and locks context.

### Scrutiny

Priority counters (overdue, due today, due this week), reason filter, rows with
institution, reference, finding, owner, due, age. “Run date monitor” generates only
missing threshold alerts and reports the count.

### Renewals

Chain cards grouped by obligation. Old record is visually immutable; pending
replacement is marked. Detect gaps where new issue date is after old maturity.
Actions: file replacement, open detail, accept replacement (officer).

### Release workspace

Left: checklist with required markers and evidence; right: clearance matrix with
bureau, status, note and simulate action for pending (labelled SIMULATED).
Blockers panel lists every unmet prerequisite and responsible role. Decision panel is
locked until all required items pass; only decision authority can approve/reject.
Approved outcome is marked `PROPOSED — NOT AN ISSUED NOC/SANCTION`.

### Alerts

Type legend and counters. Grouped by month, each row shows event date, type, linked
case, recipient, threshold, delivery, acknowledgement. Actions: acknowledge, escalate.
Rules panel states 90/60/30/15/7 and explains dedupe. Demo date-monitor button.

### Reports

Portfolio value by region, maturity buckets, status mix, release outcomes; scoped
export; metric sheet with sample size; “no invented percentages” note.

### Audit

Filter by actor, action, entity type. Table with time, actor/role, action, entity,
reason, correlation ID. Row expands to before/after JSON. Read-only banner.

### Admin

Tabs: Users & roles (persona switch, scope), Policy versions (rules, clauses,
effective dates, pinned case notes), Demo & integrations (reset, counts, adapter
status, guardrails).

## Accessibility

- Every control is keyboard reachable; visible focus ring inherited from primitives.
- Icon-only buttons have `aria-label` and tooltips.
- Tables use real `<table>` semantics; mobile drill-down uses cards.
- Status is never conveyed by color alone — text labels accompany every pill.
- Dialogs use Radix focus trapping, titles, and descriptions.
- Form fields have labels, hints, and inline errors.
- Contrast: navy/teal on white and white on navy meet AA for normal text.

## Responsive rules

- ≥1024px: 256px sidebar, multi-column grids.
- 768–1023px: collapsed sidebar via sheet, 2-column grids.
- <768px: sheet navigation, single-column panels, horizontally scrollable tables with
  row drill-down, sticky page actions where practical.
