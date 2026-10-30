import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  FileCheck2,
  Gavel,
  History,
  LockKeyhole,
  Scale,
  ShieldCheck,
  XCircle,
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
  ReadOnlyBanner,
  ScopeDenied,
  StatusPill,
} from "@/components/portal";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtDateTime, INR } from "@/lib/format";
import {
  can,
  canSeeInstitution,
  isReadOnly,
  releaseBlockers,
  visibleAudit,
  workItemFor,
} from "@/lib/selectors";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";
import type { ClearanceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/release/$id")({
  head: () => ({
    meta: [
      { title: "Release case · AICTE Smart FDR Portal" },
      {
        name: "description",
        content:
          "Release case workspace: checklist evidence, bureau clearances, blockers, delegated decision and audit trail.",
      },
    ],
  }),
  component: ReleaseWorkspace,
});

const CLEARANCE_ROLES = "assigned clearance reviewer / case officer";

function ReleaseWorkspace() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { state, toggleChecklistItem, recordClearance, decideRelease } = usePortal();
  const [clearanceAction, setClearanceAction] = useState<{
    id: string;
    status: ClearanceStatus;
  } | null>(null);
  const [decisionOutcome, setDecisionOutcome] = useState<"APPROVED" | "REJECTED" | null>(null);

  if (!user) return null;

  const release = state.releases.find((entry) => entry.id === id);
  if (!release) {
    return (
      <AppShell>
        <EmptyState
          title="Release case not found"
          hint="The case may not exist in the current demo store."
          icon={Scale}
        />
      </AppShell>
    );
  }
  if (!canSeeInstitution(user, release.institutionId)) {
    return (
      <AppShell>
        <ScopeDenied message="This release case belongs to another institution. Cross-tenant access is denied — AC-01." />
      </AppShell>
    );
  }

  const institution = state.institutions.find((entry) => entry.id === release.institutionId);
  const instrument = state.instruments.find((entry) => entry.id === release.instrumentId);
  const obligation = state.obligations.find((entry) => entry.id === release.obligationId);
  const blockers = releaseBlockers(state, release);
  const workItem = workItemFor(state, release.id);
  const canEditChecklist =
    can(user, "create_release") || can(user, "scrutinise") || can(user, "manage_admin");
  const canClear = can(user, "record_clearance");
  const canDecide = can(user, "decide_release");
  const ready = blockers.length === 0;
  const decided = Boolean(release.decision);
  const locked = decided || release.status === "CLOSED";
  const doneCount = release.checklist.filter((item) => item.done).length;
  const clearedCount = release.clearances.filter(
    (clearance) => clearance.status === "CLEARED" || clearance.status === "NOT_APPLICABLE",
  ).length;

  const audit = visibleAudit(state, user)
    .filter(
      (event) =>
        event.entityId === release.id ||
        (event.entityType === "DECISION" && event.entityId === release.id),
    )
    .sort((a, b) => b.at.localeCompare(a.at));

  const nextAction = {
    action: decided
      ? "No further action — decision recorded"
      : ready
        ? canDecide
          ? "Record delegated release decision"
          : "Await competent authority decision"
        : `Resolve ${blockers.length} release blocker${blockers.length === 1 ? "" : "s"}`,
    owner:
      workItem?.assigneeName ??
      (decided
        ? `${release.decision?.authorityName ?? "Competent authority"}`
        : canDecide
          ? user.name
          : "Assigned owners"),
    due: workItem?.dueDate ?? release.requestedAt,
    reason:
      blockers[0]?.label ??
      (decided
        ? "Decision recorded; outcome visible to the institution"
        : "All mandatory prerequisites are met"),
    evidence: `${doneCount}/${release.checklist.length} checklist · ${clearedCount}/${release.clearances.length} clearances`,
  };

  const handleClearance = (values: ActionDialogValues) => {
    if (!clearanceAction) return;
    const result = recordClearance(
      release.id,
      clearanceAction.id,
      clearanceAction.status,
      values.reason,
      false,
    );
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  };

  const simulateClearance = (clearanceId: string, bureau: string) => {
    const result = recordClearance(
      release.id,
      clearanceId,
      "CLEARED",
      `SIMULATED demo response for ${bureau}. No bureau was contacted; this is not a real clearance.`,
      true,
    );
    if (result.ok) toast.success(result.message, { duration: 5000 });
    else toast.error(result.message);
  };

  const handleDecision = (values: ActionDialogValues) => {
    if (!decisionOutcome) return;
    const result = decideRelease(release.id, decisionOutcome, values.reason, values.conditions);
    if (result.ok) toast.success(result.message, { duration: 7000 });
    else toast.error(result.message);
  };

  return (
    <AppShell>
      <Link
        to="/release"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Release workspace
      </Link>

      <PageHeader
        eyebrow={`${institution?.name ?? "Institution"} · ${institution?.permanentId ?? ""}`}
        title={`Release case ${release.id}`}
        sub={`${instrument?.fdrNo ?? "Instrument"} · ${instrument ? INR(instrument.amount) : "—"} · requested ${fmtDate(release.requestedAt)} by ${release.requestedBy}`}
        action={
          <>
            <StatusPill status={release.status} />
            {instrument && <StatusPill status={instrument.instrumentStatus} />}
            {instrument && (
              <Button asChild variant="outline" size="sm">
                <Link to="/registry/$id" params={{ id: instrument.id }}>
                  Instrument case <ArrowUpRight className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </>
        }
      />

      {isReadOnly(user) && <ReadOnlyBanner />}
      {locked && (
        <div className="mb-4 flex items-start gap-2 rounded-md border tone-info px-4 py-2.5 text-xs">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This release case is locked because a decision is recorded. Evidence and audit remain
            readable; no checklist or clearance may be changed.
          </p>
        </div>
      )}

      <NextActionStrip action={nextAction} />

      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <Panel title="Release context" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            <MiniFact label="Institution" value={institution?.name ?? "—"} />
            <MiniFact label="Permanent ID" value={institution?.permanentId ?? "—"} mono />
            <MiniFact label="Instrument" value={instrument?.fdrNo ?? "—"} mono />
            <MiniFact label="Amount" value={instrument ? INR(instrument.amount) : "—"} />
            <MiniFact label="Issue date" value={instrument ? fmtDate(instrument.issueDate) : "—"} />
            <MiniFact
              label="Bank maturity"
              value={instrument ? fmtDate(instrument.maturityDate) : "—"}
            />
            <MiniFact
              label="Regulatory hold ends"
              value={
                instrument?.holdEndDate ? (
                  fmtDate(instrument.holdEndDate)
                ) : (
                  <span className="rounded tone-warning px-1.5 py-0.5 text-[10px] font-medium">
                    Not confirmed
                  </span>
                )
              }
            />
            <MiniFact
              label="Obligation"
              value={
                obligation ? (
                  <span className="flex items-center gap-1">
                    <StatusPill status={obligation.status} />
                  </span>
                ) : (
                  "—"
                )
              }
            />
          </div>
          <p className="mt-3 rounded-md border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
            {release.reason}
          </p>
        </Panel>

        <Panel title="Progress">
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Checklist</span>
                <span className="font-medium tabular-nums">
                  {doneCount}/{release.checklist.length}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{
                    width: `${release.checklist.length ? (doneCount / release.checklist.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Clearances</span>
                <span className="font-medium tabular-nums">
                  {clearedCount}/{release.clearances.length}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${release.clearances.length ? (clearedCount / release.clearances.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {blockers.length === 0
                ? "All mandatory prerequisites complete. Decision remains a human action."
                : `${blockers.length} blocker${blockers.length === 1 ? "" : "s"} remain before the decision gate.`}
            </p>
          </div>
        </Panel>

        <Panel title="Review owner">
          {workItem ? (
            <div className="space-y-2 text-[11px]">
              <p className="text-xs font-medium">{workItem.title}</p>
              <p className="text-muted-foreground">Owner: {workItem.assigneeName}</p>
              <p className="text-muted-foreground">
                Due: {fmtDate(workItem.dueDate)} · {workItem.priority}
              </p>
              <div className="flex gap-1.5">
                <StatusPill status={workItem.priority} />
                <StatusPill status={workItem.status} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {decided
                ? "Decision recorded. No open work item remains for this case."
                : "No open work item is assigned. A work item is created when the case reaches the decision gate."}
            </p>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel
          title="Required checklist"
          description="Evidence placeholders and confirmation state. Every item is audited."
        >
          <ul className="space-y-1">
            {release.checklist.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!canEditChecklist || locked || !item.required}
                  onClick={() => {
                    const result = toggleChecklistItem(release.id, item.id);
                    if (result.ok) toast.success(result.message);
                    else toast.error(result.message);
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition",
                    canEditChecklist && !locked && item.required
                      ? "hover:bg-muted/60"
                      : "cursor-default",
                  )}
                >
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <Circle
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        item.required ? "text-warning" : "text-muted-foreground",
                      )}
                    />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-xs", item.done ? "" : "font-medium")}>
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {item.required ? "Required" : "Optional"}
                      {item.evidence ? ` · ${item.evidence}` : " · No evidence recorded"}
                      {item.updatedAt ? ` · updated ${fmtDateTime(item.updatedAt)}` : ""}
                    </span>
                  </span>
                  {!item.required && (
                    <span className="rounded tone-neutral px-1.5 py-0.5 text-[9px] font-medium">
                      Optional
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {!canEditChecklist && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Only institution administrators, case officers and administrators can update checklist
              evidence. Clearance reviewers record bureau clearances only.
            </p>
          )}
        </Panel>

        <Panel
          title="Bureau clearance matrix"
          description="Required clearances block the decision gate. Simulated responses are labelled and never treated as real."
        >
          <div className="space-y-2">
            {release.clearances.map((clearance) => {
              const actionable =
                canClear &&
                !locked &&
                clearance.status !== "CLEARED" &&
                clearance.status !== "NOT_APPLICABLE";
              return (
                <div key={clearance.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs font-medium">
                        {clearance.bureau}
                        {clearance.required ? (
                          <span className="rounded tone-warning px-1.5 py-0.5 text-[9px] font-semibold uppercase">
                            Required
                          </span>
                        ) : (
                          <span className="rounded tone-neutral px-1.5 py-0.5 text-[9px] font-medium uppercase">
                            Optional
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{clearance.note}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {clearance.reviewer
                          ? `${clearance.reviewer}${clearance.reviewerRole ? ` · ${clearance.reviewerRole.replace(/_/g, " ")}` : ""}`
                          : "No reviewer recorded"}
                        {clearance.updatedAt ? ` · ${fmtDateTime(clearance.updatedAt)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusPill status={clearance.status} />
                      {clearance.simulationFlag && <DemoBadge label="SIMULATED" />}
                    </div>
                  </div>

                  {actionable && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setClearanceAction({ id: clearance.id, status: "CLEARED" })}
                      >
                        <Check className="h-3.5 w-3.5" /> Clear
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setClearanceAction({ id: clearance.id, status: "OBJECTED" })}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Object
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setClearanceAction({ id: clearance.id, status: "NOT_APPLICABLE" })
                        }
                      >
                        Not applicable
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => simulateClearance(clearance.id, clearance.bureau)}
                      >
                        Simulate response
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Clearance actions are recorded by {CLEARANCE_ROLES}. Simulated responses use the demo
            adapter and are flagged in the audit trail.
          </p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Panel
          title="Decision gate"
          description="Delegated authority is mandatory. Satisfying the checklist does not approve anything."
        >
          {release.decision ? (
            <div
              className={`rounded-md border p-4 ${release.decision.outcome === "APPROVED" ? "tone-success" : "tone-danger"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {release.decision.outcome === "APPROVED" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {release.decision.outcome}
                </p>
                <StatusPill status={release.status} />
              </div>
              <p className="mt-2 text-xs">{release.decision.rationale}</p>
              {release.decision.conditions && (
                <p className="mt-1 text-[11px]">Conditions: {release.decision.conditions}</p>
              )}
              <p className="mt-2 text-[11px] font-medium">
                {release.decision.authorityName} · {fmtDateTime(release.decision.decidedAt)}
              </p>
              <div className="mt-3 rounded border border-dashed p-2.5 text-[11px] font-semibold uppercase tracking-wide">
                {release.decision.outcome === "APPROVED"
                  ? release.decision.instrumentRoute === "SANCTION_ORDER"
                    ? "PROPOSED sanction-order record — not an issued sanction order"
                    : release.decision.instrumentRoute === "NOC_RECORD"
                      ? "PROPOSED NOC record — not an issued NOC"
                      : "No instrument route recorded"
                  : "Release rejected — no NOC or sanction record proposed"}
              </div>
            </div>
          ) : !ready ? (
            <div className="rounded-md border tone-warning p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <LockKeyhole className="h-4 w-4" /> Decision locked
              </p>
              <p className="mt-1 text-xs">
                {blockers.length} mandatory prerequisite{blockers.length === 1 ? "" : "s"} must be
                resolved. The panel will unlock only when every blocker is cleared.
              </p>
            </div>
          ) : !canDecide ? (
            <div className="rounded-md border tone-info p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Gavel className="h-4 w-4" /> All prerequisites complete
              </p>
              <p className="mt-1 text-xs">
                This case is ready for the delegated competent authority. Your role can prepare and
                inspect evidence but cannot record the decision.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border tone-success p-3 text-xs">
                <p className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> Ready for delegated decision
                </p>
                <p className="mt-1 text-muted-foreground">
                  You are acting as {user.name} (competent authority). The outcome and proposed
                  instrument record will be written to the append-only audit trail.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setDecisionOutcome("APPROVED")}>
                  <Gavel className="h-4 w-4" /> Record approval
                </Button>
                <Button variant="outline" onClick={() => setDecisionOutcome("REJECTED")}>
                  Record rejection
                </Button>
              </div>
            </div>
          )}
          {!release.decision && (
            <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> The decision does not move money, issue an
              NOC, or bypass any bureau. Only an audited outcome record is created.
            </p>
          )}
        </Panel>

        <Panel
          title="Blockers and owners"
          description="Each unmet prerequisite names the responsible role. This is the release gate."
        >
          {blockers.length === 0 ? (
            <div className="rounded-md border tone-success p-3 text-xs">
              <p className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" /> No blockers
              </p>
              <p className="mt-1 text-muted-foreground">
                All required checklist items and bureau clearances are satisfied.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {blockers.map((blocker) => (
                <li
                  key={blocker.label}
                  className="flex items-start gap-2 rounded-md border tone-warning p-2.5 text-[11px]"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div>
                    <p className="font-medium">{blocker.label}</p>
                    <p className="text-muted-foreground">Owner: {blocker.owner}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 space-y-1 text-[10px] text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Decision SLA:{" "}
              {workItem ? fmtDate(workItem.dueDate) : "not assigned"}
            </p>
            <p className="flex items-center gap-1.5">
              <FileCheck2 className="h-3 w-3" /> Evidence is versioned and never overwritten.
            </p>
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Release audit trail"
        description="Append-only events for this release, its clearances and the decision."
      >
        {audit.length === 0 ? (
          <p className="text-xs text-muted-foreground">No audit events recorded for this case.</p>
        ) : (
          <ol className="relative space-y-4 border-l pl-5">
            {audit.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium">{event.action}</p>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {event.entityType}
                  </span>
                  {event.source === "SIMULATED_ADAPTER" && <DemoBadge label="SIMULATED" />}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {fmtDateTime(event.at)} · {event.actorName} · {event.actorRole.replace(/_/g, " ")}{" "}
                  · <span className="font-mono">{event.correlationId}</span>
                </p>
                {event.reason && <p className="mt-1 text-[11px]">{event.reason}</p>}
                {(event.before || event.after) && (
                  <div className="mt-1 flex flex-wrap gap-1.5 font-mono text-[10px]">
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
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <History className="h-3.5 w-3.5" /> Events cannot be edited or deleted in the application.
        </div>
      </Panel>

      <div className="mt-4">
        <GuardrailNote>
          This workspace records a proposed outcome only. It does not instruct a bank, issue a NOC
          or sanction order, or move money. Authorized discharge requires the competent authority's
          signed process outside this prototype.
        </GuardrailNote>
      </div>

      <ActionDialog
        open={clearanceAction !== null}
        onOpenChange={(open) => {
          if (!open) setClearanceAction(null);
        }}
        title={
          clearanceAction
            ? `${clearanceAction.status === "CLEARED" ? "Record clearance" : clearanceAction.status === "OBJECTED" ? "Record objection" : "Mark not applicable"}`
            : "Record clearance"
        }
        description="The note, reviewer identity and timestamp are written to the append-only audit trail."
        confirmLabel="Record clearance outcome"
        reasonLabel="Clearance note / evidence reference"
        destructive={clearanceAction?.status === "OBJECTED"}
        onConfirm={handleClearance}
      />

      <ActionDialog
        open={decisionOutcome !== null}
        onOpenChange={(open) => {
          if (!open) setDecisionOutcome(null);
        }}
        title={
          decisionOutcome === "APPROVED" ? "Record release approval" : "Record release rejection"
        }
        description="A rationale is mandatory. The outcome is recorded as a proposed decision record and is visible to the institution."
        confirmLabel={decisionOutcome === "APPROVED" ? "Record approval" : "Record rejection"}
        destructive={decisionOutcome === "REJECTED"}
        reasonLabel="Decision rationale"
        showConditions
        conditionsLabel="Conditions / remarks (optional)"
        onConfirm={handleDecision}
      />
    </AppShell>
  );
}
