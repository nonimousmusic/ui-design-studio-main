import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Gauge,
  Landmark,
  Scale,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  AppShell,
  EmptyState,
  PageHeader,
  Panel,
  ReadOnlyBanner,
  ScopeDenied,
  StatCard,
  StatusPill,
} from "@/components/portal";
import { MaturityBarChart, PortfolioBarChart, StatusDonut } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { DEMO_TODAY, downloadCsv, fmtDate, INR, INRshort } from "@/lib/format";
import {
  can,
  holdingsByRegion,
  isReadOnly,
  kpis,
  maturityBuckets,
  statusMix,
  visibleAlerts,
  visibleInstitutions,
  visibleInstruments,
  visibleReleases,
  visibleWorkItems,
} from "@/lib/selectors";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & metrics · AICTE Smart FDR Portal" },
      {
        name: "description",
        content:
          "Scoped portfolio reports: holdings by region, maturity buckets, status mix, release outcomes and a reproducible metric sheet.",
      },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { user } = useSession();
  const { state } = usePortal();

  if (!user) return null;
  if (!can(user, "view_reports")) {
    return (
      <AppShell>
        <ScopeDenied message="Portfolio reports are available to AICTE officials, administrators and auditors. Institution accounts have their own dashboard and registry." />
      </AppShell>
    );
  }

  const institutions = visibleInstitutions(state, user);
  const instruments = visibleInstruments(state, user);
  const releases = visibleReleases(state, user);
  const alerts = visibleAlerts(state, user);
  const workItems = visibleWorkItems(state, user);
  const numbers = kpis(state, user);
  const regionData = holdingsByRegion(state, user);
  const buckets = maturityBuckets(state, user);
  const submissionMix = statusMix(state, user);

  const instrumentIds = new Set(instruments.map((instrument) => instrument.id));
  const findings = state.findings.filter((finding) => instrumentIds.has(finding.instrumentId));
  const openFindings = findings.filter((finding) => finding.status === "OPEN");
  const documents = state.documents.filter((document) => instrumentIds.has(document.instrumentId));
  const auditEvents = state.audit.filter(
    (event) =>
      event.institutionId &&
      institutions.some((institution) => institution.id === event.institutionId),
  );

  const releaseOutcomes = [
    "SUBMITTED",
    "CLEARANCES_PENDING",
    "DECISION_PENDING",
    "APPROVED",
    "REJECTED",
    "CLOSED",
  ]
    .map((status) => ({
      status,
      count: releases.filter((release) => release.status === status).length,
    }))
    .filter((entry) => entry.count > 0);

  const holdRecorded = instruments.filter((instrument) => instrument.holdEndDate).length;
  const holdUnknown = instruments.filter(
    (instrument) =>
      !instrument.holdEndDate && !["RELEASED", "SUPERSEDED"].includes(instrument.instrumentStatus),
  ).length;
  const decisionCount = releases.filter((release) => release.decision).length;
  const acknowledged = alerts.filter((alert) => alert.acknowledged).length;
  const openWork = workItems.filter((item) => item.status !== "DONE");

  const exportPortfolio = () => {
    downloadCsv("aicte-fdr-portfolio.csv", [
      [
        "Permanent ID",
        "Institution",
        "Region",
        "State",
        "Instruments",
        "Held value (INR)",
        "Open findings",
        "Open release cases",
      ],
      ...institutions.map((institution) => {
        const own = instruments.filter((instrument) => instrument.institutionId === institution.id);
        const held = own.filter((instrument) =>
          ["ACTIVE", "APPROACHING_MATURITY", "MATURED"].includes(instrument.instrumentStatus),
        );
        return [
          institution.permanentId,
          institution.name,
          institution.region,
          institution.state,
          held.length,
          held.reduce((sum, instrument) => sum + instrument.amount, 0),
          state.findings.filter(
            (finding) =>
              finding.status === "OPEN" &&
              own.some((instrument) => instrument.id === finding.instrumentId),
          ).length,
          releases.filter(
            (release) =>
              release.institutionId === institution.id &&
              !["APPROVED", "REJECTED", "CLOSED"].includes(release.status),
          ).length,
        ];
      }),
    ]);
  };

  const exportMetrics = () => {
    downloadCsv("aicte-fdr-metric-sheet.csv", [
      ["Metric", "Value", "Sample size", "Method"],
      [
        "Institutions in scope",
        institutions.length,
        institutions.length,
        "Scoped institution records",
      ],
      ["Instruments in scope", instruments.length, instruments.length, "Scoped instrument records"],
      [
        "Deposits held (INR)",
        numbers.totalHeld,
        instruments.length,
        "Sum of ACTIVE/APPROACHING/MATURED amounts",
      ],
      [
        "Awaiting scrutiny",
        numbers.awaitingScrutiny,
        instruments.length,
        "SUBMITTED or UNDER_SCRUTINY",
      ],
      ["Maturing within 60 days", numbers.maturing, instruments.length, "Demo clock 2026-10-30"],
      ["Open deterministic findings", openFindings.length, findings.length, "Status OPEN"],
      ["Instruments with hold end recorded", holdRecorded, instruments.length, "Non-null hold end"],
      [
        "Instruments with unknown hold end",
        holdUnknown,
        instruments.length,
        "Non-null, not released/superseded",
      ],
      ["Release cases in scope", releases.length, releases.length, "Scoped release records"],
      ["Release decisions recorded", decisionCount, releases.length, "Decision object present"],
      ["Alerts in scope", alerts.length, alerts.length, "Scoped alert records"],
      ["Alerts acknowledged", acknowledged, alerts.length, "Acknowledged = true"],
      ["Open work items", openWork.length, workItems.length, "Status != DONE"],
      ["Documents recorded", documents.length, documents.length, "Metadata records in scope"],
      [
        "Scope-filtered audit events",
        auditEvents.length,
        auditEvents.length,
        "Visible institution events",
      ],
    ]);
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Oversight · reporting"
        title="Reports & metrics"
        sub={`Scope-filtered figures as at ${fmtDate(DEMO_TODAY)}. Every number states its sample size; no estimate is presented as a measured outcome.`}
        action={
          <>
            <Button variant="outline" onClick={exportMetrics}>
              <FileSpreadsheet className="h-4 w-4" /> Metric sheet CSV
            </Button>
            <Button onClick={exportPortfolio}>
              <Download className="h-4 w-4" /> Portfolio CSV
            </Button>
          </>
        }
      />

      {isReadOnly(user) && <ReadOnlyBanner />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Deposits held"
          value={INRshort(numbers.totalHeld)}
          hint={`${instruments.length} instruments in scope`}
          icon={Landmark}
        />
        <StatCard
          label="Open findings"
          value={String(openFindings.length)}
          hint={`${findings.length} total findings`}
          tone={openFindings.length ? "danger" : "success"}
          icon={Gauge}
        />
        <StatCard
          label="Release decisions"
          value={String(decisionCount)}
          hint={`${releases.length} cases in scope`}
          icon={Scale}
        />
        <StatCard
          label="Alerts acknowledged"
          value={`${acknowledged}/${alerts.length}`}
          hint="Computed from demo fixtures"
          tone={alerts.length - acknowledged > 0 ? "warning" : "success"}
          icon={ShieldCheck}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Deposits held by region"
          description="Sum of active, approaching-maturity and matured instruments."
        >
          {regionData.length === 0 ? (
            <EmptyState title="No holdings" hint="No instruments in scope." />
          ) : (
            <PortfolioBarChart data={regionData} />
          )}
        </Panel>
        <Panel
          title="Maturity buckets"
          description="Bank maturity dates relative to the demo clock. A bucket is not an eligibility state."
        >
          <MaturityBarChart data={buckets} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Submission status mix"
          description="Deterministic case states, not risk scores."
        >
          {submissionMix.length === 0 ? (
            <EmptyState title="No submissions" hint="No instruments in scope." />
          ) : (
            <>
              <StatusDonut data={submissionMix} />
              <ul className="mt-2 space-y-1.5 text-xs">
                {submissionMix.map((entry) => (
                  <li key={entry.status} className="flex items-center justify-between gap-2">
                    <StatusPill status={entry.status} />
                    <span className="tabular-nums">{entry.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel
          title="Release outcomes"
          description="Approved means a proposed record, not an issued NOC or money movement."
        >
          {releaseOutcomes.length === 0 ? (
            <EmptyState
              title="No release cases"
              hint="No release activity in scope."
              icon={Scale}
            />
          ) : (
            <ul className="space-y-2">
              {releaseOutcomes.map((entry) => (
                <li
                  key={entry.status}
                  className="flex items-center justify-between gap-2 rounded-md border p-2.5"
                >
                  <StatusPill status={entry.status} />
                  <span className="text-sm font-semibold tabular-nums">{entry.count}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 rounded-md border bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> No outcome is automatic
            </p>
            <p className="mt-1">
              Every approved case carries a named decision authority, rationale, optional conditions
              and a proposed FDR/NOC or RTGS/sanction route.
            </p>
          </div>
        </Panel>

        <Panel title="Data quality & provenance" description="What the demo can honestly claim.">
          <ul className="space-y-2.5 text-xs">
            {[
              [
                "Hold end recorded",
                `${holdRecorded}/${instruments.length}`,
                holdRecorded === instruments.length,
              ],
              ["Hold end unknown", `${holdUnknown}/${instruments.length}`, holdUnknown === 0],
              [
                "Documents with checksum",
                `${documents.filter((document) => document.checksumSha256).length}/${documents.length}`,
                true,
              ],
              ["Open work items", `${openWork.length}/${workItems.length}`, openWork.length === 0],
              ["Scope-filtered audit events", String(auditEvents.length), true],
            ].map(([label, value, ok]) => (
              <li key={String(label)} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{label}</span>
                <span className={`font-mono text-[11px] ${ok ? "text-success" : "text-warning"}`}>
                  {value}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] text-muted-foreground">
            Synthetic fixtures only. No OCR, fraud score, credit score or bank verification is
            claimed.
          </p>
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Portfolio by institution"
        description="Scoped to your role. Export contains the same rows and no masked identifiers are re-expanded."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {[
                  "Institution",
                  "Region",
                  "Instruments",
                  "Held value",
                  "Open findings",
                  "Open releases",
                ].map((heading) => (
                  <th key={heading} className="px-3 py-2.5 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {institutions.map((institution) => {
                const own = instruments.filter(
                  (instrument) => instrument.institutionId === institution.id,
                );
                const held = own.filter((instrument) =>
                  ["ACTIVE", "APPROACHING_MATURITY", "MATURED"].includes(
                    instrument.instrumentStatus,
                  ),
                );
                const heldValue = held.reduce((sum, instrument) => sum + instrument.amount, 0);
                const findingCount = state.findings.filter(
                  (finding) =>
                    finding.status === "OPEN" &&
                    own.some((instrument) => instrument.id === finding.instrumentId),
                ).length;
                const openReleaseCount = releases.filter(
                  (release) =>
                    release.institutionId === institution.id &&
                    !["APPROVED", "REJECTED", "CLOSED"].includes(release.status),
                ).length;
                return (
                  <tr key={institution.id} className="border-t">
                    <td className="px-3 py-3">
                      <p className="text-xs font-medium">{institution.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {institution.permanentId}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs">{institution.region}</td>
                    <td className="px-3 py-3 text-xs tabular-nums">
                      {held.length}
                      {held.length !== own.length && (
                        <span className="text-[10px] text-muted-foreground">
                          {" "}
                          / {own.length} total
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs tabular-nums">{INR(heldValue)}</td>
                    <td className="px-3 py-3 text-xs">
                      <span
                        className={findingCount ? "font-medium text-destructive" : "text-success"}
                      >
                        {findingCount}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs tabular-nums">
                      <span
                        className={openReleaseCount ? "font-medium text-warning" : "text-success"}
                      >
                        {openReleaseCount}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        className="mt-4"
        title="Metric sheet"
        description="Reproducible definitions for the demo. The CSV export above contains the same values with sample size and method."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Total held", INR(numbers.totalHeld), `${instruments.length} instruments`],
            ["Awaiting scrutiny", String(numbers.awaitingScrutiny), "Submitted or under scrutiny"],
            ["Maturing ≤ 60 days", String(numbers.maturing), "Demo clock 30 Oct 2026"],
            ["Open findings", String(openFindings.length), `${findings.length} findings total`],
            ["Release cases", String(releases.length), `${decisionCount} decided`],
            ["Work items open", String(openWork.length), `${workItems.length} total`],
            ["Documents", String(documents.length), "Metadata and checksums only"],
            ["Alerts", String(alerts.length), `${acknowledged} acknowledged`],
            ["Audit events", String(auditEvents.length), "Visible institution events"],
          ].map(([label, value, hint]) => (
            <div key={label} className="rounded-md border p-3">
              <p className="text-[11px] text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-heading">{value}</p>
              <p className="text-[10px] text-muted-foreground">{hint}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-[11px] text-muted-foreground">
          <BarChart3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            No invented percentages are shown as outcomes. Ratios displayed here are computed
            directly from the current synthetic store and state their denominator. Production
            reporting will use server-side aggregates with row-level security and masked exports.
          </p>
        </div>
      </Panel>
    </AppShell>
  );
}
