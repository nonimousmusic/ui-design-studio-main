import { DEMO_TODAY, daysFromToday, maturityBucket, normalizeReference } from "./format";
import type {
  Alert,
  AuditEvent,
  Clearance,
  DepositInstrument,
  DepositObligation,
  DocumentRecord,
  Institution,
  PortalState,
  ReleaseCase,
  Role,
  User,
  VerificationFinding,
  WorkItem,
} from "./types";

export type Capability =
  | "create_submission"
  | "scrutinise"
  | "record_clearance"
  | "decide_release"
  | "manage_admin"
  | "view_admin"
  | "view_institutions"
  | "view_reports"
  | "create_release"
  | "upload_document";

const PERMISSIONS: Record<Role, Capability[]> = {
  INSTITUTION_ADMIN: ["create_submission", "create_release", "upload_document"],
  CASE_OFFICER: [
    "scrutinise",
    "record_clearance",
    "view_institutions",
    "view_reports",
    "upload_document",
  ],
  CLEARANCE_REVIEWER: ["record_clearance", "view_institutions", "view_reports"],
  DECISION_AUTHORITY: ["decide_release", "view_institutions", "view_reports"],
  ADMIN: [
    "create_submission",
    "scrutinise",
    "record_clearance",
    "manage_admin",
    "view_admin",
    "view_institutions",
    "view_reports",
    "create_release",
    "upload_document",
  ],
  AUDITOR: ["view_admin", "view_institutions", "view_reports"],
};

export const can = (user: User | null, capability: Capability): boolean =>
  Boolean(user && PERMISSIONS[user.role].includes(capability));

export const isInstitutionRole = (user: User | null): boolean => user?.role === "INSTITUTION_ADMIN";

export const isReadOnly = (user: User | null): boolean => user?.role === "AUDITOR";

export const roleLabel: Record<Role, string> = {
  INSTITUTION_ADMIN: "Institution administrator",
  CASE_OFFICER: "AICTE case officer",
  CLEARANCE_REVIEWER: "Clearance reviewer",
  DECISION_AUTHORITY: "Competent authority",
  ADMIN: "System administrator",
  AUDITOR: "Auditor · read-only",
};

export const scopeLabel = (user: User | null, state: PortalState): string => {
  if (!user) return "Signed out";
  if (user.role === "INSTITUTION_ADMIN") {
    const institution = state.institutions.find((i) => i.id === user.institutionId);
    return institution ? `${institution.name} · ${institution.permanentId}` : "Own institution";
  }
  if (user.role === "AUDITOR") return "All institutions · read-only";
  return "All regions · AICTE Regulation Bureau";
};

export const canSeeInstitution = (user: User | null, institutionId: string): boolean => {
  if (!user) return false;
  if (user.role === "INSTITUTION_ADMIN") return user.institutionId === institutionId;
  return true;
};

export const visibleInstruments = (state: PortalState, user: User | null): DepositInstrument[] => {
  if (!user) return [];
  if (user.role === "INSTITUTION_ADMIN") {
    return state.instruments.filter(
      (instrument) => instrument.institutionId === user.institutionId,
    );
  }
  if (user.role === "CLEARANCE_REVIEWER") {
    const releaseIds = new Set(
      state.releases
        .filter((release) =>
          release.clearances.some(
            (clearance) =>
              clearance.reviewerRole === "CLEARANCE_REVIEWER" || clearance.simulationFlag,
          ),
        )
        .map((release) => release.instrumentId),
    );
    return state.instruments.filter((instrument) => releaseIds.has(instrument.id));
  }
  return state.instruments;
};

export const visibleInstitutions = (state: PortalState, user: User | null): Institution[] => {
  if (!user) return [];
  if (user.role === "INSTITUTION_ADMIN") {
    return state.institutions.filter((institution) => institution.id === user.institutionId);
  }
  return state.institutions;
};

export const visibleReleases = (state: PortalState, user: User | null): ReleaseCase[] => {
  if (!user) return [];
  if (user.role === "INSTITUTION_ADMIN") {
    return state.releases.filter((release) => release.institutionId === user.institutionId);
  }
  return state.releases;
};

export const visibleAlerts = (state: PortalState, user: User | null): Alert[] => {
  if (!user) return [];
  if (user.role === "INSTITUTION_ADMIN") {
    return state.alerts.filter((alert) => alert.institutionId === user.institutionId);
  }
  return state.alerts;
};

