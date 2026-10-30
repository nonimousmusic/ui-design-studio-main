// Domain types for the AICTE Smart FDR Lifecycle Management Portal.
// These mirror the target PostgreSQL schema described in docs/DATA_MODEL.md.

export type Role =
  | "INSTITUTION_ADMIN"
  | "CASE_OFFICER"
  | "CLEARANCE_REVIEWER"
  | "DECISION_AUTHORITY"
  | "ADMIN"
  | "AUDITOR";

export type Region = "Northern" | "Western" | "Southern" | "Central" | "Eastern";

export type InstitutionStatus = "VERIFIED" | "PENDING";

export type InstrumentType = "FDR" | "RTGS" | "RPGF" | "OTHER";

export type SubmissionStatus =
  "DRAFT" | "SUBMITTED" | "UNDER_SCRUTINY" | "RETURNED" | "ACCEPTED" | "REJECTED";

export type VerificationStatus =
  "NOT_CHECKED" | "DOC_REVIEWED" | "BANK_PENDING" | "BANK_CONFIRMED" | "DISCREPANCY";

export type InstrumentStatus =
  "ACTIVE" | "APPROACHING_MATURITY" | "MATURED" | "SUPERSEDED" | "RELEASED";

export type ObligationStatus =
  "OPEN" | "REVIEW_REQUIRED" | "SATISFIED" | "RELEASE_PENDING" | "CLOSED";

export type Provenance =
  | "INSTITUTION_DECLARED"
  | "OFFICIAL_DOCUMENT_REVIEW"
  | "BANK_CONFIRMED_AUTHORIZED"
  | "SIMULATED_BANK_RESPONSE";

export type ReleaseStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "CLEARANCES_PENDING"
  | "DECISION_PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CLOSED";

export type ClearanceStatus =
  "NOT_REQUESTED" | "PENDING" | "CLEARED" | "OBJECTED" | "NOT_APPLICABLE";

export type DocumentStatus = "NOT_REVIEWED" | "ACCEPTED" | "NEEDS_CLARIFICATION";

export type FindingStatus = "OPEN" | "RESOLVED" | "ACCEPTED_RISK";

export type WorkStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "OVERDUE";

export type AlertType =
  "BANK_MATURITY" | "REGULATORY_HOLD" | "WORKFLOW_SLA" | "RENEWAL" | "RELEASE" | "DOCUMENT";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  initials: string;
  institutionId?: string;
  regions?: Region[];
}

export interface Institution {
  id: string;
  permanentId: string;
  name: string;
  shortName: string;
  region: Region;
  type: string;
  city: string;
  state: string;
  ownerName: string;
  ownerEmail: string;
  approvedSince: string;
  status: InstitutionStatus;
}

export interface PolicyRule {
  code: string;
  title: string;
  clause: string;
  requirement: string;
  amount?: number;
  holdYears?: number;
  checklist?: string[];
}

export interface PolicyVersion {
  id: string;
  label: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceClause: string;
  status: "ACTIVE" | "SUPERSEDED" | "DRAFT";
  rules: PolicyRule[];
}

export interface DepositObligation {
  id: string;
  institutionId: string;
  policyVersionId: string;
  purpose: string;
  amount: number;
  startDate: string;
  holdEndDate: string | null;
  status: ObligationStatus;
  requirementStatus: string;
  notes?: string;
}

export interface DocumentRecord {
  id: string;
  instrumentId: string;
  name: string;
  category: string;
  version: number;
  checksumSha256: string;
  sizeBytes: number;
  mime: string;
  uploadedAt: string;
  uploadedBy: string;
  reviewerStatus: DocumentStatus;
  note?: string;
}

export interface VerificationFinding {
  id: string;
  instrumentId: string;
  code: string;
  field: string;
  expected: string;
  observed: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  ruleVersion: string;
  status: FindingStatus;
  resolution?: string;
  nextAction: string;
}

