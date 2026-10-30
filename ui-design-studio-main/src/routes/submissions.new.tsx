import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  GitCompareArrows,
  Info,
  LockKeyhole,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AppShell,
  EmptyState,
  GuardrailNote,
  MiniFact,
  PageHeader,
  Panel,
  ScopeDenied,
  StatusPill,
} from "@/components/portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addDays,
  checksumPreview,
  DEMO_TODAY,
  fmtDate,
  formatBytes,
  INR,
  normalizeReference,
} from "@/lib/format";
import { can, visibleInstitutions } from "@/lib/selectors";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";
import type { DocumentInput, InstrumentType } from "@/lib/types";

export const Route = createFileRoute("/submissions/new")({
  validateSearch: (search: Record<string, unknown>): { replaces?: string } => {
    const replaces =
      typeof search["replaces"] === "string" && search["replaces"].trim()
        ? search["replaces"].trim()
        : undefined;
    return replaces ? { replaces } : {};
  },
  head: () => ({
    meta: [
      { title: "New submission · AICTE Smart FDR Portal" },
      {
        name: "description",
        content:
          "Guided security deposit submission with deterministic checks, document metadata and SHA-256 checksums.",
      },
    ],
  }),
  component: NewSubmissionPage,
});

const STEPS = ["Institution & obligation", "Instrument", "Documents", "Review"] as const;

const DOCUMENT_CATEGORIES = [
  ["FDR_COPY", "FDR scanned copy (required)"],
  ["BANK_LETTER", "Bank covering letter"],
  ["PAYMENT_PROOF", "Deposit / payment proof"],
  ["LOA_EOA", "Latest LoA / EoA"],
  ["AFFIDAVIT_6", "Affidavit 6"],
  ["OTHER", "Other supporting document"],
] as const;

const INSTRUMENT_TYPES: InstrumentType[] = ["FDR", "RTGS", "RPGF", "OTHER"];

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg"];

async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

interface UploadedDocument extends DocumentInput {
  localId: string;
}