export const visibleAudit = (state: PortalState, user: User | null): AuditEvent[] => {
  if (!user) return [];
  if (user.role === "INSTITUTION_ADMIN") {
    return state.audit.filter((event) => event.institutionId === user.institutionId);
  }
  return state.audit;
};

export const visibleWorkItems = (state: PortalState, user: User | null): WorkItem[] => {
  if (!user) return [];
  if (user.role === "INSTITUTION_ADMIN") {
    return state.workItems.filter((item) => item.institutionId === user.institutionId);
  }
  return state.workItems;
};

export const institutionOf = (state: PortalState, id: string): Institution | undefined =>
  state.institutions.find((institution) => institution.id === id);

export const obligationOf = (state: PortalState, id: string): DepositObligation | undefined =>
  state.obligations.find((obligation) => obligation.id === id);

export const instrumentOf = (state: PortalState, id: string): DepositInstrument | undefined =>
  state.instruments.find((instrument) => instrument.id === id);

export const releaseOf = (state: PortalState, id: string): ReleaseCase | undefined =>
  state.releases.find((release) => release.id === id);

export const documentsOf = (state: PortalState, instrumentId: string): DocumentRecord[] =>
  state.documents
    .filter((document) => document.instrumentId === instrumentId)
    .sort((a, b) => a.category.localeCompare(b.category) || b.version - a.version);

export const findingsOf = (state: PortalState, instrumentId: string): VerificationFinding[] =>
  state.findings.filter((finding) => finding.instrumentId === instrumentId);

export const openFindingsOf = (state: PortalState, instrumentId: string): VerificationFinding[] =>
  findingsOf(state, instrumentId).filter((finding) => finding.status === "OPEN");

export const releaseForInstrument = (
  state: PortalState,
  instrumentId: string,
): ReleaseCase | undefined =>
  state.releases.find(
    (release) => release.instrumentId === instrumentId && release.status !== "CLOSED",
  );

export const workItemFor = (state: PortalState, entityId: string): WorkItem | undefined =>
  state.workItems.find((item) => item.entityId === entityId && item.status !== "DONE");

export interface Blocker {
  label: string;
  owner: string;
}

const clearanceOwner = (clearance: Clearance): string =>
  clearance.required ? "Clearance reviewer / supervisory officer" : "Case officer";

export const releaseBlockers = (state: PortalState, release: ReleaseCase): Blocker[] => {
  const blockers: Blocker[] = [];
  if (release.status === "DRAFT") {
    blockers.push({
      label: "Release request has not been submitted",
      owner: "Institution administrator",
    });
  }
  for (const item of release.checklist) {
    if (item.required && !item.done) {
      blockers.push({
        label: `Checklist: ${item.label}`,
        owner: "Institution administrator / case officer",
      });
    }
  }
  for (const clearance of release.clearances) {
    if (
      clearance.required &&
      clearance.status !== "CLEARED" &&
      clearance.status !== "NOT_APPLICABLE"
    ) {
      blockers.push({
        label: `${clearance.bureau} clearance — ${clearance.status.replace(/_/g, " ").toLowerCase()}`,
        owner: clearanceOwner(clearance),
      });
    }
  }
  for (const finding of state.findings.filter(
    (item) =>
      item.instrumentId === release.instrumentId &&
      item.status === "OPEN" &&
      item.severity === "HIGH",
  )) {
    blockers.push({
      label: `Open finding ${finding.code}: ${finding.field}`,
      owner: "Case officer",
    });
  }
  return blockers;
};

export const releaseReady = (state: PortalState, release: ReleaseCase): boolean =>
  releaseBlockers(state, release).length === 0;

export const decisionAllowed = (
  state: PortalState,
  release: ReleaseCase,
  user: User | null,
): boolean =>
  can(user, "decide_release") &&
  releaseReady(state, release) &&
  !release.decision &&
  !["APPROVED", "REJECTED", "CLOSED"].includes(release.status);

export interface NextAction {
  action: string;
  owner: string;
  due: string;
  reason: string;
  evidence: string;
}