export interface DepositInstrument {
  id: string;
  obligationId: string;
  institutionId: string;
  type: InstrumentType;
  fdrNo: string;
  referenceKey: string;
  bank: string;
  branch: string;
  ifsc: string;
  amount: number;
  issueDate: string;
  maturityDate: string;
  holdEndDate: string | null;
  instrumentStatus: InstrumentStatus;
  submissionStatus: SubmissionStatus;
  verificationStatus: VerificationStatus;
  provenance: Provenance;
  officer: string;
  previousInstrumentId?: string;
  replacementInstrumentId?: string;
  replacementReason?: string;
  simulatedCheck?: {
    at: string;
    result: "MATCH" | "MISMATCH";
    evidenceRef: string;
    note: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  done: boolean;
  evidence?: string;
  updatedAt?: string;
}

export interface Clearance {
  id: string;
  bureau: string;
  required: boolean;
  status: ClearanceStatus;
  note: string;
  reviewer?: string;
  reviewerRole?: Role;
  updatedAt?: string;
  simulationFlag?: boolean;
}

export interface Decision {
  outcome: "APPROVED" | "REJECTED";
  authorityId: string;
  authorityName: string;
  decidedAt: string;
  rationale: string;
  conditions: string;
  instrumentRoute: "NOC_RECORD" | "SANCTION_ORDER" | null;
}

export interface ReleaseCase {
  id: string;
  obligationId: string;
  instrumentId: string;
  institutionId: string;
  status: ReleaseStatus;
  requestedAt: string;
  requestedBy: string;
  reason: string;
  checklist: ChecklistItem[];
  clearances: Clearance[];
  decision?: Decision;
  createdAt: string;
}

export interface WorkItem {
  id: string;
  title: string;
  entityType: "INSTRUMENT" | "RELEASE" | "OBLIGATION";
  entityId: string;
  institutionId: string;
  assigneeId: string;
  assigneeName: string;
  ownerRole: Role;
  dueDate: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  reasonCode: string;
  status: WorkStatus;
  createdAt: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  detail: string;
  entityId: string;
  institutionId: string;
  recipient: string;
  triggerDate: string;
  threshold: string;
  acknowledged: boolean;
  escalated: boolean;
  delivery: "IN_APP" | "EMAIL_SIMULATED";
  dedupeKey: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  actorRole: Role | "SYSTEM";
  action: string;
  entityType:
    | "INSTRUMENT"
    | "DOCUMENT"
    | "RELEASE"
    | "CLEARANCE"
    | "DECISION"
    | "ALERT"
    | "POLICY"
    | "USER"
    | "OBLIGATION";
  entityId: string;
  institutionId?: string;
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  correlationId: string;
  source: "WEB_APP" | "SCHEDULER" | "SIMULATED_ADAPTER";
}

export interface PortalState {
  institutions: Institution[];
  policies: PolicyVersion[];
  obligations: DepositObligation[];
  instruments: DepositInstrument[];
  documents: DocumentRecord[];
  findings: VerificationFinding[];
  releases: ReleaseCase[];
  workItems: WorkItem[];
  alerts: Alert[];
  audit: AuditEvent[];
}

export interface NewInstrumentInput {
  institutionId: string;
  obligationId: string;
  type: InstrumentType;
  fdrNo: string;
  bank: string;
  branch: string;
  ifsc: string;
  amount: number;
  issueDate: string;
  maturityDate: string;
  holdEndDate: string | null;
  beneficiary: string;
  purpose: string;
  policyVersionId: string;
  previousInstrumentId?: string;
  replacementReason?: string;
  documents: DocumentInput[];
  officer: string;
}

export interface DocumentInput {
  name: string;
  category: string;
  mime: string;
  sizeBytes: number;
  checksumSha256: string;
  note?: string;
}

export interface ReleaseRequestInput {
  obligationId: string;
  instrumentId: string;
  reason: string;
  requestedBy: string;
}
