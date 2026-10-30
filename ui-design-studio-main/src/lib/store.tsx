import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { addDays, DEMO_TODAY, daysFromToday, normalizeReference, uid } from "./format";
import { seedState } from "./seed";
import { can, releaseReady } from "./selectors";
import { useSession } from "./session";
import type {
  Alert,
  AuditEvent,
  ClearanceStatus,
  DepositInstrument,
  DocumentInput,
  DocumentStatus,
  NewInstrumentInput,
  PortalState,
  ReleaseCase,
  ReleaseRequestInput,
  Role,
  User,
  WorkItem,
} from "./types";

const STORAGE_KEY = "aicte-fdr-portal-v1";

export interface ActionResult {
  ok: boolean;
  message: string;
  id?: string;
}

interface PortalContextValue {
  state: PortalState;
  submitInstrument: (input: NewInstrumentInput, mode: "draft" | "submit") => ActionResult;
  startScrutiny: (instrumentId: string) => ActionResult;
  requestClarification: (instrumentId: string, reason: string) => ActionResult;
  recordDocumentReview: (documentId: string, status: DocumentStatus, note: string) => ActionResult;
  recordReview: (instrumentId: string) => ActionResult;
  resolveFinding: (findingId: string, resolution: string, acceptedRisk?: boolean) => ActionResult;
  acceptInstrument: (instrumentId: string, note: string) => ActionResult;
  returnInstrument: (instrumentId: string, reason: string) => ActionResult;
  rejectInstrument: (instrumentId: string, reason: string) => ActionResult;
  simulateBankResponse: (instrumentId: string, result: "MATCH" | "MISMATCH") => ActionResult;
  uploadDocument: (instrumentId: string, input: DocumentInput) => ActionResult;
  createRelease: (input: ReleaseRequestInput) => ActionResult;
  toggleChecklistItem: (releaseId: string, itemId: string) => ActionResult;
  recordClearance: (
    releaseId: string,
    clearanceId: string,
    status: ClearanceStatus,
    note: string,
    simulate?: boolean,
  ) => ActionResult;
  decideRelease: (
    releaseId: string,
    outcome: "APPROVED" | "REJECTED",
    rationale: string,
    conditions: string,
  ) => ActionResult;
  acknowledgeAlert: (alertId: string) => ActionResult;
  escalateAlert: (alertId: string) => ActionResult;
  runDateMonitor: () => { created: number; message: string };
  resetDemo: () => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

const demoNow = (): string => {
  const time = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${DEMO_TODAY} ${pad(time.getHours())}:${pad(time.getMinutes())}`;
};

const cloneSeed = (): PortalState => structuredClone(seedState);

const systemActor: User = {
  id: "system",
  name: "Date monitor",
  email: "system@aicte.demo",
  role: "ADMIN",
  title: "Scheduled job",
  initials: "SY",
};

interface AuditOptions {
  reason?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  source?: AuditEvent["source"];
  actorRole?: Role | "SYSTEM";
}

const makeAudit = (
  user: User | null,
  action: string,
  entityType: AuditEvent["entityType"],
  entityId: string,
  institutionId: string | undefined,
  options: AuditOptions = {},
): AuditEvent => ({
  id: uid("ae"),
  at: demoNow(),
  actorId: user?.id ?? systemActor.id,
  actorName: user?.name ?? systemActor.name,
  actorRole: options.actorRole ?? user?.role ?? "SYSTEM",
  action,
  entityType,
  entityId,
  ...(institutionId ? { institutionId } : {}),
  ...(options.reason ? { reason: options.reason } : {}),
  ...(options.before ? { before: options.before } : {}),
  ...(options.after ? { after: options.after } : {}),
  correlationId: uid("corr"),
  source: options.source ?? "WEB_APP",
});

const withAudit = (state: PortalState, event: AuditEvent): PortalState => ({
  ...state,
  audit: [event, ...state.audit],
});

const deriveInstrumentStatus = (
  maturityDate: string,
  current: DepositInstrument["instrumentStatus"] = "ACTIVE",
): DepositInstrument["instrumentStatus"] => {
  if (current === "RELEASED" || current === "SUPERSEDED") return current;
  const days = daysFromToday(maturityDate);
  if (days < 0) return "MATURED";
  if (days <= 90) return "APPROACHING_MATURITY";
  return "ACTIVE";
};

const institutionAdminName = (state: PortalState, institutionId: string): string =>
  state.institutions.find((institution) => institution.id === institutionId)?.ownerName ??
  "Institution administrator";

const makeWorkItem = (state: PortalState, item: Omit<WorkItem, "id" | "createdAt">): WorkItem => ({
  ...item,
  id: uid("wi"),
  createdAt: demoNow(),
});

const closeWorkItems = (state: PortalState, entityId: string, reasonCode?: string): WorkItem[] =>
  state.workItems.map((item) =>
    item.entityId === entityId &&
    item.status !== "DONE" &&
    (!reasonCode || item.reasonCode === reasonCode)
      ? { ...item, status: "DONE" }
      : item,
  );

export function PortalProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const [state, setState] = useState<PortalState>(() => cloneSeed());
  const stateRef = useRef(state);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PortalState;
        if (
          parsed &&
          Array.isArray(parsed.institutions) &&
          Array.isArray(parsed.instruments) &&
          Array.isArray(parsed.releases)
        ) {
          stateRef.current = parsed;
          setState(parsed);
        }
      }
    } catch {
      // A corrupt demo snapshot falls back to seed data.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full/unavailable: keep working in memory.
    }
  }, [state, hydrated]);

  const commit = useCallback((next: PortalState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const submitInstrument = useCallback(
    (input: NewInstrumentInput, mode: "draft" | "submit"): ActionResult => {
      if (!can(user, "create_submission")) {
        return { ok: false, message: "Your role cannot create submissions." };
      }
      if (user?.role === "INSTITUTION_ADMIN" && user.institutionId !== input.institutionId) {
        return { ok: false, message: "You can only submit for your own institution." };
      }
      const current = stateRef.current;
      const obligation = current.obligations.find((item) => item.id === input.obligationId);
      if (!obligation || obligation.institutionId !== input.institutionId) {
        return { ok: false, message: "Select a valid obligation for the institution." };
      }
      if (!input.fdrNo.trim() || !input.bank.trim()) {
        return { ok: false, message: "Instrument reference and bank are required." };
      }
      if (input.amount <= 0) {
        return { ok: false, message: "Amount must be greater than zero." };
      }
      if (new Date(input.maturityDate) <= new Date(input.issueDate)) {
        return { ok: false, message: "Maturity date must be after the issue date." };
      }
      if (mode === "submit" && !input.documents.some((doc) => doc.category === "FDR_COPY")) {
        return { ok: false, message: "Attach the FDR copy before submitting." };
      }

      const previous = input.previousInstrumentId
        ? current.instruments.find((instrument) => instrument.id === input.previousInstrumentId)
        : undefined;
      if (input.previousInstrumentId && !previous) {
        return { ok: false, message: "The prior instrument could not be found." };
      }
      if (previous?.replacementInstrumentId && previous.replacementInstrumentId !== previous.id) {
        return {
          ok: false,
          message:
            "This instrument already has a linked replacement. Open the renewal chain to review it.",
        };
      }

      const instrumentId = uid("fdr");
      const now = demoNow();
      const submissionStatus = mode === "draft" ? "DRAFT" : "SUBMITTED";
      const instrument: DepositInstrument = {
        id: instrumentId,
        obligationId: input.obligationId,
        institutionId: input.institutionId,
        type: input.type,
        fdrNo: input.fdrNo.trim(),
        referenceKey: normalizeReference(input.fdrNo),
        bank: input.bank.trim(),
        branch: input.branch.trim(),
        ifsc: input.ifsc.trim(),
        amount: input.amount,
        issueDate: input.issueDate,
        maturityDate: input.maturityDate,
        holdEndDate: input.holdEndDate,
        instrumentStatus: deriveInstrumentStatus(input.maturityDate),
        submissionStatus,
        verificationStatus: "NOT_CHECKED",
        provenance: "INSTITUTION_DECLARED",
        officer: input.officer || "A. Mehta",
        ...(previous ? { previousInstrumentId: previous.id } : {}),
        ...(input.replacementReason ? { replacementReason: input.replacementReason } : {}),
        createdAt: now,
        updatedAt: now,
      };

      const findings = [...current.findings];
      const newWorkItems = [...current.workItems];
      const newAlerts = [...current.alerts];

      const duplicate = current.instruments.find(
        (other) =>
          other.institutionId !== input.institutionId &&
          other.bank === instrument.bank &&
          normalizeReference(other.fdrNo) === instrument.referenceKey,
      );
      if (duplicate) {
        findings.unshift({
          id: uid("find"),
          instrumentId,
          code: "DUPLICATE_REFERENCE",
          field: "Instrument reference",
          expected: "Unique within issuer + instrument type",
          observed: `Matches ${duplicate.fdrNo} at ${duplicate.bank}`,
          severity: "HIGH",
          ruleVersion: obligation.policyVersionId,
          status: "OPEN",
          nextAction: "Verify with both institutions and the issuing branch before acceptance.",
        });
      }
      if (Math.abs(input.amount - obligation.amount) > 0) {
        findings.unshift({
          id: uid("find"),
          instrumentId,
          code: "AMOUNT_MISMATCH",
          field: "Amount",
          expected: `₹${obligation.amount.toLocaleString("en-IN")}`,
          observed: `₹${input.amount.toLocaleString("en-IN")}`,
          severity: "HIGH",
          ruleVersion: obligation.policyVersionId,
          status: "OPEN",
          nextAction: "Correct the amount or record a policy-approved justification.",
        });
      }

      const documents = input.documents.map((doc) => ({
        id: uid("doc"),
        instrumentId,
        name: doc.name,
        category: doc.category,
        version: 1,
        checksumSha256: doc.checksumSha256,
        sizeBytes: doc.sizeBytes,
        mime: doc.mime,
        uploadedAt: now,
        uploadedBy: user?.name ?? "Institution administrator",
        reviewerStatus: "NOT_REVIEWED" as DocumentStatus,
        ...(doc.note ? { note: doc.note } : {}),
      }));

      if (mode === "submit") {
        newWorkItems.unshift(
          makeWorkItem(current, {
            title: duplicate
              ? "Resolve duplicate-reference discrepancy"
              : "Scrutinise new instrument submission",
            entityType: "INSTRUMENT",
            entityId: instrumentId,
            institutionId: input.institutionId,
            assigneeId: "u-officer",
            assigneeName: "A. Mehta",
            ownerRole: "CASE_OFFICER",
            dueDate: addDays(DEMO_TODAY, duplicate ? 5 : 3),
            priority: duplicate || findings.length > 0 ? "HIGH" : "MEDIUM",
            reasonCode: duplicate ? "DUP_REFERENCE" : "NEW_SUBMISSION",
            status: daysFromToday(addDays(DEMO_TODAY, 5)) < 0 ? "OVERDUE" : "OPEN",
          }),
        );
        if (duplicate) {
          newAlerts.unshift({
            id: uid("al"),
            type: "WORKFLOW_SLA",
            title: "Duplicate reference detected on submission",
            detail: `${instrument.fdrNo} matches an existing reference at ${instrument.bank}.`,
            entityId: instrumentId,
            institutionId: input.institutionId,
            recipient: "A. Mehta (Case officer)",
            triggerDate: DEMO_TODAY,
            threshold: "SLA-5d",
            acknowledged: false,
            escalated: false,
            delivery: "IN_APP",
            dedupeKey: `WORKFLOW_SLA:${instrumentId}:SLA:u-officer`,
          });
        }
      }

      const instruments = [
        instrument,
        ...current.instruments.map((item) =>
          item.id === previous?.id ? { ...item, replacementInstrumentId: instrumentId } : item,
        ),
      ];

      const auditEvents: AuditEvent[] = [
        makeAudit(
          user,
          mode === "draft" ? "Draft instrument saved" : "Instrument submitted",
          "INSTRUMENT",
          instrumentId,
          input.institutionId,
          {
            reason: previous ? "Replacement instrument linked to prior FDR" : input.purpose,
            after: {
              fdrNo: instrument.fdrNo,
              amount: instrument.amount,
              submissionStatus,
              ...(previous ? { previousInstrumentId: previous.id } : {}),
            },
          },
        ),
      ];
      if (previous) {
        auditEvents.push(
          makeAudit(user, "Renewal link recorded", "INSTRUMENT", previous.id, input.institutionId, {
            reason: "Prior instrument remains immutable; replacement pending scrutiny",
            after: { replacementInstrumentId: instrumentId },
          }),
        );
      }
      for (const finding of findings.filter((item) => item.instrumentId === instrumentId)) {
        auditEvents.push(
          makeAudit(
            user,
            "Deterministic finding raised",
            "INSTRUMENT",
            instrumentId,
            input.institutionId,
            {
              reason: `${finding.code}: ${finding.nextAction}`,
              source: "WEB_APP",
              after: { finding: finding.id, severity: finding.severity },
            },
          ),
        );
      }

      let next: PortalState = {
        ...current,
        instruments,
        documents: [...documents, ...current.documents],
        findings,
        workItems: newWorkItems,
        alerts: newAlerts,
      };
      for (const event of auditEvents) next = withAudit(next, event);
      commit(next);

      return {
        ok: true,
        message:
          mode === "draft"
            ? "Draft saved. It is not visible in the scrutiny queue until submitted."
            : "Submission received. The case officer has a new work item.",
        id: instrumentId,
      };
    },
    [user, commit],
  );

  const updateInstrument = useCallback(
    (
      instrumentId: string,
      update: (instrument: DepositInstrument) => DepositInstrument,
    ): ActionResult => {
      if (!can(user, "scrutinise") && !can(user, "record_clearance")) {
        return { ok: false, message: "Your role cannot change this case." };
      }
      const current = stateRef.current;
      const instrument = current.instruments.find((item) => item.id === instrumentId);
      if (!instrument) return { ok: false, message: "Instrument not found." };
      const next = { ...instrument, ...update(instrument), updatedAt: demoNow() };
      commit({
        ...current,
        instruments: current.instruments.map((item) => (item.id === instrumentId ? next : item)),
      });
      return { ok: true, message: "Case updated.", id: instrumentId };
    },
    [user, commit],
  );

  const startScrutiny = useCallback(
    (instrumentId: string): ActionResult => {
      const current = stateRef.current;
      const instrument = current.instruments.find((item) => item.id === instrumentId);
      if (!instrument) return { ok: false, message: "Instrument not found." };
      if (!can(user, "scrutinise"))
        return { ok: false, message: "Only a case officer can start scrutiny." };
      if (instrument.submissionStatus !== "SUBMITTED") {
        return { ok: false, message: "Only submitted instruments can move to scrutiny." };
      }
      const next: PortalState = {
        ...current,
        instruments: current.instruments.map((item) =>
          item.id === instrumentId
            ? { ...item, submissionStatus: "UNDER_SCRUTINY", updatedAt: demoNow() }
            : item,
        ),
        audit: [
          makeAudit(
            user,
            "Scrutiny started",
            "INSTRUMENT",
            instrumentId,
            instrument.institutionId,
            {
              before: { submissionStatus: "SUBMITTED" },
              after: { submissionStatus: "UNDER_SCRUTINY" },
            },
          ),
          ...current.audit,
        ],
      };
      commit(next);
      return { ok: true, message: "Case moved to under scrutiny.", id: instrumentId };
    },
    [user, commit],
  );

  const requestClarification = useCallback(
    (instrumentId: string, reason: string): ActionResult => {
      if (!can(user, "scrutinise"))
        return { ok: false, message: "Only a case officer can request clarification." };
      if (!reason.trim()) return { ok: false, message: "A clarification reason is required." };
      const current = stateRef.current;
      const instrument = current.instruments.find((item) => item.id === instrumentId);
      if (!instrument) return { ok: false, message: "Instrument not found." };
      const workItem = makeWorkItem(current, {
        title: "Respond to clarification request",
        entityType: "INSTRUMENT",
        entityId: instrumentId,
        institutionId: instrument.institutionId,
        assigneeId: `u-inst-${instrument.institutionId}`,
        assigneeName: institutionAdminName(current, instrument.institutionId),
        ownerRole: "INSTITUTION_ADMIN",
        dueDate: addDays(DEMO_TODAY, 7),
        priority: "MEDIUM",
        reasonCode: "CLARIFICATION",
        status: "OPEN",
      });
      const alert: Alert = {
        id: uid("al"),
        type: "DOCUMENT",
        title: "Clarification requested by AICTE",
        detail: reason,
        entityId: instrumentId,
        institutionId: instrument.institutionId,
        recipient: `${institutionAdminName(current, instrument.institutionId)} (Institution)`,
        triggerDate: DEMO_TODAY,
        threshold: "Clarification",
        acknowledged: false,
        escalated: false,
        delivery: "IN_APP",
        dedupeKey: `DOCUMENT:${instrumentId}:clarification:${uid("n")}`,
      };
      const next: PortalState = {
        ...current,
        instruments: current.instruments.map((item) =>
          item.id === instrumentId
            ? { ...item, submissionStatus: "UNDER_SCRUTINY", updatedAt: demoNow() }
            : item,
        ),
        workItems: [workItem, ...current.workItems],
        alerts: [alert, ...current.alerts],
        audit: [
          makeAudit(
            user,
            "Clarification requested",
            "INSTRUMENT",
            instrumentId,
            instrument.institutionId,
            {
              reason,
              after: { workItem: workItem.id, submissionStatus: "UNDER_SCRUTINY" },
            },
          ),
          ...current.audit,
        ],
      };
      commit(next);
      return {
        ok: true,
        message: "Clarification recorded and the institution notified.",
        id: instrumentId,
      };
    },
    [user, commit],
  );

  const recordDocumentReview = useCallback(
    (documentId: string, status: DocumentStatus, note: string): ActionResult => {
      if (!can(user, "scrutinise"))
        return { ok: false, message: "Only a case officer can review documents." };
      const current = stateRef.current;
      const document = current.documents.find((item) => item.id === documentId);
      if (!document) return { ok: false, message: "Document not found." };
      if (!note.trim() && status !== "ACCEPTED") {
        return { ok: false, message: "Add a note for clarification requests." };
      }
      const next: PortalState = {
        ...current,
        documents: current.documents.map((item) =>
          item.id === documentId
            ? { ...item, reviewerStatus: status, ...(note.trim() ? { note } : {}) }
            : item,
        ),
        audit: [
          makeAudit(
            user,
            "Document review recorded",
            "DOCUMENT",
            documentId,
            document.instrumentId,
            {
              ...(note.trim() ? { reason: note.trim() } : {}),
              before: { reviewerStatus: document.reviewerStatus },
              after: { reviewerStatus: status, version: document.version },
            },
          ),
          ...current.audit,
        ],
      };
      commit(next);
      return { ok: true, message: "Document review saved.", id: documentId };
    },
    [user, commit],
  );

  const recordReview = useCallback(
    (instrumentId: string): ActionResult => {
      if (!can(user, "scrutinise"))
        return { ok: false, message: "Only a case officer can record review." };
      const current = stateRef.current;
      const instrument = current.instruments.find((item) => item.id === instrumentId);
      if (!instrument) return { ok: false, message: "Instrument not found." };
      const next: PortalState = {
        ...current,
        instruments: current.instruments.map((item) =>
          item.id === instrumentId
            ? {
                ...item,
                verificationStatus: "DOC_REVIEWED",
                provenance: "OFFICIAL_DOCUMENT_REVIEW",
                submissionStatus: "UNDER_SCRUTINY",
                updatedAt: demoNow(),
              }
            : item,
        ),
        audit: [
          makeAudit(
            user,
            "Documentary review recorded",
            "INSTRUMENT",
            instrumentId,
            instrument.institutionId,
            {
              reason: "Official documentary review only — not a bank confirmation",
              before: { verificationStatus: instrument.verificationStatus },
              after: { verificationStatus: "DOC_REVIEWED", provenance: "OFFICIAL_DOCUMENT_REVIEW" },
            },
          ),
          ...current.audit,
        ],
      };
      commit(next);
      return {
        ok: true,
        message: "Documentary review recorded. This is not a bank confirmation.",
        id: instrumentId,
      };
    },
    [user, commit],
  );

  const resolveFinding = useCallback(
    (findingId: string, resolution: string, acceptedRisk = false): ActionResult => {
      if (!can(user, "scrutinise"))
        return { ok: false, message: "Only a case officer can resolve findings." };
      if (!resolution.trim()) return { ok: false, message: "A resolution note is required." };
      const current = stateRef.current;
      const finding = current.findings.find((item) => item.id === findingId);
      if (!finding) return { ok: false, message: "Finding not found." };
      const instrument = current.instruments.find((item) => item.id === finding.instrumentId);
      const updatedFindings = current.findings.map((item) =>
        item.id === findingId
          ? {
              ...item,
              status: acceptedRisk ? ("ACCEPTED_RISK" as const) : ("RESOLVED" as const),
              resolution,
            }
          : item,
      );
      const base: PortalState = { ...current, findings: updatedFindings };
      const next: PortalState = {
        ...base,
        releases: current.releases.map((release): ReleaseCase => {
          if (
            release.instrumentId !== finding.instrumentId ||
            release.decision ||
            release.status === "CLOSED"
          ) {
            return release;
          }
          return {
            ...release,
            status: releaseReady(base, release) ? "DECISION_PENDING" : "CLEARANCES_PENDING",
          };
        }),
        audit: [
          makeAudit(
            user,
            acceptedRisk ? "Finding accepted with risk" : "Finding resolved",
            "INSTRUMENT",
            finding.instrumentId,
            instrument?.institutionId,
            {
              reason: resolution,
              before: { status: finding.status },
              after: { status: acceptedRisk ? "ACCEPTED_RISK" : "RESOLVED", code: finding.code },
            },
          ),
          ...current.audit,
        ],
      };
      commit(next);
      return {
        ok: true,
        message: "Finding updated and recorded in the audit trail.",
        id: findingId,
      };
    },
    [user, commit],
  );

  const acceptInstrument = useCallback(
    (instrumentId: string, note: string): ActionResult => {
      if (!can(user, "scrutinise"))
        return { ok: false, message: "Only a case officer can accept a submission." };
      const current = stateRef.current;
      const instrument = current.instruments.find((item) => item.id === instrumentId);
      if (!instrument) return { ok: false, message: "Instrument not found." };
      const open = current.findings.filter(
        (finding) => finding.instrumentId === instrumentId && finding.status === "OPEN",
      );
      if (open.length > 0) {
        return {
          ok: false,
          message: `Resolve ${open.length} open finding${open.length > 1 ? "s" : ""} before acceptance.`,
        };
      }
      if (!["SUBMITTED", "UNDER_SCRUTINY"].includes(instrument.submissionStatus)) {
        return { ok: false, message: "This submission is not in a reviewable state." };
      }
      const previous = instrument.previousInstrumentId
        ? current.instruments.find((item) => item.id === instrument.previousInstrumentId)
        : undefined;
      const nextStatus = deriveInstrumentStatus(instrument.maturityDate);
      const now = demoNow();
      const next: PortalState = {
        ...current,
        instruments: current.instruments.map((item) => {
          if (item.id === instrumentId) {
            return {
              ...item,
              submissionStatus: "ACCEPTED",
              verificationStatus: "DOC_REVIEWED",
              provenance: "OFFICIAL_DOCUMENT_REVIEW",
              instrumentStatus: nextStatus,
              updatedAt: now,
            };
          }
          if (previous && item.id === previous.id) {
            return { ...item, instrumentStatus: "SUPERSEDED", updatedAt: now };
          }
          return item;
        }),
        obligations: current.obligations.map((obligation) =>
          obligation.id === instrument.obligationId
            ? {
                ...obligation,
                status: "SATISFIED",
                requirementStatus: "Active — documentary review complete",
              }
            : obligation,
        ),
        workItems: closeWorkItems(current, instrumentId),
        audit: [
          makeAudit(
            user,
            "Instrument accepted",
            "INSTRUMENT",
            instrumentId,
            instrument.institutionId,
            {
              reason: note || "Documentary review complete",
              before: { submissionStatus: instrument.submissionStatus },
              after: {
                submissionStatus: "ACCEPTED",
                verificationStatus: "DOC_REVIEWED",
                ...(previous ? { superseded: previous.id } : {}),
              },
            },
          ),
          ...(previous
            ? [
                makeAudit(
                  user,
                  "Prior instrument superseded",
                  "INSTRUMENT",
                  previous.id,
                  instrument.institutionId,
                  {
                    reason: `Replacement ${instrument.fdrNo} accepted`,
                    before: { instrumentStatus: previous.instrumentStatus },
                    after: { instrumentStatus: "SUPERSEDED" },
                  },
                ),
              ]
            : []),
          ...current.audit,
        ],
      };
      commit(next);
      return {
        ok: true,
        message: "Accepted. Documentary review only; this is not a bank confirmation.",
        id: instrumentId,
      };
    },
    [user, commit],
  );

  const returnInstrument = useCallback(
    (instrumentId: string, reason: string): ActionResult => {
      if (!can(user, "scrutinise"))
        return { ok: false, message: "Only a case officer can return a submission." };
      if (!reason.trim()) return { ok: false, message: "A return reason is required." };
      const current = stateRef.current;
      const instrument = current.instruments.find((item) => item.id === instrumentId);
      if (!instrument) return { ok: false, message: "Instrument not found." };
      const workItem = makeWorkItem(current, {
        title: "Re-upload corrected submission",
        entityType: "INSTRUMENT",
        entityId: instrumentId,
        institutionId: instrument.institutionId,
        assigneeId: `u-inst-${instrument.institutionId}`,
        assigneeName: institutionAdminName(current, instrument.institutionId),
        ownerRole: "INSTITUTION_ADMIN",
        dueDate: addDays(DEMO_TODAY, 7),
        priority: "HIGH",
        reasonCode: "DOC_INCOMPLETE",
        status: "OPEN",
      });
      const next: PortalState = {
        ...current,
        instruments: current.instruments.map((item) =>
          item.id === instrumentId
            ? { ...item, submissionStatus: "RETURNED", updatedAt: demoNow() }
            : item,
        ),
        obligations: current.obligations.map((obligation) =>
          obligation.id === instrument.obligationId
            ? {
                ...obligation,
                status: "REVIEW_REQUIRED",
                requirementStatus: "Returned for correction",
              }
            : obligation,
        ),
        workItems: [workItem, ...closeWorkItems(current, instrumentId)],
        alerts: [
          {
            id: uid("al"),
            type: "DOCUMENT",
            title: "Submission returned for correction",
            detail: reason,
            entityId: instrumentId,
            institutionId: instrument.institutionId,
            recipient: `${institutionAdminName(current, instrument.institutionId)} (Institution)`,
            triggerDate: DEMO_TODAY,
            threshold: "Correction",
            acknowledged: false,
            escalated: false,
            delivery: "IN_APP",
            dedupeKey: `DOCUMENT:${instrumentId}:return:${uid("n")}`,
          },
          ...current.alerts,
        ],
        audit: [
          makeAudit(
            user,
            "Instrument returned for correction",
            "INSTRUMENT",
            instrumentId,
            instrument.institutionId,
            {
              reason,
              before: { submissionStatus: instrument.submissionStatus },
              after: { submissionStatus: "RETURNED" },
            },
          ),
          ...current.audit,
        ],
      };
      commit(next);
      return {
        ok: true,
        message: "Returned with reason; institution has a new work item.",
        id: instrumentId,
      };
    },
    [user, commit],
  );

  const rejectInstrument = useCallback(
    (instrumentId: string, reason: string): ActionResult => {
      if (!can(user, "scrutinise"))
        return { ok: false, message: "Only a case officer can reject a submission." };
      if (!reason.trim()) return { ok: false, message: "A rejection reason is required." };
      const current = stateRef.current;
      const instrument = current.instruments.find((item) => item.id === instrumentId);
      if (!instrument) return { ok: false, message: "Instrument not found." };
      const next: PortalState = {
        ...current,
        instruments: current.instruments.map((item) =>
          item.id === instrumentId
            ? { ...item, submissionStatus: "REJECTED", updatedAt: demoNow() }
            : item,
        ),
        obligations: current.obligations.map((obligation) =>
          obligation.id === instrument.obligationId
            ? {
                ...obligation,
                status: "REVIEW_REQUIRED",
                requirementStatus: "Submission rejected — replacement required",
              }
            : obligation,
        ),
        workItems: closeWorkItems(current, instrumentId),
        audit: [
          makeAudit(
            user,
            "Instrument rejected",
            "INSTRUMENT",
            instrumentId,
            instrument.institutionId,
            {
              reason,
              before: { submissionStatus: instrument.submissionStatus },
              after: { submissionStatus: "REJECTED" },
            },
          ),
          ...current.audit,
        ],
      };
      commit(next);
      return {
        ok: true,
        message: "Submission rejected; reason recorded in audit.",
        id: instrumentId,
      };
    },
    [user, commit],
  );

  const simulateBankResponse = useCallback(
    (instrumentId: string, result: "MATCH" | "MISMATCH"): ActionResult => {
      if (!can(user, "scrutinise"))
        return { ok: false, message: "Only a case officer can run the simulated check." };
      const current = stateRef.current;
      const instrument = current.instruments.find((item) => item.id === instrumentId);
      if (!instrument) return { ok: false, message: "Instrument not found." };
      const now = demoNow();
      const evidenceRef = `SIM-BANK-${DEMO_TODAY.replace(/-/g, "")}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const findings =
        result === "MISMATCH"
          ? [
              {
                id: uid("find"),
                instrumentId,
                code: "BANK_SIMULATED_MISMATCH",
                field: "Bank response (simulated)",
                expected: "Amount and reference match",
                observed: "Simulated adapter returned a mismatch",
                severity: "HIGH" as const,
                ruleVersion: instrument.obligationId,
                status: "OPEN" as const,
                nextAction:
                  "Obtain authorized bank-origin evidence; do not treat this as real verification.",
              },
              ...current.findings,
            ]
          : current.findings;
      const next: PortalState = {
        ...current,
        instruments: current.instruments.map((item) =>
          item.id === instrumentId
            ? {
                ...item,
                simulatedCheck: {
                  at: now,
                  result,
                  evidenceRef,
                  note: "Demo adapter response only. Not a real bank confirmation.",
                },
                provenance: "SIMULATED_BANK_RESPONSE",
                verificationStatus: result === "MATCH" ? "DOC_REVIEWED" : "DISCREPANCY",
                updatedAt: now,
              }
            : item,
        ),
        findings,
        audit: [
          makeAudit(
            user,
            "Simulated bank response recorded",
            "INSTRUMENT",
            instrumentId,
            instrument.institutionId,
            {
              reason:
                result === "MATCH"
                  ? "Simulated match — not bank verified"
                  : "Simulated mismatch — review required",
              source: "SIMULATED_ADAPTER",
              after: { provenance: "SIMULATED_BANK_RESPONSE", evidenceRef, result },
            },
          ),
          ...current.audit,
        ],
      };
      commit(next);
      return {
        ok: true,
        message: "SIMULATED response recorded. This is not a bank verification.",
        id: instrumentId,
      };
    },
    [user, commit],
  );

  const uploadDocument = useCallback(
    (instrumentId: string, input: DocumentInput): ActionResult => {
      if (!can(user, "upload_document") && !can(user, "scrutinise")) {
        return { ok: false, message: "Your role cannot upload documents." };
      }
      if (!input.name || !input.checksumSha256) {
        return { ok: false, message: "A file with a computed checksum is required." };
      }
      const current = stateRef.current;
      const instrument = current.instruments.find((item) => item.id === instrumentId);
      if (!instrument) return { ok: false, message: "Instrument not found." };
      const existingVersions = current.documents.filter(
        (document) =>
          document.instrumentId === instrumentId && document.category === input.category,
      );
      const version =
        existingVersions.reduce((max, document) => Math.max(max, document.version), 0) + 1;
      const now = demoNow();
      const document = {
        id: uid("doc"),
        instrumentId,
        name: input.name,
        category: input.category,
        version,
        checksumSha256: input.checksumSha256,
        sizeBytes: input.sizeBytes,
        mime: input.mime,
        uploadedAt: now,
        uploadedBy: user?.name ?? "Unknown user",
        reviewerStatus: "NOT_REVIEWED" as DocumentStatus,
        ...(input.note ? { note: input.note } : {}),
      };
      const resubmitted = instrument.submissionStatus === "RETURNED";
      const next: PortalState = {
        ...current,
        documents: [document, ...current.documents],
        instruments: current.instruments.map((item) =>
          item.id === instrumentId
            ? {
                ...item,
                ...(resubmitted ? { submissionStatus: "SUBMITTED" as const } : {}),
                updatedAt: now,
              }
            : item,
        ),
        ...(resubmitted
          ? {
              workItems: [
                makeWorkItem(current, {
                  title: "Review resubmitted documents",
                  entityType: "INSTRUMENT" as const,
                  entityId: instrumentId,
                  institutionId: instrument.institutionId,
                  assigneeId: "u-officer",
                  assigneeName: "A. Mehta",
                  ownerRole: "CASE_OFFICER" as const,
                  dueDate: addDays(DEMO_TODAY, 3),
                  priority: "HIGH" as const,
                  reasonCode: "RESUBMISSION",
                  status: "OPEN" as const,
                }),
                ...closeWorkItems(current, instrumentId, "DOC_INCOMPLETE"),
              ],
            }
          : {}),
        audit: [
          makeAudit(
            user,
            resubmitted ? "Corrected document uploaded" : "Document version uploaded",
            "DOCUMENT",
            document.id,
            instrument.institutionId,
            {
              reason: input.note || `Version ${version} of ${input.category}`,
              after: {
                instrumentId,
                version,
                checksum: input.checksumSha256,
                ...(resubmitted ? { submissionStatus: "SUBMITTED" } : {}),
              },
            },
          ),
          ...current.audit,
        ],
      };
      commit(next);
      return {
        ok: true,
        message: resubmitted
          ? "Document uploaded and submission resubmitted for scrutiny."
          : `Document version ${version} recorded with SHA-256 checksum.`,
        id: document.id,
      };
    },
    [user, commit],
  );

  const recomputeRelease = (current: PortalState, release: ReleaseCase): ReleaseCase => {
    if (release.decision || release.status === "CLOSED") return release;
    const ready = releaseReady(current, release);
    return {
      ...release,
      status: ready ? "DECISION_PENDING" : "CLEARANCES_PENDING",
    };
  };

  const createRelease = useCallback(
    (input: ReleaseRequestInput): ActionResult => {
      if (!can(user, "create_release"))
        return { ok: false, message: "Your role cannot request a release." };
      if (!input.reason.trim()) return { ok: false, message: "A release reason is required." };
      const current = stateRef.current;
      const obligation = current.obligations.find((item) => item.id === input.obligationId);
      const instrument = current.instruments.find((item) => item.id === input.instrumentId);
      if (!obligation || !instrument || instrument.obligationId !== obligation.id) {
        return { ok: false, message: "Select a valid obligation and instrument." };
      }
      if (user?.role === "INSTITUTION_ADMIN" && user.institutionId !== obligation.institutionId) {
        return { ok: false, message: "You can only request release for your own institution." };
      }
      const existing = current.releases.find(
        (release) =>
          release.instrumentId === instrument.id &&
          !["APPROVED", "REJECTED", "CLOSED"].includes(release.status),
      );
      if (existing)
        return { ok: false, message: `An open release case already exists: ${existing.id}.` };

      const releaseId = uid("REL-2026");
      const now = demoNow();
      const release: ReleaseCase = {
        id: releaseId,
        obligationId: obligation.id,
        instrumentId: instrument.id,
        institutionId: obligation.institutionId,
        status: "SUBMITTED",
        requestedAt: DEMO_TODAY,
        requestedBy: user?.name ?? "Institution administrator",
        reason: input.reason,
        checklist: [
          {
            id: uid("chk"),
            label: "Release request letter attached",
            required: true,
            done: true,
            evidence: "Captured in this request",
            updatedAt: now,
          },
          { id: uid("chk"), label: "Affidavit 6 on file", required: true, done: false },
          {
            id: uid("chk"),
            label: "FDR / online payment proof on file",
            required: true,
            done: current.documents.some((doc) => doc.instrumentId === instrument.id),
            ...(current.documents.some((doc) => doc.instrumentId === instrument.id)
              ? { evidence: "Instrument documents on file" }
              : {}),
          },
          { id: uid("chk"), label: "Latest LoA / EoA attached", required: true, done: false },
          {
            id: uid("chk"),
            label: "Regulatory hold term confirmed",
            required: true,
            done: Boolean(instrument.holdEndDate),
            ...(instrument.holdEndDate ? { evidence: `Hold end ${instrument.holdEndDate}` } : {}),
          },
          {
            id: uid("chk"),
            label: "No pending dues (Finance verified)",
            required: true,
            done: false,
          },
          {
            id: uid("chk"),
            label: "Bank account particulars verified",
            required: false,
            done: false,
          },
        ],
        clearances: [
          {
            id: uid("clr"),
            bureau: "Finance Bureau",
            required: true,
            status: "NOT_REQUESTED",
            note: "Raise after checklist evidence is complete.",
          },
          {
            id: uid("clr"),
            bureau: "PGRC (Grievances)",
            required: true,
            status: "PENDING",
            note: "Assigned to clearance reviewer.",
            reviewer: "R. Iyer",
            reviewerRole: "CLEARANCE_REVIEWER",
            updatedAt: now,
          },
          {
            id: uid("clr"),
            bureau: "Vigilance",
            required: true,
            status: "PENDING",
            note: "Awaiting response.",
          },
          {
            id: uid("clr"),
            bureau: "Approval Bureau",
            required: true,
            status: "PENDING",
            note: "Awaiting response.",
          },
        ],
        createdAt: now,
      };
      const workItem = makeWorkItem(current, {
        title: "Obtain mandatory release clearances",
        entityType: "RELEASE",
        entityId: releaseId,
        institutionId: obligation.institutionId,
        assigneeId: "u-clearance",
        assigneeName: "R. Iyer",
        ownerRole: "CLEARANCE_REVIEWER",
        dueDate: addDays(DEMO_TODAY, 7),
        priority: "HIGH",
        reasonCode: "CLEARANCE_PENDING",
        status: "OPEN",
      });
      const next: PortalState = {
        ...current,
        releases: [release, ...current.releases],
        obligations: current.obligations.map((item) =>
          item.id === obligation.id ? { ...item, status: "RELEASE_PENDING" } : item,
        ),
        workItems: [workItem, ...current.workItems],
        alerts: [
          {
            id: uid("al"),
            type: "RELEASE",
            title: "Release request submitted",
            detail: `${release.id} for ${instrument.fdrNo} is awaiting mandatory clearances.`,
            entityId: releaseId,
            institutionId: obligation.institutionId,
            recipient: "Clearance reviewer",
            triggerDate: DEMO_TODAY,
            threshold: "Workflow",
            acknowledged: false,
            escalated: false,
            delivery: "IN_APP",
            dedupeKey: `RELEASE:${releaseId}:submitted`,
          },
          ...current.alerts,
        ],
        audit: [
          makeAudit(
            user,
            "Release request submitted",
            "RELEASE",
            releaseId,
            obligation.institutionId,
            {
              reason: input.reason,
              after: {
                instrumentId: instrument.id,
                status: "SUBMITTED",
                checklistItems: release.checklist.length,
              },
            },
          ),
          ...current.audit,
        ],
      };
      commit(next);
      return {
        ok: true,
        message: "Release request created with the prescribed checklist and clearance matrix.",
        id: releaseId,
      };
    },
    [user, commit],
  );

  const toggleChecklistItem = useCallback(
    (releaseId: string, itemId: string): ActionResult => {
      if (!can(user, "create_release") && !can(user, "scrutinise") && !can(user, "manage_admin")) {
        return { ok: false, message: "Your role cannot update the release checklist." };
      }
      const current = stateRef.current;
      const release = current.releases.find((item) => item.id === releaseId);
      if (!release) return { ok: false, message: "Release case not found." };
      if (release.decision || release.status === "CLOSED") {
        return { ok: false, message: "A decided release is locked." };
      }
      const item = release.checklist.find((entry) => entry.id === itemId);
      if (!item) return { ok: false, message: "Checklist item not found." };
      const updated: ReleaseCase = {
        ...release,
        checklist: release.checklist.map((entry) => {
          if (entry.id !== itemId) return entry;
          const { evidence: _previousEvidence, ...rest } = entry;
          return {
            ...rest,
            done: !entry.done,
            ...(entry.done
              ? {}
              : { evidence: `Confirmed by ${user?.name ?? "user"} · ${DEMO_TODAY}` }),
            updatedAt: demoNow(),
          };
        }),
      };
      const recomputed = recomputeRelease(current, updated);
      const next: PortalState = {
        ...current,
        releases: current.releases.map((entry) => (entry.id === releaseId ? recomputed : entry)),
        audit: [
          makeAudit(
            user,
            "Release checklist updated",
            "RELEASE",
            releaseId,
            release.institutionId,
            {
              reason: item.label,
              before: { done: item.done },
              after: { done: !item.done, status: recomputed.status },
            },
          ),
          ...current.audit,
        ],
      };
      commit(next);
      return {
        ok: true,
        message: `Checklist item marked ${item.done ? "incomplete" : "complete"}.`,
        id: releaseId,
      };
    },
    [user, commit],
  );

  const recordClearance = useCallback(
    (
      releaseId: string,
      clearanceId: string,
      status: ClearanceStatus,
      note: string,
      simulate = false,
    ): ActionResult => {
      if (!can(user, "record_clearance"))
        return { ok: false, message: "Your role cannot record clearances." };
      if (!note.trim()) return { ok: false, message: "A clearance note is required." };
      if (status === "NOT_APPLICABLE" && !note.trim()) {
        return { ok: false, message: "A reason is required for not applicable." };
      }
      const current = stateRef.current;
      const release = current.releases.find((item) => item.id === releaseId);
      if (!release) return { ok: false, message: "Release case not found." };
      if (release.decision || release.status === "CLOSED") {
        return { ok: false, message: "A decided release is locked." };
      }
      const clearance = release.clearances.find((item) => item.id === clearanceId);
      if (!clearance) return { ok: false, message: "Clearance not found." };
      const now = demoNow();
      const updated: ReleaseCase = {
        ...release,
        clearances: release.clearances.map((item) =>
          item.id === clearanceId
            ? {
                ...item,
                status,
                note,
                reviewer: user?.name ?? "Unknown",
                reviewerRole: user?.role ?? "CASE_OFFICER",
                updatedAt: now,
                ...(simulate ? { simulationFlag: true } : {}),
              }
            : item,
        ),
      };
      const recomputed = recomputeRelease(current, updated);
      const stillPending = recomputed.clearances.some(
        (item) => item.required && item.status !== "CLEARED" && item.status !== "NOT_APPLICABLE",
      );
      const next: PortalState = {
        ...current,
        releases: current.releases.map((item) => (item.id === releaseId ? recomputed : item)),
        workItems: stillPending
          ? current.workItems
          : [
              makeWorkItem(current, {
                title: "Record release decision when prerequisites clear",
                entityType: "RELEASE",
                entityId: releaseId,
                institutionId: release.institutionId,
                assigneeId: "u-authority",
                assigneeName: "S. Rao",
                ownerRole: "DECISION_AUTHORITY",
                dueDate: addDays(DEMO_TODAY, 5),
                priority: "HIGH",
                reasonCode: "DECISION_PENDING",
                status: "OPEN",
              }),
              ...closeWorkItems(current, releaseId, "CLEARANCE_PENDING"),
            ],
        alerts: [
          ...(recomputed.status === "DECISION_PENDING"
            ? [
                {
                  id: uid("al"),
                  type: "RELEASE" as const,
                  title: "Release ready for delegated decision",
                  detail: `${releaseId} has no remaining mandatory blockers. Decision requires the competent authority.`,
                  entityId: releaseId,
                  institutionId: release.institutionId,
                  recipient: "S. Rao (Competent authority)",
                  triggerDate: DEMO_TODAY,
                  threshold: "Decision",
                  acknowledged: false,
                  escalated: false,
                  delivery: "IN_APP" as const,
                  dedupeKey: `RELEASE:${releaseId}:decision-ready`,
                },
              ]
            : []),
          ...current.alerts,
        ],
        audit: [
          makeAudit(
            user,
            simulate ? "Simulated clearance recorded" : "Clearance recorded",
            "CLEARANCE",
            releaseId,
            release.institutionId,
            {
              reason: note,
              source: simulate ? "SIMULATED_ADAPTER" : "WEB_APP",
              before: { bureau: clearance.bureau, status: clearance.status },
              after: {
                bureau: clearance.bureau,
                status,
                ...(simulate ? { simulationFlag: true } : {}),
              },
            },
          ),
          ...current.audit,
        ],
      };
      commit(next);
      return {
        ok: true,
        message: simulate
          ? "SIMULATED clearance recorded — not a real bureau response."
          : `Clearance recorded: ${clearance.bureau} — ${status.replace(/_/g, " ").toLowerCase()}.`,
        id: releaseId,
      };
    },
    [user, commit],
  );

  const decideRelease = useCallback(
    (
      releaseId: string,
      outcome: "APPROVED" | "REJECTED",
      rationale: string,
      conditions: string,
    ): ActionResult => {
      if (!can(user, "decide_release")) {
        return {
          ok: false,
          message: "Only the delegated competent authority can record a decision.",
        };
      }
      if (!rationale.trim()) return { ok: false, message: "A decision rationale is required." };
      const current = stateRef.current;
      const release = current.releases.find((item) => item.id === releaseId);
      if (!release) return { ok: false, message: "Release case not found." };
      if (release.decision)
        return { ok: false, message: "A decision is already recorded for this case." };
      if (!releaseReady(current, release)) {
        return {
          ok: false,
          message:
            "Decision is blocked. Resolve every required checklist item, clearance, and high finding.",
        };
      }
      const instrument = current.instruments.find((item) => item.id === release.instrumentId);
      if (!instrument) return { ok: false, message: "Linked instrument not found." };
      const route =
        instrument.type === "RTGS"
          ? "SANCTION_ORDER"
          : instrument.type === "OTHER"
            ? null
            : "NOC_RECORD";
      const now = demoNow();
      const decided: ReleaseCase = {
        ...release,
        status: outcome === "APPROVED" ? "APPROVED" : "REJECTED",
        decision: {
          outcome,
          authorityId: user?.id ?? "u-authority",
          authorityName: user?.name ?? "S. Rao",
          decidedAt: now,
          rationale,
          conditions,
          instrumentRoute: route,
        },
      };
      const next: PortalState = {
        ...current,
        releases: current.releases.map((item) => (item.id === releaseId ? decided : item)),
        instruments: current.instruments.map((item) =>
          item.id === instrument.id
            ? {
                ...item,
                instrumentStatus: outcome === "APPROVED" ? "RELEASED" : item.instrumentStatus,
                updatedAt: now,
              }
            : item,
        ),
        obligations: current.obligations.map((item) =>
          item.id === release.obligationId
            ? {
                ...item,
                status: outcome === "APPROVED" ? "CLOSED" : "RELEASE_PENDING",
                requirementStatus:
                  outcome === "APPROVED"
                    ? "Released under recorded authority decision"
                    : "Release rejected — review required",
              }
            : item,
        ),
        workItems: closeWorkItems(current, releaseId),
        alerts: [
          {
            id: uid("al"),
            type: "RELEASE",
            title: `Release ${outcome.toLowerCase()} — decision recorded`,
            detail: `${releaseId}: ${rationale}`,
            entityId: releaseId,
            institutionId: release.institutionId,
            recipient: "Institution administrator",
            triggerDate: DEMO_TODAY,
            threshold: "Decision",
            acknowledged: false,
            escalated: false,
            delivery: "IN_APP",
            dedupeKey: `RELEASE:${releaseId}:decision`,
          },
          ...current.alerts,
        ],
        audit: [
          makeAudit(
            user,
            "Release decision recorded",
            "DECISION",
            releaseId,
            release.institutionId,
            {
              reason: rationale,
              before: { status: release.status },
              after: {
                outcome,
                status: decided.status,
                route,
                conditions,
                ...(outcome === "APPROVED" ? { instrumentStatus: "RELEASED" } : {}),
              },
            },
          ),
          ...current.audit,
        ],
      };
      commit(next);
      return {
        ok: true,
        message:
          outcome === "APPROVED"
            ? `Approved. ${route === "SANCTION_ORDER" ? "Sanction-order" : "NOC"} record marked PROPOSED — not an issued document.`
            : "Rejection recorded with rationale and visible to the institution.",
        id: releaseId,
      };
    },
    [user, commit],
  );

  const acknowledgeAlert = useCallback(
    (alertId: string): ActionResult => {
      const current = stateRef.current;
      const alert = current.alerts.find((item) => item.id === alertId);
      if (!alert) return { ok: false, message: "Alert not found." };
      const next: PortalState = {
        ...current,
        alerts: current.alerts.map((item) =>
          item.id === alertId ? { ...item, acknowledged: true } : item,
        ),
        audit: [
          makeAudit(user, "Alert acknowledged", "ALERT", alertId, alert.institutionId, {
            before: { acknowledged: false },
            after: { acknowledged: true },
          }),
          ...current.audit,
        ],
      };
      commit(next);
      return { ok: true, message: "Alert acknowledged.", id: alertId };
    },
    [user, commit],
  );

  const escalateAlert = useCallback(
    (alertId: string): ActionResult => {
      const current = stateRef.current;
      const alert = current.alerts.find((item) => item.id === alertId);
      if (!alert) return { ok: false, message: "Alert not found." };
      if (!can(user, "scrutinise") && !can(user, "manage_admin")) {
        return { ok: false, message: "Only an official can escalate an alert." };
      }
      const next: PortalState = {
        ...current,
        alerts: current.alerts.map((item) =>
          item.id === alertId ? { ...item, escalated: true } : item,
        ),
        workItems: [
          makeWorkItem(current, {
            title: `Supervisory escalation: ${alert.title}`,
            entityType: "RELEASE",
            entityId: alert.entityId,
            institutionId: alert.institutionId,
            assigneeId: "u-authority",
            assigneeName: "S. Rao",
            ownerRole: "DECISION_AUTHORITY",
            dueDate: addDays(DEMO_TODAY, 2),
            priority: "HIGH",
            reasonCode: "ESCALATION",
            status: "OPEN",
          }),
          ...current.workItems,
        ],
        audit: [
          makeAudit(user, "Alert escalated to supervisor", "ALERT", alertId, alert.institutionId, {
            reason: alert.title,
            before: { escalated: false },
            after: { escalated: true },
          }),
          ...current.audit,
        ],
      };
      commit(next);
      return {
        ok: true,
        message: "Alert escalated; a supervisory work item was created.",
        id: alertId,
      };
    },
    [user, commit],
  );

  const runDateMonitor = useCallback((): { created: number; message: string } => {
    const current = stateRef.current;
    const hasAlert = (type: Alert["type"], entityId: string) =>
      current.alerts.some((alert) => alert.type === type && alert.entityId === entityId);
    const candidates: Alert[] = [];

    for (const instrument of current.instruments) {
      if (["RELEASED", "SUPERSEDED"].includes(instrument.instrumentStatus)) continue;
      const days = daysFromToday(instrument.maturityDate);
      if (days >= 0 && days <= 90) {
        for (const threshold of [90, 60, 30, 15, 7]) {
          if (days > threshold) continue;
          const dedupeKey = `BANK_MATURITY:${instrument.id}:T-${threshold}:${instrument.institutionId}`;
          if (current.alerts.some((alert) => alert.dedupeKey === dedupeKey)) continue;
          candidates.push({
            id: uid("al"),
            type: "BANK_MATURITY",
            title: `${instrument.fdrNo} matures on ${instrument.maturityDate}`,
            detail: `Bank maturity threshold T-${threshold}. Regulatory hold end remains a separate obligation date.`,
            entityId: instrument.id,
            institutionId: instrument.institutionId,
            recipient: "Institution administrator",
            triggerDate: DEMO_TODAY,
            threshold: `T-${threshold}`,
            acknowledged: false,
            escalated: false,
            delivery: "IN_APP",
            dedupeKey,
          });
        }
      }
      if (
        instrument.instrumentStatus === "MATURED" &&
        !instrument.holdEndDate &&
        !hasAlert("REGULATORY_HOLD", instrument.id)
      ) {
        candidates.push({
          id: uid("al"),
          type: "REGULATORY_HOLD",
          title: "Regulatory hold term unknown for matured FDR",
          detail: `${instrument.fdrNo} matured but no hold end is recorded. Maturity does not imply release eligibility.`,
          entityId: instrument.id,
          institutionId: instrument.institutionId,
          recipient: "A. Mehta (Case officer)",
          triggerDate: DEMO_TODAY,
          threshold: "Hold check",
          acknowledged: false,
          escalated: false,
          delivery: "IN_APP",
          dedupeKey: `REGULATORY_HOLD:${instrument.id}:hold:u-officer`,
        });
      }
    }

    for (const item of current.workItems) {
      if (item.status === "DONE" || daysFromToday(item.dueDate) >= 0) continue;
      if (hasAlert("WORKFLOW_SLA", item.entityId)) continue;
      candidates.push({
        id: uid("al"),
        type: "WORKFLOW_SLA",
        title: `Overdue action: ${item.title}`,
        detail: `Assigned to ${item.assigneeName}; due ${item.dueDate}.`,
        entityId: item.entityId,
        institutionId: item.institutionId,
        recipient: item.assigneeName,
        triggerDate: DEMO_TODAY,
        threshold: "SLA",
        acknowledged: false,
        escalated: false,
        delivery: "IN_APP",
        dedupeKey: `WORKFLOW_SLA:${item.entityId}:SLA:${item.assigneeId}`,
      });
    }

    for (const release of current.releases) {
      if (["APPROVED", "REJECTED", "CLOSED"].includes(release.status)) continue;
      const pending = release.clearances.filter(
        (clearance) =>
          clearance.required &&
          clearance.status !== "CLEARED" &&
          clearance.status !== "NOT_APPLICABLE",
      );
      if (pending.length > 0 && !hasAlert("RELEASE", release.id)) {
        candidates.push({
          id: uid("al"),
          type: "RELEASE",
          title: `Release blocked by ${pending.length} clearance${pending.length > 1 ? "s" : ""}`,
          detail: `${release.id}: ${pending.map((clearance) => clearance.bureau).join(", ")}.`,
          entityId: release.id,
          institutionId: release.institutionId,
          recipient: "Clearance reviewer",
          triggerDate: DEMO_TODAY,
          threshold: "SLA",
          acknowledged: false,
          escalated: false,
          delivery: "IN_APP",
          dedupeKey: `RELEASE:${release.id}:SLA`,
        });
      }
    }

    if (candidates.length > 0) {
      const next: PortalState = {
        ...current,
        alerts: [...candidates, ...current.alerts],
        audit: [
          makeAudit(user, "Date monitor run completed", "ALERT", "date-monitor", undefined, {
            reason: `${candidates.length} new alert${candidates.length === 1 ? "" : "s"} created; dedupe keys enforced.`,
            source: "SCHEDULER",
            after: {
              created: candidates.length,
              evaluated:
                current.instruments.length + current.workItems.length + current.releases.length,
            },
          }),
          ...current.audit,
        ],
      };
      commit(next);
    }
    return {
      created: candidates.length,
      message:
        candidates.length === 0
          ? "No new alerts. Every threshold instance already has a dedupe key."
          : `${candidates.length} new alert${candidates.length === 1 ? "" : "s"} created. Re-run to verify deduplication.`,
    };
  }, [user, commit]);

  const resetDemo = useCallback(() => {
    const fresh = cloneSeed();
    commit(fresh);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [commit]);

  const value: PortalContextValue = {
    state,
    submitInstrument,
    startScrutiny,
    requestClarification,
    recordDocumentReview,
    recordReview,
    resolveFinding,
    acceptInstrument,
    returnInstrument,
    rejectInstrument,
    simulateBankResponse,
    uploadDocument,
    createRelease,
    toggleChecklistItem,
    recordClearance,
    decideRelease,
    acknowledgeAlert,
    escalateAlert,
    runDateMonitor,
    resetDemo,
  };

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal(): PortalContextValue {
  const context = useContext(PortalContext);
  if (!context) throw new Error("usePortal must be used within PortalProvider");
  return context;
}
