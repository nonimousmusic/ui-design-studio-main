import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Download, FilePlus2, Search } from "lucide-react";
import {
  AppShell,
  EmptyState,
  PageHeader,
  ProvenanceTag,
  ReadOnlyBanner,
  StatCard,
  StatusPill,
} from "@/components/portal";
import { Button } from "@/components/ui/button";
import { daysFromToday, downloadCsv, fmtDate, INR, INRshort, maskReference } from "@/lib/format";
import { can, isReadOnly, visibleInstruments, visibleInstitutions } from "@/lib/selectors";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/registry")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const q =
      typeof search["q"] === "string" && search["q"].trim() ? search["q"].trim() : undefined;
    return q ? { q } : {};
  },
  head: () => ({
    meta: [
      { title: "FDR registry · AICTE Smart FDR Portal" },
      {
        name: "description",
        content:
          "Searchable, scoped registry of institutional FDRs and security deposit instruments.",
      },
    ],
  }),
  component: Registry,
});

type MaturityFilter = "ALL" | "MATURED" | "30" | "60" | "90" | "FUTURE";

const STATUSES = [
  "ALL",
  "DRAFT",
  "SUBMITTED",
  "UNDER_SCRUTINY",
  "RETURNED",
  "ACCEPTED",
  "REJECTED",
];
const TYPES = ["ALL", "FDR", "RTGS", "RPGF", "OTHER"];