function NewSubmissionPage() {
  const { user } = useSession();
  const { state, submitInstrument } = usePortal();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previous = search.replaces
    ? state.instruments.find((instrument) => instrument.id === search.replaces)
    : undefined;

  const institutions = user ? visibleInstitutions(state, user) : [];
  const [step, setStep] = useState(0);
  const [institutionId, setInstitutionId] = useState(
    previous?.institutionId ?? user?.institutionId ?? institutions[0]?.id ?? "",
  );
  const [obligationId, setObligationId] = useState(previous?.obligationId ?? "");
  const [type, setType] = useState<InstrumentType>(previous?.type ?? "FDR");
  const [fdrNo, setFdrNo] = useState("");
  const [bank, setBank] = useState(previous?.bank ?? "");
  const [branch, setBranch] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [amount, setAmount] = useState(String(previous?.amount ?? ""));
  const [issueDate, setIssueDate] = useState(DEMO_TODAY);
  const [maturityDate, setMaturityDate] = useState(addDays(DEMO_TODAY, 1095));
  const [holdEndDate, setHoldEndDate] = useState(previous?.holdEndDate ?? "");
  const [replacementReason, setReplacementReason] = useState(
    previous ? "Renew the maturing instrument while the regulatory hold continues." : "",
  );
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [docCategory, setDocCategory] = useState<string>("FDR_COPY");
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const obligations = useMemo(
    () => state.obligations.filter((obligation) => obligation.institutionId === institutionId),
    [state.obligations, institutionId],
  );
  const obligation = obligations.find((entry) => entry.id === obligationId);
  const institution = state.institutions.find((entry) => entry.id === institutionId);
  const previousAlreadyReplaced = Boolean(previous?.replacementInstrumentId);

  const duplicate = useMemo(() => {
    if (!fdrNo.trim() || !bank.trim()) return undefined;
    const key = normalizeReference(fdrNo);
    return state.instruments.find(
      (instrument) =>
        instrument.id !== previous?.id &&
        instrument.bank.toLowerCase() === bank.trim().toLowerCase() &&
        normalizeReference(instrument.fdrNo) === key &&
        instrument.institutionId !== institutionId,
    );
  }, [state.instruments, fdrNo, bank, institutionId, previous?.id]);

  const amountValue = Number(amount);
  const amountMismatch = Boolean(
    obligation && amountValue > 0 && amountValue !== obligation.amount,
  );
  const dateOrderInvalid = Boolean(
    issueDate && maturityDate && new Date(maturityDate) <= new Date(issueDate),
  );
  const hasFdrCopy = documents.some((document) => document.category === "FDR_COPY");

  const stepErrors = (target: number): string[] => {
    const found: string[] = [];
    if (target === 0) {
      if (!institutionId) found.push("Select an institution.");
      if (!obligationId) found.push("Select the obligation this instrument supports.");
      if (previousAlreadyReplaced)
        found.push(
          `This instrument already has a linked replacement (${previous?.replacementInstrumentId}). Open the renewal chain instead of filing a second replacement.`,
        );
    }
    if (target === 1) {
      if (!fdrNo.trim()) found.push("Instrument reference is required.");
      if (!bank.trim()) found.push("Issuing bank is required.");
      if (!branch.trim()) found.push("Branch is required.");
      if (!ifsc.trim()) found.push("IFSC is required.");
      if (!(amountValue > 0)) found.push("Amount must be greater than zero.");
      if (!issueDate) found.push("Issue date is required.");
      if (!maturityDate) found.push("Maturity date is required.");
      if (dateOrderInvalid) found.push("Maturity must be after the issue date.");
    }
    if (target === 2) {
      if (!hasFdrCopy)
        found.push(
          "Attach the FDR scanned copy before submitting. Drafts may be saved without it.",
        );
    }
    return found;
  };

  const goTo = (target: number) => {
    const found = stepErrors(target - 1);
    if (target > step && found.length > 0) {
      setErrors(found);
      toast.error("Complete the current step", { description: found[0] });
      return;
    }
    setErrors([]);
    setStep(target);
  };

  const onSelectObligation = (value: string) => {
    setObligationId(value);
    const selected = state.obligations.find((entry) => entry.id === value);
    if (selected && !previous) {
      setAmount(String(selected.amount));
      setHoldEndDate(selected.holdEndDate ?? "");
    }
  };

  const addDocument = async (file: File | null) => {
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Unsupported file type", {
        description: "The demo accepts PDF, PNG, or JPG documents only.",
      });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File too large", { description: "The demo limit is 10 MB per document." });
      return;
    }
    setUploading(true);
    try {
      const checksum = await computeSha256(file);
      setDocuments((current) => [
        ...current,
        {
          localId: `${file.name}-${checksum.slice(0, 8)}`,
          name: file.name,
          category: docCategory,
          mime: file.type,
          sizeBytes: file.size,
          checksumSha256: checksum,
          note: "Metadata and SHA-256 only. The file is not uploaded to a server.",
        },
      ]);
      toast.success("Document metadata recorded", {
        description: `SHA-256 ${checksum.slice(0, 16)}…`,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      toast.error("Could not compute SHA-256", {
        description: "Hash computation requires a secure browser context (localhost or HTTPS).",
      });
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;

  if (!can(user, "create_submission")) {
    return (
      <AppShell>
        <ScopeDenied message="Your role cannot file submissions. Institution administrators create and submit instruments; officials review them." />
      </AppShell>
    );
  }

  if (previous && !institutions.some((entry) => entry.id === previous.institutionId)) {
    return (
      <AppShell>
        <ScopeDenied message="The instrument being replaced belongs to another institution." />
      </AppShell>
    );
  }

  const draft = () => {
    if (!obligation || !institution) {
      toast.error("Select an institution and obligation first.");
      return;
    }
    const result = submitInstrument(
      {
        institutionId,
        obligationId,
        type,
        fdrNo,
        bank,
        branch,
        ifsc,
        amount: amountValue,
        issueDate,
        maturityDate,
        holdEndDate: holdEndDate || null,
        beneficiary: institution.ownerName,
        purpose: obligation.purpose,
        policyVersionId: obligation.policyVersionId,
        ...(previous ? { previousInstrumentId: previous.id } : {}),
        ...(replacementReason.trim() ? { replacementReason: replacementReason.trim() } : {}),
        documents: documents.map(({ localId: _localId, ...document }) => document),
        officer: "A. Mehta",
      },
      "draft",
    );
    if (result.ok && result.id) {
      toast.success(result.message);
      navigate({ to: "/registry/$id", params: { id: result.id } });
    } else {
      toast.error(result.message);
    }
  };

  const submit = () => {
    for (const target of [0, 1, 2]) {
      const found = stepErrors(target);
      if (found.length > 0) {
        setStep(target);
        setErrors(found);
        toast.error("Submission is not ready", { description: found[0] });
        return;
      }
    }
    if (!obligation || !institution) return;
    const result = submitInstrument(
      {
        institutionId,
        obligationId,
        type,
        fdrNo,
        bank,
        branch,
        ifsc,
        amount: amountValue,
        issueDate,
        maturityDate,
        holdEndDate: holdEndDate || null,
        beneficiary: institution.ownerName,
        purpose: obligation.purpose,
        policyVersionId: obligation.policyVersionId,
        ...(previous ? { previousInstrumentId: previous.id } : {}),
        ...(replacementReason.trim() ? { replacementReason: replacementReason.trim() } : {}),
        documents: documents.map(({ localId: _localId, ...document }) => document),
        officer: "A. Mehta",
      },
      "submit",
    );
    if (result.ok && result.id) {
      toast.success(result.message, { duration: 6000 });
      navigate({ to: "/registry/$id", params: { id: result.id } });
    } else {
      toast.error(result.message);
    }
  };

  const checkRows: { label: string; state: "pass" | "warn" | "fail"; detail: string }[] = [
    {
      label: "Institution & obligation selected",
      state: obligation && institution ? "pass" : "fail",
      detail: obligation ? `${institution?.name} · ${obligation.purpose}` : "Not selected",
    },
    {
      label: "Amount matches obligation",
      state: !amountValue ? "fail" : amountMismatch ? "warn" : "pass",
      detail: obligation
        ? amountMismatch
          ? `Entered ${INR(amountValue || 0)} vs obligation ${INR(obligation.amount)}. A finding will be raised.`
          : `Both ${INR(obligation.amount)}`
        : "Select an obligation",
    },
    {
      label: "Date order valid",
      state: !issueDate || !maturityDate ? "fail" : dateOrderInvalid ? "fail" : "pass",
      detail: dateOrderInvalid
        ? "Maturity must be after issue date."
        : `${fmtDate(issueDate)} → ${fmtDate(maturityDate)}`,
    },
    {
      label: "No duplicate normalized reference",
      state: duplicate ? "warn" : fdrNo.trim() && bank.trim() ? "pass" : "fail",
      detail: duplicate
        ? `Matches ${duplicate.fdrNo} at ${duplicate.bank} (${duplicate.institutionId}). A HIGH finding will be raised.`
        : "Cross-institution check runs on submit.",
    },
    {
      label: "FDR copy attached",
      state: hasFdrCopy ? "pass" : "fail",
      detail: hasFdrCopy
        ? `${documents.filter((document) => document.category === "FDR_COPY").length} copy version(s)`
        : "Required for submission; draft may be saved without it.",
    },
    {
      label: "Regulatory hold end recorded",
      state: holdEndDate ? "pass" : "warn",
      detail: holdEndDate
        ? fmtDate(holdEndDate)
        : "Not recorded. Maturity will not be treated as release eligibility.",
    },
  ];

  return (
    <AppShell>
      <Link
        to="/registry"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Registry
      </Link>

      <PageHeader
        eyebrow="Guided intake"
        title={previous ? "File replacement instrument" : "New security deposit submission"}
        sub={
          previous
            ? `Linked to ${previous.fdrNo}. The prior record remains immutable while this replacement is scrutinised.`
            : "Four steps. Deterministic checks run in the browser; nothing is approved automatically."
        }
        action={
          <Button variant="outline" onClick={draft}>
            Save draft
          </Button>
        }
      />

      {previous && (
        <div className="mb-4 rounded-md border tone-info p-3 text-xs">
          <p className="flex items-center gap-2 font-semibold">
            <GitCompareArrows className="h-3.5 w-3.5" /> Replacement context locked
          </p>
          <p className="mt-1">
            Previous instrument {previous.fdrNo} · maturity {fmtDate(previous.maturityDate)} · hold
            ends {previous.holdEndDate ? fmtDate(previous.holdEndDate) : "unconfirmed"}.
            Institution, obligation, amount and hold date are prefilled from the prior record.
          </p>
          {previousAlreadyReplaced && (
            <p className="mt-2 flex items-center gap-1 font-semibold text-destructive">
              <XCircle className="h-3.5 w-3.5" />
              This instrument already has replacement {previous.replacementInstrumentId}. Open the
              renewal chain instead.
            </p>
          )}
        </div>
      )}

      <div className="mb-5 grid gap-2 sm:grid-cols-4">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => goTo(index)}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition ${
              index === step
                ? "border-primary bg-primary/5 font-semibold text-primary"
                : index < step
                  ? "border-success/40 bg-success/5"
                  : "bg-card text-muted-foreground"
            }`}
          >
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
                index < step
                  ? "bg-success text-white"
                  : index === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {index < step ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            {label}
          </button>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="mb-4 rounded-md border tone-danger px-4 py-3 text-xs">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Fix before continuing
          </p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {step === 0 && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel
            title="Step 1 · Institution and obligation"
            description="An instrument is evidence for an obligation. Pick the obligation first."
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="institution">Institution</Label>
                <select
                  id="institution"
                  value={institutionId}
                  disabled={Boolean(previous) || user.role === "INSTITUTION_ADMIN"}
                  onChange={(event) => {
                    setInstitutionId(event.target.value);
                    setObligationId("");
                    setAmount("");
                  }}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:bg-muted disabled:opacity-80"
                >
                  <option value="">Select institution</option>
                  {institutions.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} · {entry.permanentId}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  {user.role === "INSTITUTION_ADMIN"
                    ? "Your account is scoped to this institution; cross-tenant selection is forbidden."
                    : "Administrators may file on behalf of any institution in scope."}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="obligation">Deposit obligation</Label>
                <select
                  id="obligation"
                  value={obligationId}
                  disabled={Boolean(previous)}
                  onChange={(event) => onSelectObligation(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm disabled:bg-muted disabled:opacity-80"
                >
                  <option value="">Select the obligation supported</option>
                  {obligations.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.purpose} · {INR(entry.amount)}
                    </option>
                  ))}
                </select>
                {obligations.length === 0 && (
                  <p className="text-[11px] text-destructive">
                    No obligations exist for this institution. Ask an administrator to create the
                    obligation before filing an instrument.
                  </p>
                )}
              </div>

              {obligation && (
                <div className="grid gap-3 rounded-md border bg-muted/40 p-3 sm:grid-cols-2">
                  <MiniFact label="Obligation amount" value={INR(obligation.amount)} />
                  <MiniFact
                    label="Obligation status"
                    value={<StatusPill status={obligation.status} />}
                  />
                  <MiniFact
                    label="Regulatory hold"
                    value={
                      obligation.holdEndDate ? fmtDate(obligation.holdEndDate) : "Not confirmed"
                    }
                  />
                  <MiniFact
                    label="Policy version"
                    value={
                      state.policies.find((policy) => policy.id === obligation.policyVersionId)
                        ?.label ?? obligation.policyVersionId
                    }
                  />
                </div>
              )}

              <GuardrailNote>
                A matured instrument does not satisfy or close the obligation automatically.
                Replacement links preserve both records; nothing is overwritten.
              </GuardrailNote>
            </div>
          </Panel>

          <Panel
            title="Why obligation-first?"
            description="This prevents a single FDR from being mistaken for the regulatory requirement."
          >
            <ul className="space-y-3 text-xs text-muted-foreground">
              {[
                [
                  "One obligation, many instruments",
                  "An FDR matures and is replaced; the deposit requirement continues until the hold ends and a release decision is recorded.",
                ],
                [
                  "Dates stay independent",
                  "Bank maturity, regulatory hold end and review SLA are separate dates with separate owners.",
                ],
                [
                  "Evidence, not approval",
                  "A submission opens a work item. It never approves the deposit or releases money.",
                ],
              ].map(([title, detail]) => (
                <li key={title}>
                  <p className="flex items-center gap-1.5 font-semibold text-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {title}
                  </p>
                  <p className="mt-1">{detail}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel
            title="Step 2 · Instrument details"
            description="Record exactly what the bank issued. The system will compare, not guess."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="type">Instrument type</Label>
                <select
                  id="type"
                  value={type}
                  onChange={(event) => setType(event.target.value as InstrumentType)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {INSTRUMENT_TYPES.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fdrNo">Instrument reference</Label>
                <Input
                  id="fdrNo"
                  value={fdrNo}
                  onChange={(event) => setFdrNo(event.target.value)}
                  placeholder="e.g. HDFC/FD/2026/120934"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank">Issuing bank</Label>
                <Input
                  id="bank"
                  value={bank}
                  onChange={(event) => setBank(event.target.value)}
                  placeholder="Bank name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                  placeholder="Branch, city"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ifsc">IFSC</Label>
                <Input
                  id="ifsc"
                  value={ifsc}
                  onChange={(event) => setIfsc(event.target.value.toUpperCase())}
                  placeholder="HDFC0000003"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount (INR)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  disabled={Boolean(previous)}
                  className="tabular-nums disabled:bg-muted"
                />
                {amountMismatch && (
                  <p className="text-[11px] text-warning">
                    Differs from the obligation amount. Submission is allowed but a HIGH finding
                    will be raised for reviewer resolution.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="issueDate">Issue date</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={issueDate}
                  onChange={(event) => setIssueDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maturityDate">Bank maturity date</Label>
                <Input
                  id="maturityDate"
                  type="date"
                  value={maturityDate}
                  onChange={(event) => setMaturityDate(event.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Instrument event. It is not a release date.
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="holdEnd">Regulatory hold ends (optional)</Label>
                <Input
                  id="holdEnd"
                  type="date"
                  value={holdEndDate}
                  onChange={(event) => setHoldEndDate(event.target.value)}
                  disabled={Boolean(previous)}
                  className="disabled:bg-muted"
                />
                <p className="text-[11px] text-muted-foreground">
                  Leave blank only when the applicable term is genuinely unknown. The release gate
                  will remain blocked until an officer confirms it.
                </p>
              </div>
              {previous && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="replacementReason">Replacement reason</Label>
                  <Textarea
                    id="replacementReason"
                    rows={2}
                    value={replacementReason}
                    onChange={(event) => setReplacementReason(event.target.value)}
                    placeholder="Why is this instrument replacing the prior record?"
                  />
                </div>
              )}
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel title="Live deterministic checks">
              <ul className="space-y-2.5 text-xs">
                {[
                  [
                    "Date order",
                    !dateOrderInvalid && issueDate && maturityDate ? "pass" : "fail",
                    dateOrderInvalid
                      ? "Maturity must follow issue."
                      : "Maturity follows issue date.",
                  ],
                  [
                    "Amount vs obligation",
                    amountMismatch ? "warn" : amountValue > 0 ? "pass" : "fail",
                    obligation ? `Obligation ${INR(obligation.amount)}` : "Select obligation",
                  ],
                  [
                    "Duplicate reference",
                    duplicate ? "warn" : fdrNo ? "pass" : "fail",
                    duplicate ? `Matches ${duplicate.fdrNo}` : "No cross-institution match yet",
                  ],
                  [
                    "Hold date recorded",
                    holdEndDate ? "pass" : "warn",
                    holdEndDate ? fmtDate(holdEndDate) : "Unknown hold term",
                  ],
                ].map(([label, stateValue, detail]) => (
                  <li key={label} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{detail}</p>
                    </div>
                    {stateValue === "pass" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    ) : stateValue === "warn" ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
            <GuardrailNote>
              Checks are deterministic rule prompts. They are not fraud detection, credit scoring,
              or an approval recommendation. Every hit requires a human resolution.
            </GuardrailNote>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel
            title="Step 3 · Documents"
            description="Attach evidence metadata. In production these files live in a private bucket with signed access."
          >
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="doc-category">Document category</Label>
                <select
                  id="doc-category"
                  value={docCategory}
                  onChange={(event) => setDocCategory(event.target.value)}
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
                <Label htmlFor="doc-file">File</Label>
                <Input
                  id="doc-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  disabled={uploading}
                  onChange={(event) => void addDocument(event.target.files?.[0] ?? null)}
                  className="w-full sm:w-64"
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              PDF, PNG or JPG · max 10 MB · SHA-256 computed in your browser. The file itself is not
              transmitted or stored by this prototype.
            </p>

            <div className="mt-4">
              {documents.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center">
                  <Upload className="mx-auto h-5 w-5 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">No documents recorded</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    The FDR copy is required for submission. A draft can be saved without it.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {documents.map((document) => (
                    <li
                      key={document.localId}
                      className="flex items-start gap-3 rounded-md border p-3"
                    >
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{document.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {document.category.replace(/_/g, " ")} · {formatBytes(document.sizeBytes)}{" "}
                          · {document.mime}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          SHA-256 {checksumPreview(document.checksumSha256)}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${document.name}`}
                        onClick={() =>
                          setDocuments((current) =>
                            current.filter((entry) => entry.localId !== document.localId),
                          )
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel title="Document requirements">
              <ul className="space-y-2 text-xs">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>FDR scanned copy — required for submission</span>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>Bank covering letter — strongly recommended</span>
                </li>
                <li className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>LoA / EoA — required by the release checklist later</span>
                </li>
              </ul>
              <div className="mt-3 rounded-md border tone-demo p-3 text-[11px]">
                <p className="flex items-center gap-1.5 font-semibold">
                  <LockKeyhole className="h-3.5 w-3.5" /> Synthetic-data warning
                </p>
                <p className="mt-1">
                  Do not upload real FDRs or personal data. This demo records only file name, type,
                  size and checksum in browser storage.
                </p>
              </div>
            </Panel>
            <GuardrailNote>
              A checksum proves the bytes did not change between selection and review. It does not
              prove the document is genuine or that a bank issued it.
            </GuardrailNote>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel
            title="Step 4 · Review and submit"
            description="Submitting creates a case-officer work item and an append-only audit event."
          >
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <MiniFact label="Institution" value={institution?.name ?? "—"} />
              <MiniFact label="Permanent ID" value={institution?.permanentId ?? "—"} mono />
              <MiniFact label="Obligation" value={obligation?.purpose ?? "—"} />
              <MiniFact label="Policy pin" value={obligation?.policyVersionId ?? "—"} mono />
              <MiniFact label="Instrument" value={`${type} · ${fdrNo || "—"}`} />
              <MiniFact
                label="Bank / branch"
                value={`${bank || "—"}${branch ? ` · ${branch}` : ""}`}
              />
              <MiniFact label="IFSC" value={ifsc || "—"} mono />
              <MiniFact label="Amount" value={amountValue > 0 ? INR(amountValue) : "—"} />
              <MiniFact label="Issue date" value={fmtDate(issueDate)} />
              <MiniFact label="Maturity date" value={fmtDate(maturityDate)} />
              <MiniFact
                label="Regulatory hold ends"
                value={holdEndDate ? fmtDate(holdEndDate) : "Not recorded"}
              />
              <MiniFact label="Documents" value={`${documents.length} attached`} />
            </dl>

            {previous && (
              <div className="mt-4 rounded-md border tone-info p-3 text-xs">
                <p className="flex items-center gap-1.5 font-semibold">
                  <GitCompareArrows className="h-3.5 w-3.5" /> Replacement of {previous.fdrNo}
                </p>
                <p className="mt-1 text-muted-foreground">
                  On acceptance, the prior record becomes SUPERSEDED and is preserved unchanged for
                  audit. Its original evidence and maturity remain readable.
                </p>
              </div>
            )}

            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Deterministic checks
              </h3>
              <ul className="mt-2 space-y-2">
                {checkRows.map((row) => (
                  <li
                    key={row.label}
                    className="flex items-start gap-2 rounded-md border p-2.5 text-xs"
                  >
                    {row.state === "pass" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    ) : row.state === "warn" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <div>
                      <p className="font-medium">{row.label}</p>
                      <p className="text-[11px] text-muted-foreground">{row.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" onClick={draft}>
                Save as draft
              </Button>
              <Button onClick={submit} disabled={previousAlreadyReplaced}>
                <Send className="h-4 w-4" /> Submit for scrutiny
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Submission does not accept, verify, or approve anything. A case officer must complete
              documentary review; bank confirmation is separate and unavailable in this demo.
            </p>
          </Panel>

          <div className="space-y-4">
            <Panel title="What happens next">
              <ol className="space-y-3 text-xs">
                {[
                  [
                    "Case officer work item",
                    "A priority- and SLA-scored review task is created for the Regulation Bureau.",
                  ],
                  [
                    "Deterministic findings",
                    "Duplicate references or amount differences raise named findings for human resolution.",
                  ],
                  [
                    "Documentary review",
                    "An officer accepts, clarifies, returns, or rejects the submission with a recorded reason.",
                  ],
                  [
                    "No automatic release",
                    "Maturity alone never releases funds. Release requires clearances and a delegated decision.",
                  ],
                ].map(([title, detail], index) => (
                  <li key={title} className="flex gap-3">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
            <GuardrailNote>
              By submitting you confirm the entered data is synthetic demo data. Production intake
              requires verified institutional identity and server-side authorization.
            </GuardrailNote>
          </div>
        </div>
      )}

      {step === 0 && institutions.length === 0 && (
        <div className="mt-4">
          <EmptyState
            title="No institution in scope"
            hint="Your account has no verified institution. Contact an administrator."
          />
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-2 border-t pt-4">
        <Button variant="outline" onClick={() => goTo(Math.max(0, step - 1))} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Step {step + 1} of {STEPS.length} · demo clock {fmtDate(DEMO_TODAY)}
        </p>
        <Button
          variant={step === STEPS.length - 1 ? "default" : "outline"}
          onClick={() => (step === STEPS.length - 1 ? submit() : goTo(step + 1))}
          disabled={step === STEPS.length - 1 && previousAlreadyReplaced}
        >
          {step === STEPS.length - 1 ? (
            <>
              <Send className="h-4 w-4" /> Submit for scrutiny
            </>
          ) : (
            <>
              Next <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </AppShell>
  );
}