export const nextActionFor = (state: PortalState, instrument: DepositInstrument): NextAction => {
  const findings = openFindingsOf(state, instrument.id);
  const workItem = workItemFor(state, instrument.id);
  const documents = documentsOf(state, instrument.id);
  const latestDocument = documents[0];
  const due = workItem?.dueDate ?? instrument.maturityDate;

  if (instrument.submissionStatus === "DRAFT") {
    return {
      action: "Complete and submit draft",
      owner: "Institution administrator",
      due,
      reason: "Draft is not visible to the scrutiny queue",
      evidence: latestDocument ? latestDocument.name : "No documents attached",
    };
  }
  if (instrument.submissionStatus === "RETURNED") {
    return {
      action: "Re-upload corrected documents",
      owner: "Institution administrator",
      due,
      reason: findings[0]?.code ?? "Returned for correction",
      evidence: latestDocument ? latestDocument.name : "No documents",
    };
  }
  if (instrument.submissionStatus === "REJECTED") {
    return {
      action: "No action — submission rejected",
      owner: "Institution administrator",
      due,
      reason: "Rejection reason recorded in audit",
      evidence: latestDocument?.name ?? "—",
    };
  }
  if (findings.length > 0) {
    return {
      action: `Resolve ${findings[0]?.code ?? "finding"}`,
      owner: "Case officer",
      due,
      reason: findings[0]?.nextAction ?? "Deterministic finding requires review",
      evidence: latestDocument
        ? `${latestDocument.name} v${latestDocument.version}`
        : "Evidence pending",
    };
  }
  if (
    instrument.submissionStatus === "SUBMITTED" ||
    instrument.submissionStatus === "UNDER_SCRUTINY"
  ) {
    return {
      action: "Complete documentary scrutiny",
      owner: "Case officer",
      due,
      reason: workItem?.reasonCode ?? "Review due",
      evidence: latestDocument
        ? `${latestDocument.name} v${latestDocument.version}`
        : "Evidence pending",
    };
  }
  if (instrument.instrumentStatus === "MATURED" && !instrument.holdEndDate) {
    return {
      action: "Confirm regulatory hold term",
      owner: "Case officer",
      due,
      reason: "Instrument matured; maturity does not imply release eligibility",
      evidence: "Regulatory hold end not recorded",
    };
  }
  if (instrument.instrumentStatus === "MATURED") {
    return {
      action: "Assess release prerequisites",
      owner: "Institution administrator",
      due,
      reason: "Bank maturity passed; release requires checklist and clearances",
      evidence: latestDocument?.name ?? "Evidence on file",
    };
  }
  if (instrument.instrumentStatus === "RELEASED") {
    return {
      action: "No action — release recorded",
      owner: "Competent authority",
      due: instrument.updatedAt.slice(0, 10),
      reason: "Decision recorded; outcome visible to institution",
      evidence: "Decision in audit trail",
    };
  }
  if (instrument.instrumentStatus === "SUPERSEDED") {
    return {
      action: "No action — superseded",
      owner: "Case officer",
      due: instrument.updatedAt.slice(0, 10),
      reason: "Replaced by a later accepted instrument",
      evidence: "Renewal chain preserved",
    };
  }
  const days = daysFromToday(instrument.maturityDate);
  if (days >= 0 && days <= 90) {
    return {
      action: "Submit renewal FDR",
      owner: "Institution administrator",
      due: instrument.maturityDate,
      reason: `Bank maturity in ${days} days; regulatory hold continues separately`,
      evidence: latestDocument
        ? `${latestDocument.name} v${latestDocument.version}`
        : "Evidence on file",
    };
  }
  return {
    action: "Monitor — no action due",
    owner: "Case officer",
    due: instrument.maturityDate,
    reason: "Record accepted and within monitoring window",
    evidence: latestDocument
      ? `${latestDocument.name} v${latestDocument.version}`
      : "Evidence on file",
  };
};

export interface PortfolioKpis {
  totalHeld: number;
  instrumentCount: number;
  awaitingScrutiny: number;
  maturing: number;
  openDiscrepancies: number;
  releaseHeld: number;
  overdueActions: number;
  institutions: number;
}