function Registry() {
  const child = useMatch({ from: "/registry/$id", shouldThrow: false });
  const { user } = useSession();
  const { state } = usePortal();
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  const [status, setStatus] = useState("ALL");
  const [region, setRegion] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [maturity, setMaturity] = useState<MaturityFilter>("ALL");
  const [sort, setSort] = useState<"maturity" | "amount" | "institution">("maturity");

  useEffect(() => {
    setQ(search.q ?? "");
  }, [search.q]);

  if (child) return <Outlet />;
  if (!user) return null;

  const instruments = visibleInstruments(state, user);
  const institutions = visibleInstitutions(state, user);
  const regions = [...new Set(institutions.map((institution) => institution.region))];

  const rows = instruments
    .filter((instrument) => {
      const institution = state.institutions.find((entry) => entry.id === instrument.institutionId);
      const haystack = [
        instrument.fdrNo,
        instrument.bank,
        instrument.branch,
        instrument.ifsc,
        institution?.name,
        institution?.permanentId,
        institution?.region,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q.toLowerCase())) return false;
      if (status !== "ALL" && instrument.submissionStatus !== status) return false;
      if (region !== "ALL" && institution?.region !== region) return false;
      if (type !== "ALL" && instrument.type !== type) return false;
      const days = daysFromToday(instrument.maturityDate);
      if (maturity === "MATURED" && days >= 0) return false;
      if (maturity === "30" && (days < 0 || days > 30)) return false;
      if (maturity === "60" && (days < 0 || days > 60)) return false;
      if (maturity === "90" && (days < 0 || days > 90)) return false;
      if (maturity === "FUTURE" && days <= 90) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "amount") return b.amount - a.amount;
      if (sort === "institution") {
        const nameA = state.institutions.find((entry) => entry.id === a.institutionId)?.name ?? "";
        const nameB = state.institutions.find((entry) => entry.id === b.institutionId)?.name ?? "";
        return nameA.localeCompare(nameB);
      }
      return a.maturityDate.localeCompare(b.maturityDate);
    });

  const totalValue = rows.reduce((sum, instrument) => sum + instrument.amount, 0);
  const findings = state.findings.filter(
    (finding) =>
      finding.status === "OPEN" &&
      rows.some((instrument) => instrument.id === finding.instrumentId),
  );
  const maturing = rows.filter((instrument) => {
    const days = daysFromToday(instrument.maturityDate);
    return days >= 0 && days <= 60;
  });

  const exportRows = () => {
    downloadCsv("aicte-fdr-registry.csv", [
      [
        "Permanent ID",
        "Institution",
        "Reference (masked)",
        "Type",
        "Bank",
        "Branch",
        "Amount (INR)",
        "Issue date",
        "Maturity",
        "Hold end",
        "Submission",
        "Verification",
        "Provenance",
        "Officer",
      ],
      ...rows.map((instrument) => {
        const institution = state.institutions.find(
          (entry) => entry.id === instrument.institutionId,
        );
        return [
          institution?.permanentId ?? "",
          institution?.name ?? "",
          maskReference(instrument.fdrNo),
          instrument.type,
          instrument.bank,
          instrument.branch,
          instrument.amount,
          instrument.issueDate,
          instrument.maturityDate,
          instrument.holdEndDate ?? "Unknown",
          instrument.submissionStatus,
          instrument.verificationStatus,
          instrument.provenance,
          instrument.officer,
        ];
      }),
    ]);
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Central registry"
        title="FDR registry"
        sub="Every instrument in your scope with its obligation, independent dates, provenance and status."
        action={
          <>
            <Button variant="outline" onClick={exportRows}>
              <Download className="h-4 w-4" /> Export CSV
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
          label="Instruments in view"
          value={String(rows.length)}
          hint={`${instruments.length} total in scope`}
        />
        <StatCard label="Value in view" value={INRshort(totalValue)} hint={INR(totalValue)} />
        <StatCard
          label="Maturing ≤ 60 days"
          value={String(maturing.length)}
          hint="Renewal may be required; hold is separate"
          tone={maturing.length ? "warning" : "success"}
        />
        <StatCard
          label="Open findings"
          value={String(findings.length)}
          hint="Deterministic checks, not allegations"
          tone={findings.length ? "danger" : "success"}
        />
      </div>

      <div className="mt-5 space-y-2">
        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-64 flex-1 items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search institution, permanent ID, FDR number, bank, IFSC"
              aria-label="Search registry"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            aria-label="Sort"
            className="rounded-md border bg-card px-3 py-2 text-sm"
          >
            <option value="maturity">Sort: maturity</option>
            <option value="amount">Sort: amount</option>
            <option value="institution">Sort: institution</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Submission status"
            className="rounded-md border bg-card px-3 py-2 text-xs"
          >
            {STATUSES.map((entry) => (
              <option key={entry} value={entry}>
                {entry === "ALL" ? "All statuses" : entry.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            aria-label="Region"
            className="rounded-md border bg-card px-3 py-2 text-xs"
          >
            <option value="ALL">All regions</option>
            {regions.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-label="Instrument type"
            className="rounded-md border bg-card px-3 py-2 text-xs"
          >
            {TYPES.map((entry) => (
              <option key={entry} value={entry}>
                {entry === "ALL" ? "All instrument types" : entry}
              </option>
            ))}
          </select>
          <select
            value={maturity}
            onChange={(event) => setMaturity(event.target.value as MaturityFilter)}
            aria-label="Maturity window"
            className="rounded-md border bg-card px-3 py-2 text-xs"
          >
            <option value="ALL">All maturities</option>
            <option value="MATURED">Matured</option>
            <option value="30">≤ 30 days</option>
            <option value="60">≤ 60 days</option>
            <option value="90">≤ 90 days</option>
            <option value="FUTURE">Beyond 90 days</option>
          </select>
          {(q || status !== "ALL" || region !== "ALL" || type !== "ALL" || maturity !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setStatus("ALL");
                setRegion("ALL");
                setType("ALL");
                setMaturity("ALL");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No instruments match"
            hint="Adjust the search or filters. Institution accounts only see their own records."
            action={
              can(user, "create_submission") ? (
                <Button asChild size="sm">
                  <Link to="/submissions/new">Create a submission</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {[
                  "Institution",
                  "Reference / bank",
                  "Type",
                  "Amount",
                  "Maturity",
                  "Hold ends",
                  "Provenance",
                  "Status",
                  "Officer",
                ].map((heading) => (
                  <th key={heading} className="px-3 py-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((instrument) => {
                const institution = state.institutions.find(
                  (entry) => entry.id === instrument.institutionId,
                );
                const hasFinding = state.findings.some(
                  (finding) => finding.instrumentId === instrument.id && finding.status === "OPEN",
                );
                return (
                  <tr key={instrument.id} className="border-t transition hover:bg-muted/40">
                    <td className="px-3 py-3">
                      <Link
                        to="/registry/$id"
                        params={{ id: instrument.id }}
                        className="font-medium text-heading hover:underline"
                      >
                        {institution?.name}
                      </Link>
                      <p className="text-[10px] text-muted-foreground">
                        {institution?.permanentId} · {institution?.region}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="flex items-center gap-1 font-mono text-[11px]">
                        {hasFinding && (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                        )}
                        {instrument.fdrNo}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {instrument.bank} · {instrument.branch}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs">{instrument.type}</td>
                    <td className="px-3 py-3 text-xs tabular-nums">{INR(instrument.amount)}</td>
                    <td className="px-3 py-3 text-xs">
                      {fmtDate(instrument.maturityDate)}
                      {daysFromToday(instrument.maturityDate) < 0 && (
                        <p className="text-[10px] text-destructive">
                          Matured — not auto-releasable
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {instrument.holdEndDate ? (
                        fmtDate(instrument.holdEndDate)
                      ) : (
                        <span className="rounded tone-warning px-1.5 py-0.5 text-[10px] font-medium">
                          Unknown
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <ProvenanceTag provenance={instrument.provenance} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={instrument.submissionStatus} />
                      <p className="mt-1">
                        <StatusPill status={instrument.verificationStatus} />
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {instrument.officer}
                      <p className="text-[10px] text-muted-foreground">
                        {instrument.type === "FDR" ? "Instrument" : "Non-FDR route"}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Showing {rows.length} of {instruments.length} instruments in scope. Export is scope-filtered
        and masks instrument references. Full identifiers remain inside authorized case detail.
      </p>
    </AppShell>
  );
}
