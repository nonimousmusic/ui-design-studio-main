import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, FilePlus2, MapPin, ShieldCheck } from "lucide-react";
import {
  AppShell,
  EmptyState,
  MiniFact,
  PageHeader,
  Panel,
  ProvenanceTag,
  ReadOnlyBanner,
  ScopeDenied,
  StatCard,
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
  visibleReleases,
} from "@/lib/selectors";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/institutions/$id")({
  head: () => ({
    meta: [
      { title: "Institution detail · AICTE Smart FDR Portal" },
      { name: "description", content: "Institution obligations, instruments and audit case file." },
    ],
  }),
  component: InstitutionDetail,
});

function InstitutionDetail() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const { state } = usePortal();
  if (!user) return null;

  const institution = state.institutions.find((entry) => entry.id === id);
  if (!institution) {
    return (
      <AppShell>
        <EmptyState
          title="Institution not found"
          hint="The record may have been removed from the demo store."
          icon={Building2}
        />
      </AppShell>
    );
  }
  if (!canSeeInstitution(user, institution.id)) {
    return (
      <AppShell>
        <ScopeDenied message="This institution belongs to another tenant. Cross-institution access is denied in the UI and must be denied by RLS in production." />
      </AppShell>
    );
  }

  const obligations = state.obligations.filter(
    (obligation) => obligation.institutionId === institution.id,
  );
  const instruments = state.instruments.filter(
    (instrument) => instrument.institutionId === institution.id,
  );
  const releases = visibleReleases(state, user).filter(
    (release) => release.institutionId === institution.id,
  );
  const audit = visibleAudit(state, user)
    .filter((event) => event.institutionId === institution.id)
    .slice(0, 12);
  const openFindings = state.findings.filter(
    (finding) =>
      finding.status === "OPEN" &&
      instruments.some((instrument) => instrument.id === finding.instrumentId),
  );
  const held = instruments.filter((instrument) =>
    ["ACTIVE", "APPROACHING_MATURITY", "MATURED"].includes(instrument.instrumentStatus),
  );
  const heldValue = held.reduce((sum, instrument) => sum + instrument.amount, 0);

  return (
    <AppShell>
      <Link
        to="/institutions"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Institutions
      </Link>

      <PageHeader
        eyebrow={`${institution.region} region · ${institution.type}`}
        title={institution.name}
        sub={`AICTE Permanent ID ${institution.permanentId} · verified since ${fmtDate(institution.approvedSince)}`}
        action={
          <>
            <StatusPill status={institution.status} />
            <Button asChild variant="outline">
              <Link to="/registry" search={{ q: institution.permanentId }}>
                View registry
              </Link>
            </Button>
            {can(user, "create_submission") && (
              <Button asChild>
                <Link to="/submissions/new">
                  <FilePlus2 className="h-4 w-4" /> New submission
                </Link>
              </Button>
            )}
          </>
        }
      />

      {isReadOnly(user) && <ReadOnlyBanner />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Obligations"
          value={String(obligations.length)}
          hint={
            obligations.map((obligation) => obligation.purpose.split("—")[0]).join(" · ") || "None"
          }
        />
        <StatCard
          label="Deposits held"
          value={INR(heldValue)}
          hint={`${held.length} monitored instruments`}
        />
        <StatCard
          label="Open findings"
          value={String(openFindings.length)}
          hint={openFindings[0]?.code ?? "No open discrepancies"}
          tone={openFindings.length ? "danger" : "success"}
        />
        <StatCard
          label="Release cases"
          value={String(releases.length)}
          hint={releases.filter((release) => release.decision).length + " decided"}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel title="Institution profile" className="xl:col-span-1">
          <div className="grid grid-cols-2 gap-4">
            <MiniFact label="Permanent ID" value={institution.permanentId} mono />
            <MiniFact label="Region" value={institution.region} />
            <MiniFact label="Type" value={institution.type} />
            <MiniFact label="Status" value={<StatusPill status={institution.status} />} />
            <MiniFact
              label="Location"
              value={
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {institution.city},{" "}
                  {institution.state}
                </span>
              }
            />
            <MiniFact label="Approved since" value={fmtDate(institution.approvedSince)} />
            <MiniFact label="Owner" value={institution.ownerName} />
            <MiniFact label="Contact" value={institution.ownerEmail} />
          </div>
          <div className="mt-4 rounded-md border bg-muted/40 p-3 text-[11px] text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> Tenant boundary
            </p>
            <p className="mt-1">
              Institution staff can only read this record. AICTE officials see it within their
              assigned scope. Production enforcement lives in server authorization and RLS.
            </p>
          </div>
        </Panel>

        <Panel
          title="Deposit obligations"
          className="xl:col-span-2"
          description="Obligation first, instrument second. Holds and maturities are independent."
        >
          {obligations.length === 0 ? (
            <EmptyState
              title="No obligations"
              hint="Create a submission to establish an obligation."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="pb-2 pr-3 font-medium">Purpose / policy</th>
                    <th className="pb-2 pr-3 font-medium">Amount</th>
                    <th className="pb-2 pr-3 font-medium">Hold ends</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 font-medium">Instruments</th>
                  </tr>
                </thead>
                <tbody>
                  {obligations.map((obligation) => {
                    const policy = state.policies.find(
                      (entry) => entry.id === obligation.policyVersionId,
                    );
                    const own = instruments.filter(
                      (instrument) => instrument.obligationId === obligation.id,
                    );
                    return (
                      <tr key={obligation.id} className="border-t align-top">
                        <td className="py-3 pr-3">
                          <p className="text-xs font-medium">{obligation.purpose}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {policy?.label ?? "Policy"} · {obligation.requirementStatus}
                          </p>
                        </td>
                        <td className="py-3 pr-3 text-xs tabular-nums">{INR(obligation.amount)}</td>
                        <td className="py-3 pr-3 text-xs">
                          {obligation.holdEndDate ? (
                            fmtDate(obligation.holdEndDate)
                          ) : (
                            <span className="tone-warning rounded px-1.5 py-0.5 text-[10px] font-medium">
                              Not confirmed
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <StatusPill status={obligation.status} />
                        </td>
                        <td className="py-3 text-xs">
                          {own.length === 0 ? (
                            <span className="text-muted-foreground">None</span>
                          ) : (
                            <div className="space-y-1">
                              {own.map((instrument) => (
                                <Link
                                  key={instrument.id}
                                  to="/registry/$id"
                                  params={{ id: instrument.id }}
                                  className="block font-mono text-[10px] text-primary hover:underline"
                                >
                                  {instrument.fdrNo}
                                </Link>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Instrument history"
        className="mt-4"
        description="Accepted records remain immutable; replacements are linked rather than overwritten."
      >
        {instruments.length === 0 ? (
          <EmptyState title="No instruments" hint="Submit an FDR to support an obligation." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  {[
                    "Reference",
                    "Bank",
                    "Amount",
                    "Issue",
                    "Maturity",
                    "Hold ends",
                    "Provenance",
                    "Submission",
                  ].map((heading) => (
                    <th key={heading} className="px-3 py-2.5 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {instruments.map((instrument) => (
                  <tr key={instrument.id} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-3">
                      <Link
                        to="/registry/$id"
                        params={{ id: instrument.id }}
                        className="font-mono text-xs hover:underline"
                      >
                        {instrument.fdrNo}
                      </Link>
                      <p className="text-[10px] text-muted-foreground">{instrument.type}</p>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {instrument.bank}
                      <p className="text-[10px] text-muted-foreground">{instrument.branch}</p>
                    </td>
                    <td className="px-3 py-3 text-xs tabular-nums">{INR(instrument.amount)}</td>
                    <td className="px-3 py-3 text-xs">{fmtDate(instrument.issueDate)}</td>
                    <td className="px-3 py-3 text-xs">{fmtDate(instrument.maturityDate)}</td>
                    <td className="px-3 py-3 text-xs">
                      {instrument.holdEndDate ? fmtDate(instrument.holdEndDate) : "Unknown"}
                    </td>
                    <td className="px-3 py-3">
                      <ProvenanceTag provenance={instrument.provenance} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={instrument.submissionStatus} />
                      <p className="mt-1">
                        <StatusPill status={instrument.instrumentStatus} />
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Release cases">
          {releases.length === 0 ? (
            <p className="text-xs text-muted-foreground">No release cases for this institution.</p>
          ) : (
            <ul className="space-y-3">
              {releases.map((release) => {
                const blockers = releaseBlockers(state, release);
                return (
                  <li key={release.id}>
                    <Link
                      to="/release/$id"
                      params={{ id: release.id }}
                      className="block rounded-md border p-3 transition hover:border-primary/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs">{release.id}</span>
                        <StatusPill status={release.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Requested {fmtDate(release.requestedAt)} ·{" "}
                        {release.checklist.filter((item) => item.done).length}/
                        {release.checklist.length} checklist · {blockers.length} blockers
                      </p>
                      {release.decision && (
                        <p className="mt-1 text-[11px] font-medium">
                          {release.decision.outcome} by {release.decision.authorityName} on{" "}
                          {fmtDateTime(release.decision.decidedAt)}
                        </p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Recent audit events" description="Scope-filtered, append-only history.">
          {audit.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events in scope.</p>
          ) : (
            <ol className="relative space-y-3 border-l pl-4">
              {audit.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <p className="text-xs font-medium">{event.action}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {fmtDateTime(event.at)} · {event.actorName} (
                    {event.actorRole.replace(/_/g, " ")})
                  </p>
                  {event.reason && (
                    <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                      {event.reason}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