export const kpis = (state: PortalState, user: User | null): PortfolioKpis => {
  const instruments = visibleInstruments(state, user);
  const findings = state.findings.filter(
    (finding) =>
      finding.status === "OPEN" &&
      instruments.some((instrument) => instrument.id === finding.instrumentId),
  );
  const held = instruments.filter((instrument) =>
    ["ACTIVE", "APPROACHING_MATURITY", "MATURED"].includes(instrument.instrumentStatus),
  );
  const releases = visibleReleases(state, user);
  return {
    totalHeld: held.reduce((sum, instrument) => sum + instrument.amount, 0),
    instrumentCount: instruments.length,
    awaitingScrutiny: instruments.filter((instrument) =>
      ["SUBMITTED", "UNDER_SCRUTINY"].includes(instrument.submissionStatus),
    ).length,
    maturing: instruments.filter((instrument) => {
      const days = daysFromToday(instrument.maturityDate);
      return days >= 0 && days <= 60 && instrument.instrumentStatus !== "RELEASED";
    }).length,
    openDiscrepancies: findings.length,
    releaseHeld: releases.filter(
      (release) => !["APPROVED", "REJECTED", "CLOSED"].includes(release.status),
    ).length,
    overdueActions: visibleWorkItems(state, user).filter(
      (item) =>
        item.status !== "DONE" &&
        ["OPEN", "OVERDUE", "IN_PROGRESS"].includes(item.status) &&
        daysFromToday(item.dueDate) < 0,
    ).length,
    institutions: visibleInstitutions(state, user).length,
  };
};

export const holdingsByRegion = (
  state: PortalState,
  user: User | null,
): { region: string; value: number; count: number }[] => {
  const institutions = visibleInstitutions(state, user);
  const instruments = visibleInstruments(state, user);
  const map = new Map<string, { value: number; count: number }>();
  for (const institution of institutions) {
    const held = instruments.filter(
      (instrument) =>
        instrument.institutionId === institution.id &&
        ["ACTIVE", "APPROACHING_MATURITY", "MATURED"].includes(instrument.instrumentStatus),
    );
    const current = map.get(institution.region) ?? { value: 0, count: 0 };
    map.set(institution.region, {
      value: current.value + held.reduce((sum, instrument) => sum + instrument.amount, 0),
      count: current.count + held.length,
    });
  }
  return [...map.entries()]
    .map(([region, data]) => ({ region, ...data }))
    .sort((a, b) => b.value - a.value);
};

export const maturityBuckets = (state: PortalState, user: User | null) => {
  const buckets = ["Matured", "0–30 days", "31–60 days", "61–180 days", "181–365 days", "> 1 year"];
  const instruments = visibleInstruments(state, user).filter(
    (instrument) =>
      instrument.instrumentStatus !== "RELEASED" && instrument.instrumentStatus !== "SUPERSEDED",
  );
  return buckets.map((bucket) => ({
    bucket,
    count: instruments.filter((instrument) => maturityBucket(instrument.maturityDate) === bucket)
      .length,
    value: instruments
      .filter((instrument) => maturityBucket(instrument.maturityDate) === bucket)
      .reduce((sum, instrument) => sum + instrument.amount, 0),
  }));
};

export const statusMix = (state: PortalState, user: User | null) => {
  const instruments = visibleInstruments(state, user);
  const statuses = ["ACCEPTED", "SUBMITTED", "UNDER_SCRUTINY", "RETURNED", "REJECTED", "DRAFT"];
  return statuses
    .map((status) => ({
      status,
      count: instruments.filter((instrument) => instrument.submissionStatus === status).length,
    }))
    .filter((entry) => entry.count > 0);
};

export const duplicateReferenceMatches = (
  state: PortalState,
  instrument: DepositInstrument,
): DepositInstrument[] =>
  state.instruments.filter(
    (other) =>
      other.id !== instrument.id &&
      normalizeReference(other.fdrNo) === normalizeReference(instrument.fdrNo) &&
      other.bank === instrument.bank,
  );

export const renewalChain = (
  state: PortalState,
  instrument: DepositInstrument,
): {
  previous?: DepositInstrument;
  next?: DepositInstrument;
} => {
  const previous = instrument.previousInstrumentId
    ? instrumentOf(state, instrument.previousInstrumentId)
    : undefined;
  const next = instrument.replacementInstrumentId
    ? instrumentOf(state, instrument.replacementInstrumentId)
    : undefined;
  return {
    ...(previous ? { previous } : {}),
    ...(next ? { next } : {}),
  };
};

export const isOverdue = (dueDate: string): boolean => daysFromToday(dueDate) < 0;

export { DEMO_TODAY };
