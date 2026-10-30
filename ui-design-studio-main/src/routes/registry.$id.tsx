import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  FileUp,
  GitCompareArrows,
  History,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { ActionDialog, type ActionDialogValues } from "@/components/action-dialog";
import {
  AppShell,
  DemoBadge,
  EmptyState,
  GuardrailNote,
  MiniFact,
  NextActionStrip,
  PageHeader,
  Panel,
  ProvenanceTag,
  ReadOnlyBanner,
  ScopeDenied,
  StatusPill,
} from "@/components/portal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  checksumPreview,
  daysFromToday,
  fmtDate,
  fmtDateTime,
  formatBytes,
  INR,
  relativeDays,
} from "@/lib/format";
import {
  can,
  canSeeInstitution,
  documentsOf,
  findingsOf,
  isReadOnly,
  nextActionFor,
  renewalChain,
  visibleAudit,
  workItemFor,
} from "@/lib/selectors";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";
import type { DocumentStatus } from "@/lib/types";

export const Route = createFileRoute("/registry/$id")({
  head: () => ({
    meta: [
      { title: "FDR case detail · AICTE Smart FDR Portal" },
      {
        name: "description",
        content:
          "Security deposit case file with evidence, provenance, findings, renewals and audit.",
      },
    ],
  }),
  component: InstrumentDetail,
});

const DOCUMENT_CATEGORIES = [
  ["FDR_COPY", "FDR scanned copy"],
  ["BANK_LETTER", "Bank covering letter"],
  ["BANK_CONFIRMATION", "Bank confirmation (authorized only)"],
  ["PAYMENT_PROOF", "Deposit / payment proof"],
  ["LOA_EOA", "Latest LoA / EoA"],
  ["AFFIDAVIT_6", "Affidavit 6"],
  ["RELEASE_REQUEST", "Release request letter"],
  ["CLEARANCE_EVIDENCE", "Clearance evidence"],
  ["OTHER", "Other supporting document"],
] as const;

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg"];

async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

type DialogKind = "clarify" | "return" | "reject" | "accept" | "doc-clarify" | null;

