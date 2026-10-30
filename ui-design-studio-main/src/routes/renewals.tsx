import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  GitCompareArrows,
  History,
  Link2,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  AppShell,
  EmptyState,
  PageHeader,
  Panel,
  ProvenanceTag,
  StatCard,
  StatusPill,
} from "@/components/portal";
import { Button } from "@/components/ui/button";
import { daysBetween, daysFromToday, DEMO_TODAY, fmtDate, INR, relativeDays } from "@/lib/format";
import { can, visibleInstitutions, visibleInstruments } from "@/lib/selectors";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";
import type { DepositInstrument, ReleaseCase } from "@/lib/types";

export const Route = createFileRoute("/renewals")({
  head: () => ({
    meta: [
      { title: "Renewals & replacements · AICTE Smart FDR Portal" },
      {
        name: "description",
        content:
          "Replacement chains, immutable prior records, coverage-gap detection and pending renewal scrutiny.",
      },
    ],
  }),
  component: RenewalsPage,
});

const isOpenRelease = (release: ReleaseCase): boolean =>
  !["APPROVED", "REJECTED", "CLOSED"].includes(release.status);

function RenewalsPage() {
  const { user } = useSession();
  const { state } = usePortal();

  if (!user) return null;

  const instruments = visibleInstruments(state, user);
  const institutions = visibleInstitutions(state, user);
  const obligationIds = [...new Set(instruments.map((instrument) => instrument.obligationId))];
  const obligations = state.obligations
    .filter((obligation) => obligationIds.includes(obligation.id))
    .sort((a, b) => a.purpose.localeCompare(b.purpose));

  const chains = instruments.filter(
    (instrument) => instrument.previousInstrumentId || instrument.replacementInstrumentId,
  );
  const pending = instruments.filter(
    (instrument) =>
      instrument.previousInstrumentId &&
      ["SUBMITTED", "UNDER_SCRUTINY"].includes(instrument.submissionStatus),
  );
  const candidates = instruments.filter(
    (instrument) =>
      !instrument.replacementInstrumentId &&
      instrument.instrumentStatus !== "SUPERSEDED" &&
      instrument.instrumentStatus !== "RELEASED" &&
      daysFromToday(instrument.maturityDate) <= 365,
  );
  const gaps: { previous: DepositInstrument; next: DepositInstrument; days: number }[] = [];
  for (const instrument of instruments) {
    if (!instrument.previousInstrumentId) continue;
    const previous = state.instruments.find(
      (entry) => entry.id === instrument.previousInstrumentId,
    );
    if (!previous) continue;
    const gap = daysBetween(previous.maturityDate, instrument.issueDate);
    if (gap > 0) gaps.push({ previous, next: instrument, days: gap });
  }

  const canFile = can(user, "create_submission");
  const canReview = can(user, "scrutinise");

  return (
    <AppShell>
      <PageHeader
        eyebrow="Workspace"
        title="Renewals & replacements"
        sub="Prior instruments remain immutable. Replacements are linked and reviewed; a matured FDR never silently disappears."
        action={
          canFile ? (
            <Button asChild>
              <Link to="/submissions/new">
                <Plus className="h-4 w-4" /> New submission
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to="/registry">
                <History className="h-4 w-4" /> Open registry
              </Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Linked chains"
          value={String(new Set(chains.map((instrument) => instrument.obligationId)).size)}
          hint={`${chains.length} instruments participate`}
          icon={GitCompareArrows}
        />
        <StatCard
          label="Pending replacement review"
          value={String(pending.length)}
          hint="Old record unchanged until accepted"
          tone={pending.length ? "warning" : "success"}
          icon={RefreshCw}
        />
        <StatCard
          label="Coverage gaps"
          value={String(gaps.length)}
          hint="New issue date after prior maturity"
          tone={gaps.length ? "danger" : "success"}
          icon={AlertTriangle}
        />
        <StatCard
          label="Renewal candidates"
          value={String(candidates.length)}
          hint="Maturity within 365 days, no replacement"
          tone={candidates.length ? "warning" : "success"}
          icon={CalendarClock}
        />
      </div>

      {gaps.length > 0 && (
        <div className="mt-4 rounded-md border tone-danger p-4 text-xs">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Coverage gap detected
          </p>
          <ul className="mt-2 space-y-1">
            {gaps.map((gap) => (
              <li key={gap.next.id}>
                {gap.next.fdrNo} was issued {gap.days} day{gap.days === 1 ? "" : "s"} after{" "}
                {gap.previous.fdrNo} matured on {fmtDate(gap.previous.maturityDate)}. The deposit
                may have been unsecured in that interval; record a reviewer explanation.
              </li>
            ))}
          </ul>
        </div>
      )}

      {pending.length > 0 && (
        <Panel
          className="mt-4"
          title="Pending replacement scrutiny"
          description="A replacement is evidence under review. It does not supersede the prior record until accepted."
        >
          <div className="space-y-3">
            {pending.map((instrument) => {
              const previous = state.instruments.find(
                (entry) => entry.id === instrument.previousInstrumentId,
              );
              const institution = institutions.find(
                (entry) => entry.id === instrument.institutionId,
              );
              const findings = state.findings.filter(
                (finding) => finding.instrumentId === instrument.id && finding.status === "OPEN",
              );
              return (
                <div key={instrument.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs">{instrument.fdrNo}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {institution?.name} · replaces {previous?.fdrNo ?? "unknown"} ·{" "}
                        {fmtDate(instrument.issueDate)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusPill status={instrument.submissionStatus} />
                      <StatusPill status={instrument.verificationStatus} />
                      {findings.length > 0 && (
                        <span className="rounded-full tone-warning px-2 py-0.5 text-[10px] font-medium">
                          {findings.length} finding{findings.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                    <p>Amount: {INR(instrument.amount)}</p>
                    <p>Maturity: {fmtDate(instrument.maturityDate)}</p>
                    <p>
                      Hold ends:{" "}
                      {instrument.holdEndDate ? fmtDate(instrument.holdEndDate) : "Unknown"}
                    </p>
                    <p>Officer: {instrument.officer}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/registry/$id" params={{ id: instrument.id }}>
                        {canReview ? "Open scrutiny case" : "Open case"}{" "}
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </Button>
                    {previous && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/registry/$id" params={{ id: previous.id }}>
                          View prior record
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <div className="mt-4 space-y-4">
        {obligations.length === 0 ? (
          <EmptyState
            title="No obligations in scope"
            hint="Create a deposit obligation and submit an instrument to start a renewal chain."
            action={
              canFile ? (
                <Button asChild size="sm">
                  <Link to="/submissions/new">Create a submission</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          obligations.map((obligation) => {
            const institution = institutions.find((entry) => entry.id === obligation.institutionId);
            const policy = state.policies.find((entry) => entry.id === obligation.policyVersionId);
            const own = instruments
              .filter((instrument) => instrument.obligationId === obligation.id)
              .sort((a, b) => a.issueDate.localeCompare(b.issueDate));
            return (
              <Panel
                key={obligation.id}
                title={`${institution?.name ?? "Institution"} · ${obligation.purpose}`}
                description={`${policy?.label ?? obligation.policyVersionId} · ${INR(obligation.amount)} · hold ${
                  obligation.holdEndDate ? fmtDate(obligation.holdEndDate) : "not confirmed"
                }`}
                action={<StatusPill status={obligation.status} />}
              >
                {own.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No instruments recorded.</p>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {own.map((instrument) => {
                      const previous = instrument.previousInstrumentId
                        ? own.find((entry) => entry.id === instrument.previousInstrumentId)
                        : undefined;
                      const next = instrument.replacementInstrumentId
                        ? own.find((entry) => entry.id === instrument.replacementInstrumentId)
                        : undefined;
                      const gap =
                        previous && daysBetween(previous.maturityDate, instrument.issueDate) > 0
                          ? daysBetween(previous.maturityDate, instrument.issueDate)
                          : 0;
                      const immutable = Boolean(
                        next || ["SUPERSEDED", "RELEASED"].includes(instrument.instrumentStatus),
                      );
                      const hasOpenRelease = state.releases.some(
                        (release) =>
                          release.instrumentId === instrument.id && isOpenRelease(release),
                      );
                      return (
                        <div
                          key={instrument.id}
                          className={`rounded-md border p-3 ${immutable ? "bg-muted/20" : ""}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-1.5">
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-medium">{instrument.fdrNo}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {instrument.type} · issue {fmtDate(instrument.issueDate)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <StatusPill status={instrument.submissionStatus} />
                              <StatusPill status={instrument.instrumentStatus} />
                            </div>
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                            <p>
                              <span className="text-muted-foreground">Amount </span>
                              {INR(instrument.amount)}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Maturity </span>
                              {fmtDate(instrument.maturityDate)}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Hold </span>
                              {instrument.holdEndDate ? fmtDate(instrument.holdEndDate) : "unknown"}
                            </p>
                            <p>
                              <span className="text-muted-foreground">Days </span>
                              {relativeDays(instrument.maturityDate)}
                            </p>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <ProvenanceTag provenance={instrument.provenance} />
                            {immutable && (
                              <span className="inline-flex items-center gap-1 rounded tone-neutral px-1.5 py-0.5 text-[10px] font-medium">
                                <ShieldCheck className="h-3 w-3" /> Immutable record
                              </span>
                            )}
                            {next && (
                              <span className="inline-flex items-center gap-1 rounded tone-info px-1.5 py-0.5 text-[10px] font-medium">
                                <Link2 className="h-3 w-3" /> Linked replacement
                              </span>
                            )}
                            {!next &&
                              !previous &&
                              instrument.submissionStatus === "ACCEPTED" &&
                              instrument.instrumentStatus !== "RELEASED" && (
                                <span className="rounded tone-warning px-1.5 py-0.5 text-[10px] font-medium">
                                  No replacement linked
                                </span>
                              )}
                          </div>

                          {previous && (
                            <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                              <GitCompareArrows className="h-3 w-3" /> Replaces {previous.fdrNo}
                            </p>
                          )}
                          {gap > 0 && (
                            <p className="mt-1 text-[10px] font-medium text-destructive">
                              Coverage gap: issued {gap} days after prior maturity.
                            </p>
                          )}
                          {hasOpenRelease && (
                            <p className="mt-1 flex items-center gap-1 text-[10px] text-warning">
                              <CheckCircle2 className="h-3 w-3" /> Open release case in progress.
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            <Button asChild size="sm" variant="outline">
                              <Link to="/registry/$id" params={{ id: instrument.id }}>
                                Open case
                              </Link>
                            </Button>
                            {canFile &&
                              instrument.submissionStatus === "ACCEPTED" &&
                              !instrument.replacementInstrumentId &&
                              instrument.instrumentStatus !== "RELEASED" && (
                                <Button asChild size="sm" variant="ghost">
                                  <Link to="/submissions/new" search={{ replaces: instrument.id }}>
                                    <GitCompareArrows className="h-3.5 w-3.5" /> File replacement
                                  </Link>
                                </Button>
                              )}
                            {next && (
                              <Button asChild size="sm" variant="ghost">
                                <Link to="/registry/$id" params={{ id: next.id }}>
                                  View replacement
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
            );
          })
        )}
      </div>

      {candidates.length > 0 && (
        <Panel
          className="mt-4"
          title="Renewal candidates"
          description="Maturity inside 365 days and no linked replacement. Bank maturity is not a release event."
        >
          <ul className="space-y-2">
            {candidates.map((instrument) => {
              const institution = institutions.find(
                (entry) => entry.id === instrument.institutionId,
              );
              return (
                <li
                  key={instrument.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div>
                    <Link
                      to="/registry/$id"
                      params={{ id: instrument.id }}
                      className="font-mono text-xs font-medium hover:underline"
                    >
                      {instrument.fdrNo}
                    </Link>
                    <p className="text-[10px] text-muted-foreground">
                      {institution?.name} · matures {fmtDate(instrument.maturityDate)} ·{" "}
                      {relativeDays(instrument.maturityDate)} · hold{" "}
                      {instrument.holdEndDate ? fmtDate(instrument.holdEndDate) : "unconfirmed"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={instrument.instrumentStatus} />
                    {canFile && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/submissions/new" search={{ replaces: instrument.id }}>
                          File replacement
                        </Link>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" /> Demo clock {fmtDate(DEMO_TODAY)}. Replacement never
        overwrites the prior instrument, its documents, or its audit history.
      </p>
    </AppShell>
  );
}
