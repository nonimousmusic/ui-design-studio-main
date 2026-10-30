import { createFileRoute, Link, Outlet, useMatch, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  FileCheck2,
  Gavel,
  LockKeyhole,
  Plus,
  Scale,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, EmptyState, PageHeader, Panel, StatCard, StatusPill } from "@/components/portal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate, fmtDateTime, INR } from "@/lib/format";
import {
  can,
  releaseBlockers,
  visibleInstitutions,
  visibleInstruments,
  visibleReleases,
} from "@/lib/selectors";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/release")({
  validateSearch: (search: Record<string, unknown>): { instrument?: string } => {
    const instrument =
      typeof search["instrument"] === "string" && search["instrument"].trim()
        ? search["instrument"].trim()
        : undefined;
    return instrument ? { instrument } : {};
  },
  head: () => ({
    meta: [
      { title: "Release workspace · AICTE Smart FDR Portal" },
      {
        name: "description",
        content:
          "Release cases with checklist evidence, bureau clearances, blockers and delegated decisions.",
      },
    ],
  }),
  component: ReleaseListPage,
});

const OPEN_STATUSES = ["DRAFT", "SUBMITTED", "CLEARANCES_PENDING", "DECISION_PENDING"];

function ReleaseListPage() {
  const child = useMatch({ from: "/release/$id", shouldThrow: false });
  const { user } = useSession();
  const { state, createRelease } = usePortal();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const instruments = user ? visibleInstruments(state, user) : [];
  const releases = user ? visibleReleases(state, user) : [];
  const institutions = user ? visibleInstitutions(state, user) : [];

  const initialInstrument =
    instruments.find((instrument) => instrument.id === search.instrument) ?? null;
  const [dialogOpen, setDialogOpen] = useState(Boolean(initialInstrument));
  const [selectedId, setSelectedId] = useState(initialInstrument?.id ?? "");
  const [reason, setReason] = useState(
    initialInstrument
      ? "Request release under the applicable policy after verification of the regulatory holding term and mandatory clearances."
      : "",
  );
  const [statusFilter, setStatusFilter] = useState("ALL");

  const selectedInstrument = instruments.find((instrument) => instrument.id === selectedId);
  const selectedObligation = selectedInstrument
    ? state.obligations.find((obligation) => obligation.id === selectedInstrument.obligationId)
    : undefined;
  const selectedInstitution = selectedInstrument
    ? institutions.find((institution) => institution.id === selectedInstrument.institutionId)
    : undefined;

  const requestable = instruments.filter(
    (instrument) =>
      !["SUPERSEDED", "RELEASED"].includes(instrument.instrumentStatus) &&
      !releases.some(
        (release) =>
          release.instrumentId === instrument.id && OPEN_STATUSES.includes(release.status),
      ),
  );

  if (child) return <Outlet />;
  if (!user) return null;

  const open = releases.filter((release) => OPEN_STATUSES.includes(release.status));
  const decisionPending = releases.filter((release) => release.status === "DECISION_PENDING");
  const approved = releases.filter((release) => release.status === "APPROVED");
  const blocked = open.filter((release) => releaseBlockers(state, release).length > 0);

  const visibleRows = releases
    .filter((release) => statusFilter === "ALL" || release.status === statusFilter)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  const submitRequest = () => {
    if (!selectedInstrument || !selectedObligation) {
      toast.error("Select an instrument with a valid obligation.");
      return;
    }
    if (!reason.trim()) {
      toast.error("A release reason is required.");
      return;
    }
    const result = createRelease({
      obligationId: selectedInstrument.obligationId,
      instrumentId: selectedInstrument.id,
      reason: reason.trim(),
      requestedBy: user.name,
    });
    if (result.ok && result.id) {
      toast.success(result.message);
      setDialogOpen(false);
      navigate({ to: "/release/$id", params: { id: result.id } });
    } else {
      toast.error(result.message);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Workspace · release gate"
        title="Release workspace"
        sub="A deposit becomes releasable only when the checklist, mandatory clearances and a delegated decision are complete. Maturity alone is not eligibility."
        action={
          can(user, "create_release") ? (
            <Button
              onClick={() => {
                setSelectedId(requestable[0]?.id ?? "");
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Request release
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to="/registry">
                <Scale className="h-4 w-4" /> Open registry
              </Link>
            </Button>
          )
        }
      />

      {!can(user, "create_release") && !can(user, "decide_release") && (
        <div className="mb-4 flex items-start gap-2 rounded-md border tone-info px-4 py-2.5 text-xs">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            You have read-only visibility of release cases. Clearance actions are recorded by the
            assigned reviewer; the final decision requires the delegated competent authority.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Open cases"
          value={String(open.length)}
          hint={`${releases.length} total in scope`}
          icon={Scale}
        />
        <StatCard
          label="Decision pending"
          value={String(decisionPending.length)}
          hint="Prerequisites met; awaiting authority"
          tone={decisionPending.length ? "warning" : "success"}
          icon={Gavel}
        />
        <StatCard
          label="Blocked"
          value={String(blocked.length)}
          hint="Unmet checklist, clearance or finding"
          tone={blocked.length ? "danger" : "success"}
          icon={AlertTriangle}
        />
        <StatCard
          label="Approved records"
          value={String(approved.length)}
          hint="PROPOSED outcome — not an issued NOC"
          tone="success"
          icon={CheckCircle2}
        />
      </div>

      <Panel
        className="mt-4"
        title="Release cases"
        description="Every card shows prerequisites and the responsible owner. Decisions are never automatic."
        action={
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filter release status"
            className="rounded-md border bg-card px-3 py-1.5 text-xs"
          >
            <option value="ALL">All statuses</option>
            {[
              "SUBMITTED",
              "CLEARANCES_PENDING",
              "DECISION_PENDING",
              "APPROVED",
              "REJECTED",
              "CLOSED",
            ].map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        }
      >
        {visibleRows.length === 0 ? (
          <EmptyState
            title="No release cases in scope"
            hint={
              can(user, "create_release")
                ? "Request release when the deposit is being discharged. The checklist and clearance matrix are generated automatically."
                : "No release cases are currently assigned or visible to your role."
            }
            icon={Scale}
            action={
              can(user, "create_release") ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedId(requestable[0]?.id ?? "");
                    setDialogOpen(true);
                  }}
                >
                  Request release
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {visibleRows.map((release) => {
              const instrument = state.instruments.find(
                (entry) => entry.id === release.instrumentId,
              );
              const institution = institutions.find((entry) => entry.id === release.institutionId);
              const blockers = releaseBlockers(state, release);
              const done = release.checklist.filter((item) => item.done).length;
              const cleared = release.clearances.filter(
                (clearance) =>
                  clearance.status === "CLEARED" || clearance.status === "NOT_APPLICABLE",
              ).length;
              const decided = Boolean(release.decision);
              return (
                <div key={release.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to="/release/$id"
                        params={{ id: release.id }}
                        className="font-mono text-xs font-semibold hover:underline"
                      >
                        {release.id}
                      </Link>
                      <p className="mt-0.5 truncate text-sm font-medium">{institution?.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {instrument?.fdrNo} · {instrument ? INR(instrument.amount) : "—"} ·
                        requested {fmtDate(release.requestedAt)}
                      </p>
                    </div>
                    <StatusPill status={release.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <p>
                      <span className="text-muted-foreground">Checklist </span>
                      {done}/{release.checklist.length}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Clearances </span>
                      {cleared}/{release.clearances.length}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Hold ends </span>
                      {instrument?.holdEndDate ? fmtDate(instrument.holdEndDate) : "unconfirmed"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Maturity </span>
                      {instrument ? fmtDate(instrument.maturityDate) : "—"}
                    </p>
                  </div>

                  <div className="mt-3">
                    {decided ? (
                      <div
                        className={`rounded-md border p-2.5 text-[11px] ${release.decision?.outcome === "APPROVED" ? "tone-success" : "tone-danger"}`}
                      >
                        <p className="flex items-center gap-1.5 font-semibold">
                          {release.decision?.outcome === "APPROVED" ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          {release.decision?.outcome} by {release.decision?.authorityName}
                        </p>
                        <p className="mt-0.5">
                          {release.decision ? fmtDateTime(release.decision.decidedAt) : ""} ·{" "}
                          {release.decision?.instrumentRoute === "NOC_RECORD"
                            ? "NOC record PROPOSED"
                            : release.decision?.instrumentRoute === "SANCTION_ORDER"
                              ? "Sanction order PROPOSED"
                              : "No instrument route"}
                        </p>
                      </div>
                    ) : blockers.length > 0 ? (
                      <div className="rounded-md border tone-warning p-2.5 text-[11px]">
                        <p className="flex items-center gap-1.5 font-semibold">
                          <LockKeyhole className="h-3.5 w-3.5" /> {blockers.length} blocker
                          {blockers.length === 1 ? "" : "s"}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                          {blockers[0]?.label} · owner: {blockers[0]?.owner}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-md border tone-success p-2.5 text-[11px]">
                        <p className="flex items-center gap-1.5 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Ready for delegated decision
                        </p>
                        <p className="mt-0.5">
                          Only the competent authority can record the outcome.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/release/$id" params={{ id: release.id }}>
                        Open workspace <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </Button>
                    {instrument && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/registry/$id" params={{ id: instrument.id }}>
                          Instrument case
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <div className="mt-4 flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-[11px] text-muted-foreground">
        <FileCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          FDR/RPGF cases produce a proposed NOC record; RTGS cases produce a proposed sanction-order
          record. Neither is issued in this prototype, and no money moves. Bank account particulars
          and original instruments require separate authorized verification.
        </p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request release of a security deposit</DialogTitle>
            <DialogDescription>
              This creates a case with the prescribed checklist and clearance matrix. It does not
              release funds or approve the request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="release-instrument">Instrument</Label>
              <select
                id="release-instrument"
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setReason("");
                }}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Select an instrument</option>
                {requestable.map((instrument) => {
                  const institution = institutions.find(
                    (entry) => entry.id === instrument.institutionId,
                  );
                  return (
                    <option key={instrument.id} value={instrument.id}>
                      {instrument.fdrNo} · {institution?.shortName ?? institution?.name} ·{" "}
                      {INR(instrument.amount)}
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Instruments with an open release case are excluded to prevent duplicate requests.
              </p>
            </div>

            {selectedInstrument && selectedObligation && (
              <div className="rounded-md border bg-muted/40 p-3 text-[11px]">
                <p className="font-medium">{selectedInstitution?.name}</p>
                <p className="text-muted-foreground">{selectedObligation.purpose}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <p>Amount: {INR(selectedInstrument.amount)}</p>
                  <p>Maturity: {fmtDate(selectedInstrument.maturityDate)}</p>
                  <p>
                    Hold ends:{" "}
                    {selectedInstrument.holdEndDate
                      ? fmtDate(selectedInstrument.holdEndDate)
                      : "not recorded"}
                  </p>
                  <p>Status: {selectedInstrument.submissionStatus.replace(/_/g, " ")}</p>
                </div>
                {!selectedInstrument.holdEndDate && (
                  <p className="mt-2 flex items-center gap-1 font-medium text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" /> Regulatory hold end is unknown. The
                    release gate will remain blocked until confirmed.
                  </p>
                )}
                {selectedInstrument.verificationStatus !== "DOC_REVIEWED" && (
                  <p className="mt-1 text-muted-foreground">
                    Documentary review is not complete. The case can still be filed but cannot reach
                    a decision.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="release-reason">Reason for release</Label>
              <Textarea
                id="release-reason"
                rows={4}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Institution closure approved; regulatory holding term completed; deposit no longer required."
              />
            </div>

            <div className="rounded-md border tone-info p-3 text-[11px]">
              <p className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" /> What this request creates
              </p>
              <ul className="mt-1 list-disc pl-4">
                <li>Required checklist items and evidence placeholders</li>
                <li>Finance, PGRC, Vigilance and Approval Bureau clearance rows</li>
                <li>A clearance-reviewer work item and an open release alert</li>
                <li>An append-only audit event naming you and this reason</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitRequest} disabled={!selectedInstrument || !reason.trim()}>
              <Plus className="h-4 w-4" /> Create release case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