function InstrumentDetail() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { state, ...actions } = usePortal();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [findingId, setFindingId] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>("FDR_COPY");
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  const instrument = state.instruments.find((item) => item.id === id);
  if (!instrument) {
    return (
      <AppShell>
        <EmptyState
          title="Instrument not found"
          hint="The record does not exist in the current demo store."
        />
      </AppShell>
    );
  }

  if (!canSeeInstitution(user, instrument.institutionId)) {
    return (
      <AppShell>
        <ScopeDenied message="This FDR belongs to another institution. URL manipulation must not bypass tenant scope — AC-01." />
      </AppShell>
    );
  }

  const institution = state.institutions.find((entry) => entry.id === instrument.institutionId);
  const obligation = state.obligations.find((entry) => entry.id === instrument.obligationId);
  const policy = state.policies.find((entry) => entry.id === obligation?.policyVersionId);
  const documents = documentsOf(state, instrument.id);
  const findings = findingsOf(state, instrument.id);
  const openFindings = findings.filter((finding) => finding.status === "OPEN");
  const workItem = workItemFor(state, instrument.id);
  const chain = renewalChain(state, instrument);
  const release = state.releases.find(
    (entry) => entry.instrumentId === instrument.id && entry.status !== "CLOSED",
  );
  const action = nextActionFor(state, instrument);
  const canScrutinise = can(user, "scrutinise");
  const canUpload = can(user, "upload_document") && user.role === "INSTITUTION_ADMIN";
  const reviewable = ["SUBMITTED", "UNDER_SCRUTINY"].includes(instrument.submissionStatus);

  const timeline = (() => {
    const docIds = new Set(documents.map((document) => document.id));
    const releaseIds = new Set(
      state.releases
        .filter((entry) => entry.instrumentId === instrument.id)
        .map((entry) => entry.id),
    );
    return visibleAudit(state, user)
      .filter(
        (event) =>
          event.entityId === instrument.id ||
          docIds.has(event.entityId) ||
          releaseIds.has(event.entityId) ||
          event.entityId === instrument.obligationId,
      )
      .sort((a, b) => b.at.localeCompare(a.at));
  })();

  const previous = chain.previous;
  const next = chain.next;
  const coverageGap =
    previous && instrument.issueDate > previous.maturityDate
      ? daysFromToday(previous.maturityDate) < 0
        ? Math.max(
            0,
            Math.round(
              (new Date(instrument.issueDate).getTime() -
                new Date(previous.maturityDate).getTime()) /
                86_400_000,
            ),
          )
        : 0
      : 0;

  const handleDialog = (values: ActionDialogValues) => {
    let result;
    if (dialog === "clarify") result = actions.requestClarification(instrument.id, values.reason);
    else if (dialog === "return") result = actions.returnInstrument(instrument.id, values.reason);
    else if (dialog === "reject") result = actions.rejectInstrument(instrument.id, values.reason);
    else if (dialog === "accept") result = actions.acceptInstrument(instrument.id, values.reason);
    else if (dialog === "doc-clarify" && documentId) {
      result = actions.recordDocumentReview(documentId, "NEEDS_CLARIFICATION", values.reason);
    }
    if (!result) return;
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  };

  const handleResolveFinding = (values: ActionDialogValues) => {
    if (!findingId) return;
    const result = actions.resolveFinding(findingId, values.reason, values.risk);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error("Choose a file first.");
      return;
    }
    if (uploadFile.size > MAX_FILE_BYTES) {
      toast.error("File exceeds the 10 MB demo limit.");
      return;
    }
    if (!ALLOWED_MIME.includes(uploadFile.type)) {
      toast.error("Only PDF, PNG, or JPG files are accepted.");
      return;
    }
    setUploading(true);
    try {
      const checksum = await computeSha256(uploadFile);
      const result = actions.uploadDocument(instrument.id, {
        name: uploadFile.name,
        category: uploadCategory,
        mime: uploadFile.type,
        sizeBytes: uploadFile.size,
        checksumSha256: checksum,
        note: "Uploaded via demo document vault. Stored as metadata only.",
      });
      if (result.ok) {
        toast.success(result.message);
        setUploadOpen(false);
        setUploadFile(null);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Could not compute SHA-256 in this browser context.");
    } finally {
      setUploading(false);
    }
  };

  const markDocument = (docId: string, status: DocumentStatus) => {
    const result = actions.recordDocumentReview(
      docId,
      status,
      status === "ACCEPTED"
        ? "Document accepted during documentary review."
        : "Clarification requested.",
    );
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  };

  return (
    <AppShell>
      <Link
        to="/registry"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Registry
      </Link>

      <PageHeader
        eyebrow={`${instrument.type} · ${instrument.officer}`}
        title={instrument.fdrNo}
        sub={`${institution?.name} · ${institution?.permanentId} · ${instrument.bank}, ${instrument.branch}`}
        action={
          <>
            <StatusPill status={instrument.submissionStatus} />
            <StatusPill status={instrument.verificationStatus} />
            <ProvenanceTag provenance={instrument.provenance} />
          </>
        }
      />

      {isReadOnly(user) && <ReadOnlyBanner />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {canScrutinise && instrument.submissionStatus === "SUBMITTED" && (
          <Button
            size="sm"
            onClick={() => {
              const result = actions.startScrutiny(instrument.id);
              if (result.ok) toast.success(result.message);
              else toast.error(result.message);
            }}
          >
            Start scrutiny
          </Button>
        )}
        {canScrutinise && reviewable && (
          <>
            <Button size="sm" variant="outline" onClick={() => setDialog("clarify")}>
              Request clarification
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialog("accept")}>
              Accept submission
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialog("return")}>
              Return
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setDialog("reject")}>
              Reject
            </Button>
          </>
        )}
        {canScrutinise && !reviewable && instrument.submissionStatus === "ACCEPTED" && (
          <span className="rounded-md border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
            Accepted record — documentary review only, not a bank confirmation.
          </span>
        )}
        {canUpload && (
          <>
            <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> Upload document
            </Button>
            {instrument.submissionStatus === "ACCEPTED" && (
              <Button asChild size="sm" variant="outline">
                <Link to="/submissions/new" search={{ replaces: instrument.id }}>
                  <GitCompareArrows className="h-3.5 w-3.5" /> File replacement
                </Link>
              </Button>
            )}
            {instrument.submissionStatus === "ACCEPTED" && !release && (
              <Button asChild size="sm" variant="outline">
                <Link to="/release" search={{ instrument: instrument.id }}>
                  <Scale className="h-3.5 w-3.5" /> Request release
                </Link>
              </Button>
            )}
            {release && (
              <Button asChild size="sm" variant="outline">
                <Link to="/release/$id" params={{ id: release.id }}>
                  <Scale className="h-3.5 w-3.5" /> Open release case{" "}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </>
        )}
        {can(user, "view_institutions") && institution && (
          <Button asChild size="sm" variant="ghost">
            <Link to="/institutions/$id" params={{ id: institution.id }}>
              Institution profile
            </Link>
          </Button>
        )}
      </div>

      <NextActionStrip action={action} />

      {openFindings.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-md border tone-warning p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">
              {openFindings.length} open finding{openFindings.length > 1 ? "s" : ""} — review
              required
            </p>
            <p className="mt-1 text-xs">
              Findings are prompts for human review, not allegations of fraud. Acceptance is blocked
              until every open finding is resolved or explicitly accepted with risk.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <Panel title="Obligation" className="lg:col-span-2">
          {obligation ? (
            <>
              <p className="text-xs font-medium">{obligation.purpose}</p>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <MiniFact label="Obligation amount" value={INR(obligation.amount)} />
                <MiniFact
                  label="Obligation status"
                  value={<StatusPill status={obligation.status} />}
                />
                <MiniFact
                  label="Policy"
                  value={`${policy?.label ?? "—"} · clause ${policy?.sourceClause ?? "—"}`}
                />
                <MiniFact
                  label="Regulatory hold ends"
                  value={
                    obligation.holdEndDate ? (
                      fmtDate(obligation.holdEndDate)
                    ) : (
                      <span className="rounded tone-warning px-1.5 py-0.5 text-[10px] font-medium">
                        Not confirmed
                      </span>
                    )
                  }
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Obligation not found.</p>
          )}
        </Panel>
        <Panel title="Bank maturity">
          <p className="font-mono text-lg font-semibold text-heading">
            {fmtDate(instrument.maturityDate)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {relativeDays(instrument.maturityDate)}
          </p>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Instrument event only. It does not mark the deposit releasable.
          </p>
        </Panel>
        <Panel title="Regulatory hold ends">
          <p className="font-mono text-lg font-semibold text-heading">
            {instrument.holdEndDate ? fmtDate(instrument.holdEndDate) : "Not recorded"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {instrument.holdEndDate ? relativeDays(instrument.holdEndDate) : "Obligation event"}
          </p>
          {!instrument.holdEndDate && (
            <p className="mt-3 text-[11px] text-destructive">
              Blocking condition: confirm the applicable hold term before any release decision.
            </p>
          )}
        </Panel>
      </div>

      <Tabs defaultValue="overview" className="mt-5">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">
            Documents{" "}
            <span className="ml-1 text-[10px] text-muted-foreground">{documents.length}</span>
          </TabsTrigger>
          <TabsTrigger value="verification">
            Verification{" "}
            <span className="ml-1 text-[10px] text-muted-foreground">{findings.length}</span>
          </TabsTrigger>
          <TabsTrigger value="renewal">Renewal chain</TabsTrigger>
          <TabsTrigger value="timeline">
            Audit timeline{" "}
            <span className="ml-1 text-[10px] text-muted-foreground">{timeline.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Instrument details" className="lg:col-span-2">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                {[
                  ["Type", instrument.type],
                  ["Bank", instrument.bank],
                  ["Branch", instrument.branch],
                  ["IFSC", instrument.ifsc],
                  ["Amount", INR(instrument.amount)],
                  ["Issue date", fmtDate(instrument.issueDate)],
                  ["Maturity date", fmtDate(instrument.maturityDate)],
                  ["Instrument status", null],
                  ["Provenance", null],
                  ["Submitted", fmtDateTime(instrument.createdAt)],
                  ["Last updated", fmtDateTime(instrument.updatedAt)],
                  ["Case officer", instrument.officer],
                  ["Normalized reference", instrument.referenceKey],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="text-[11px] text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 text-xs font-medium">
                      {label === "Instrument status" ? (
                        <StatusPill status={instrument.instrumentStatus} />
                      ) : label === "Provenance" ? (
                        <ProvenanceTag provenance={instrument.provenance} />
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5">
                <GuardrailNote>
                  A bank-issued verification, when supported, must include authoritative response
                  identity, timestamp and provenance. This prototype only stores a SIMULATED adapter
                  result and never promotes it to BANK_CONFIRMED_AUTHORIZED.
                </GuardrailNote>
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel title="Review SLA">
                {workItem ? (
                  <>
                    <p className="text-xs font-medium">{workItem.title}</p>
                    <div className="mt-3 space-y-2 text-[11px] text-muted-foreground">
                      <p>Owner: {workItem.assigneeName}</p>
                      <p>
                        Due: {fmtDate(workItem.dueDate)} · {relativeDays(workItem.dueDate)}
                      </p>
                      <p>
                        Reason code: <span className="font-mono">{workItem.reasonCode}</span>
                      </p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <StatusPill status={workItem.priority} />
                      <StatusPill status={workItem.status} />
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No open work item for this case.</p>
                )}
              </Panel>
              <Panel title="Finding summary">
                {findings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No deterministic findings raised.</p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {findings.map((finding) => (
                      <li key={finding.id} className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px]">{finding.code}</span>
                        <StatusPill status={finding.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>

          <Panel
            title="Findings & discrepancies"
            description="Each finding names the field, expected/observed value, rule version, and next action."
          >
            {findings.length === 0 ? (
              <p className="text-xs text-muted-foreground">No findings for this instrument.</p>
            ) : (
              <div className="space-y-3">
                {findings.map((finding) => (
                  <div key={finding.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px]">{finding.code}</span>
                        <StatusPill status={finding.severity} />
                        <StatusPill status={finding.status} />
                      </div>
                      {canScrutinise && finding.status === "OPEN" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setFindingId(finding.id);
                          }}
                        >
                          Resolve finding
                        </Button>
                      )}
                    </div>
                    <p className="mt-2 text-xs">
                      <span className="text-muted-foreground">{finding.field}:</span> expected{" "}
                      <span className="font-medium">{finding.expected}</span>; observed{" "}
                      <span className="font-medium">{finding.observed}</span>.
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Next action: {finding.nextAction}
                    </p>
                    {finding.resolution && (
                      <p className="mt-1 text-[11px] text-success">
                        Resolution: {finding.resolution}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Panel
            title="Document vault"
            description="Private metadata, monotonic versions and SHA-256 checksum. No public bucket or direct object URL."
            action={
              canUpload ? (
                <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
                  <Upload className="h-3.5 w-3.5" /> Upload version
                </Button>
              ) : undefined
            }
          >
            {documents.length === 0 ? (
              <EmptyState
                title="No documents"
                hint="Attach an FDR copy, bank letter, or supporting proof."
                icon={FileText}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      {["Document", "Category", "Version", "SHA-256", "Uploaded", "Review", ""].map(
                        (heading) => (
                          <th key={heading} className="pb-2 pr-3 font-medium">
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((document) => (
                      <tr key={document.id} className="border-t align-top">
                        <td className="py-3 pr-3">
                          <p className="text-xs font-medium">{document.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatBytes(document.sizeBytes)} · {document.mime}
                          </p>
                          {document.note && (
                            <p className="mt-0.5 max-w-xs text-[10px] text-muted-foreground">
                              {document.note}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-[11px]">
                          {document.category.replace(/_/g, " ")}
                        </td>
                        <td className="py-3 pr-3 font-mono text-[11px]">v{document.version}</td>
                        <td className="py-3 pr-3">
                          <span className="font-mono text-[10px]" title={document.checksumSha256}>
                            {checksumPreview(document.checksumSha256)}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-[11px]">
                          {fmtDateTime(document.uploadedAt)}
                          <p className="text-[10px] text-muted-foreground">{document.uploadedBy}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <StatusPill status={document.reviewerStatus} />
                        </td>
                        <td className="py-3">
                          {canScrutinise && document.reviewerStatus !== "ACCEPTED" && (
                            <div className="flex flex-col gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markDocument(document.id, "ACCEPTED")}
                              >
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setDocumentId(document.id);
                                  setDialog("doc-clarify");
                                }}
                              >
                                Clarify
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              Accepted versions are immutable. Uploading a new version preserves prior versions for
              auditors; replacement never overwrites history — AC-11.
            </p>
          </Panel>
        </TabsContent>

        <TabsContent value="verification" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Provenance ladder"
              description="Evidence source is explicit and cannot be silently upgraded."
            >
              <ol className="space-y-3">
                {[
                  [
                    "INSTITUTION_DECLARED",
                    "Institution declared",
                    "Data entered by the institution. Not reviewed.",
                  ],
                  [
                    "OFFICIAL_DOCUMENT_REVIEW",
                    "Official document review",
                    "An AICTE officer reviewed the uploaded documents. Not a bank check.",
                  ],
                  [
                    "SIMULATED_BANK_RESPONSE",
                    "Simulated bank response",
                    "Controlled demo fixture. Never a real confirmation.",
                  ],
                  [
                    "BANK_CONFIRMED_AUTHORIZED",
                    "Bank confirmed (authorized)",
                    "Requires a written authorization mechanism and authoritative bank-origin proof. Not available in this prototype.",
                  ],
                ].map(([key, label, description]) => {
                  const active = instrument.provenance === key;
                  return (
                    <li
                      key={key}
                      className={`rounded-md border p-3 ${active ? "border-primary/50 bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{label}</span>
                        {active && <StatusPill status="CURRENT" />}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>
                    </li>
                  );
                })}
              </ol>
            </Panel>

            <Panel
              title="Simulated bank adapter"
              description="Demo only. The result is labelled everywhere."
            >
              <div className="space-y-3">
                <DemoBadge />
                <p className="text-xs text-muted-foreground">
                  Interface:{" "}
                  <span className="font-mono">
                    verifyInstrument({`{issuer, maskedReference, amount, maturityDate}`})
                  </span>
                  . A real result requires an authorized bank-origin response; this prototype
                  generates a controlled fixture and stores `SIMULATED_BANK_RESPONSE`.
                </p>
                {instrument.simulatedCheck ? (
                  <div className="rounded-md border tone-demo p-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <DemoBadge label={`SIMULATED · ${instrument.simulatedCheck.result}`} />
                      <span className="font-mono text-[10px]">
                        {instrument.simulatedCheck.evidenceRef}
                      </span>
                    </div>
                    <p className="mt-2">{instrument.simulatedCheck.note}</p>
                    <p className="mt-1 text-[10px]">{fmtDateTime(instrument.simulatedCheck.at)}</p>
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    No simulated response recorded yet.
                  </p>
                )}
                {canScrutinise && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const result = actions.simulateBankResponse(instrument.id, "MATCH");
                        if (result.ok) toast.success(result.message);
                        else toast.error(result.message);
                      }}
                    >
                      Run simulated match
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const result = actions.simulateBankResponse(instrument.id, "MISMATCH");
                        if (result.ok) toast.success(result.message);
                        else toast.error(result.message);
                      }}
                    >
                      Run simulated mismatch
                    </Button>
                  </div>
                )}
                <GuardrailNote>
                  The demo stub can never be promoted to BANK_CONFIRMED. Do not describe checksums,
                  uploads, or official review as bank authenticity confirmation.
                </GuardrailNote>
              </div>
            </Panel>
          </div>

          <Panel title="Checks and evidence">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [
                  "Document completeness",
                  documents.some((document) => document.category === "FDR_COPY")
                    ? "FDR copy present"
                    : "FDR copy missing",
                  documents.some((document) => document.category === "FDR_COPY"),
                ],
                [
                  "Amount vs obligation",
                  obligation && instrument.amount === obligation.amount
                    ? "Amounts match"
                    : "Mismatch — review",
                  Boolean(obligation && instrument.amount === obligation.amount),
                ],
                [
                  "Date order",
                  instrument.maturityDate > instrument.issueDate
                    ? "Maturity after issue"
                    : "Invalid date order",
                  instrument.maturityDate > instrument.issueDate,
                ],
                [
                  "Duplicate reference",
                  openFindings.some((finding) => finding.code === "DUPLICATE_REFERENCE")
                    ? "Duplicate detected"
                    : "No duplicate detected in scope",
                  !openFindings.some((finding) => finding.code === "DUPLICATE_REFERENCE"),
                ],
                [
                  "Regulatory hold",
                  instrument.holdEndDate ? "Hold end recorded" : "Hold end unconfirmed",
                  Boolean(instrument.holdEndDate),
                ],
                [
                  "Review state",
                  instrument.verificationStatus === "DOC_REVIEWED"
                    ? "Documentary review recorded"
                    : "Not documentary-reviewed",
                  instrument.verificationStatus === "DOC_REVIEWED",
                ],
              ].map(([label, value, ok]) => (
                <div key={String(label)} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    {ok ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    )}
                  </div>
                  <p className="mt-1 text-xs font-medium">{value}</p>
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="renewal" className="mt-4 space-y-4">
          <Panel
            title="Replacement chain"
            description="The prior instrument is never overwritten. A replacement stays pending until accepted."
            action={
              canUpload ? (
                <Button asChild size="sm" variant="outline">
                  <Link to="/submissions/new" search={{ replaces: instrument.id }}>
                    <GitCompareArrows className="h-3.5 w-3.5" /> File replacement
                  </Link>
                </Button>
              ) : undefined
            }
          >
            {!previous && !next ? (
              <EmptyState
                title="No linked renewal"
                hint="When this instrument matures, file a replacement linked to this record. The old maturity and evidence remain unchanged."
                icon={GitCompareArrows}
              />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {[previous, next].filter(Boolean).map((linked, index) => {
                  if (!linked) return null;
                  const linkedInstitution = state.institutions.find(
                    (entry) => entry.id === linked.institutionId,
                  );
                  return (
                    <div key={linked.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {index === 0 ? "Previous instrument" : "Replacement"}
                        </span>
                        <StatusPill status={linked.submissionStatus} />
                      </div>
                      <p className="mt-2 font-mono text-xs">{linked.fdrNo}</p>
                      <p className="text-xs text-muted-foreground">
                        {linkedInstitution?.name} · {linked.bank}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                        <p>Amount: {INR(linked.amount)}</p>
                        <p>Maturity: {fmtDate(linked.maturityDate)}</p>
                        <p>Issue: {fmtDate(linked.issueDate)}</p>
                        <p>
                          Status: <StatusPill status={linked.instrumentStatus} />
                        </p>
                      </div>
                      <Link
                        to="/registry/$id"
                        params={{ id: linked.id }}
                        className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        Open linked record <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
            {previous && (
              <div
                className={`mt-3 rounded-md border p-3 text-xs ${coverageGap > 0 ? "tone-warning" : "tone-success"}`}
              >
                {coverageGap > 0
                  ? `Coverage gap: replacement issue date is ${coverageGap} days after the previous maturity (${fmtDate(previous.maturityDate)}).`
                  : "No coverage gap detected between the previous maturity and the replacement issue date."}
              </div>
            )}
            {instrument.replacementReason && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                Replacement reason: {instrument.replacementReason}
              </p>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Panel
            title="Append-only event history"
            description="Actor, role, action, reason, correlation id, and permitted before/after values."
          >
            {timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground">No events in scope.</p>
            ) : (
              <ol className="relative space-y-5 border-l pl-5">
                {timeline.map((event) => (
                  <li key={event.id} className="relative">
                    <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{event.action}</p>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {event.entityType}
                      </span>
                      {event.source === "SIMULATED_ADAPTER" && <DemoBadge label="SIMULATED" />}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {fmtDateTime(event.at)} · {event.actorName} ·{" "}
                      {event.actorRole.replace(/_/g, " ")} ·{" "}
                      <span className="font-mono">{event.correlationId}</span>
                    </p>
                    {event.reason && <p className="mt-1 text-xs">{event.reason}</p>}
                    {(event.before || event.after) && (
                      <div className="mt-1.5 flex flex-wrap gap-2 font-mono text-[10px]">
                        {event.before && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                            before: {JSON.stringify(event.before)}
                          </span>
                        )}
                        {event.after && (
                          <span className="rounded bg-primary/5 px-1.5 py-0.5">
                            after: {JSON.stringify(event.after)}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Audit events cannot be edited or deleted through
              the application.
            </div>
          </Panel>
        </TabsContent>
      </Tabs>

      <ActionDialog
        open={dialog === "clarify"}
        onOpenChange={(open) => setDialog(open ? "clarify" : null)}
        title="Request clarification"
        description="The institution receives an actionable work item and alert. The case remains under scrutiny."
        confirmLabel="Record clarification request"
        onConfirm={handleDialog}
      />
      <ActionDialog
        open={dialog === "accept"}
        onOpenChange={(open) => setDialog(open ? "accept" : null)}
        title="Accept submission"
        description="Acceptance records documentary review only. It is not bank confirmation and does not release the deposit."
        confirmLabel="Accept submission"
        requireReason={false}
        reasonLabel="Review note (optional)"
        onConfirm={handleDialog}
      />
      <ActionDialog
        open={dialog === "return"}
        onOpenChange={(open) => setDialog(open ? "return" : null)}
        title="Return for correction"
        description="The reason is required and becomes part of the audited case history."
        confirmLabel="Return submission"
        destructive
        onConfirm={handleDialog}
      />
      <ActionDialog
        open={dialog === "reject"}
        onOpenChange={(open) => setDialog(open ? "reject" : null)}
        title="Reject submission"
        description="A rejection requires a documented reason. The institution can submit a corrected instrument."
        confirmLabel="Reject submission"
        destructive
        onConfirm={handleDialog}
      />
      <ActionDialog
        open={dialog === "doc-clarify"}
        onOpenChange={(open) => {
          setDialog(open ? "doc-clarify" : null);
          if (!open) setDocumentId(null);
        }}
        title="Request document clarification"
        description="The document version remains in history with a clarification status."
        confirmLabel="Record clarification"
        onConfirm={handleDialog}
      />
      <ActionDialog
        open={findingId !== null}
        onOpenChange={(open) => {
          if (!open) setFindingId(null);
        }}
        title="Resolve deterministic finding"
        description="Record what was checked. You may resolve, or accept the finding with documented risk."
        confirmLabel="Save finding outcome"
        reasonLabel="Resolution / risk justification"
        showRisk
        onConfirm={handleResolveFinding}
      />

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload document version</DialogTitle>
            <DialogDescription>
              Files stay in private storage in production. This demo records metadata and a real
              SHA-256 checksum in your browser.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-category">Document category</Label>
              <select
                id="doc-category"
                value={uploadCategory}
                onChange={(event) => setUploadCategory(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {DOCUMENT_CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-file">File (PDF, PNG, JPG · max 10 MB)</Label>
              <Input
                id="doc-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              />
              {uploadFile && (
                <p className="text-[11px] text-muted-foreground">
                  {uploadFile.name} · {formatBytes(uploadFile.size)}
                </p>
              )}
            </div>
            <div className="rounded-md border tone-demo p-3 text-[11px]">
              <p className="flex items-center gap-1.5 font-semibold">
                <LockKeyhole className="h-3.5 w-3.5" /> Demo vault
              </p>
              <p className="mt-1">
                The file is not uploaded anywhere. Only name, size, MIME type and checksum are
                stored in the browser demo store. Never upload real regulatory documents here.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              <FileUp className="h-4 w-4" /> {uploading ? "Computing checksum…" : "Record document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
