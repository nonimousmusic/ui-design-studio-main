import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, MapPin, Search, ShieldCheck } from "lucide-react";
import {
  AppShell,
  EmptyState,
  PageHeader,
  ReadOnlyBanner,
  ScopeDenied,
  StatCard,
  StatusPill,
} from "@/components/portal";
import { Button } from "@/components/ui/button";
import { DEMO_TODAY, fmtDate, INR, INRshort } from "@/lib/format";
import {
  can,
  isReadOnly,
  visibleInstitutions,
  visibleInstruments,
  visibleReleases,
} from "@/lib/selectors";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/institutions")({
  head: () => ({
    meta: [
      { title: "Institutions · AICTE Smart FDR Portal" },
      {
        name: "description",
        content: "Institution master, deposit obligations, holdings and open case indicators.",
      },
    ],
  }),
  component: InstitutionsPage,
});

const REGIONS = ["ALL", "Northern", "Western", "Southern", "Central", "Eastern"] as const;

function InstitutionsPage() {
  const child = useMatch({ from: "/institutions/$id", shouldThrow: false });
  const { user } = useSession();
  const { state } = usePortal();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("ALL");

  if (child) return <Outlet />;
  if (!user) return null;
  if (!can(user, "view_institutions")) {
    return (
      <AppShell>
        <ScopeDenied message="Institution accounts cannot browse the AICTE institution master. Use the FDR registry for your own records." />
      </AppShell>
    );
  }

  const institutions = visibleInstitutions(state, user);
  const instruments = visibleInstruments(state, user);
  const releases = visibleReleases(state, user);

  const rows = institutions
    .filter(
      (institution) =>
        (region === "ALL" || institution.region === region) &&
        [
          institution.name,
          institution.permanentId,
          institution.city,
          institution.state,
          institution.region,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .map((institution) => {
      const own = instruments.filter((instrument) => instrument.institutionId === institution.id);
      const held = own.filter((instrument) =>
        ["ACTIVE", "APPROACHING_MATURITY", "MATURED"].includes(instrument.instrumentStatus),
      );
      return {
        institution,
        instruments: own,
        held,
        value: held.reduce((sum, instrument) => sum + instrument.amount, 0),
        openFindings: state.findings.filter(
          (finding) =>
            finding.status === "OPEN" &&
            own.some((instrument) => instrument.id === finding.instrumentId),
        ).length,
        openReleases: releases.filter(
          (release) =>
            release.institutionId === institution.id &&
            !["APPROVED", "REJECTED", "CLOSED"].includes(release.status),
        ).length,
        awaiting: own.filter((instrument) =>
          ["SUBMITTED", "UNDER_SCRUTINY"].includes(instrument.submissionStatus),
        ).length,
      };
    });

  const totalHeld = rows.reduce((sum, row) => sum + row.value, 0);
  const openFindings = rows.reduce((sum, row) => sum + row.openFindings, 0);
  const awaiting = rows.reduce((sum, row) => sum + row.awaiting, 0);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Oversight"
        title="Institutions & obligations"
        sub="Verified institution master with holdings, obligations, open discrepancies and release activity."
        action={
          <Button asChild variant="outline">
            <Link to="/registry">
              <Building2 className="h-4 w-4" /> Open registry
            </Link>
          </Button>
        }
      />

      {isReadOnly(user) && <ReadOnlyBanner />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Institutions"
          value={String(rows.length)}
          hint={`${new Set(rows.map((row) => row.institution.region)).size} regions`}
        />
        <StatCard
          label="Deposits held"
          value={INRshort(totalHeld)}
          hint={`${rows.reduce((sum, row) => sum + row.held.length, 0)} active instruments`}
        />
        <StatCard
          label="Awaiting scrutiny"
          value={String(awaiting)}
          hint="Across visible institutions"
          tone={awaiting ? "warning" : "success"}
        />
        <StatCard
          label="Open findings"
          value={String(openFindings)}
          hint="Deterministic rule findings"
          tone={openFindings ? "danger" : "success"}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <label className="flex min-w-64 flex-1 items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search name, permanent ID, city, region"
            aria-label="Search institutions"
            className="w-full bg-transparent outline-none"
          />
        </label>
        <select
          value={region}
          onChange={(event) => setRegion(event.target.value as (typeof REGIONS)[number])}
          aria-label="Filter by region"
          className="rounded-md border bg-card px-3 py-2 text-sm"
        >
          {REGIONS.map((entry) => (
            <option key={entry} value={entry}>
              {entry === "ALL" ? "All regions" : entry}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No institutions match"
            hint="Adjust the search or region filter."
            icon={Building2}
          />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                {[
                  "Institution",
                  "Region",
                  "Obligations",
                  "Deposits held",
                  "Open cases",
                  "Status",
                ].map((heading) => (
                  <th key={heading} className="px-4 py-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.institution.id} className="border-t transition hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      to="/institutions/$id"
                      params={{ id: row.institution.id }}
                      className="font-medium text-heading hover:underline"
                    >
                      {row.institution.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {row.institution.permanentId} · {row.institution.city},{" "}
                      {row.institution.state}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                      {row.institution.region}
                    </span>
                    <p className="text-[10px] text-muted-foreground">{row.institution.type}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {
                      state.obligations.filter(
                        (obligation) => obligation.institutionId === row.institution.id,
                      ).length
                    }{" "}
                    obligations
                    <p className="text-[10px] text-muted-foreground">
                      {row.awaiting} awaiting scrutiny
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {INR(row.value)}
                    <p className="text-[10px] text-muted-foreground">
                      {row.held.length} instruments
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.openFindings > 0 && (
                        <span className="rounded-full tone-danger px-2 py-0.5 text-[10px] font-medium">
                          {row.openFindings} findings
                        </span>
                      )}
                      {row.openReleases > 0 && (
                        <span className="rounded-full tone-warning px-2 py-0.5 text-[10px] font-medium">
                          {row.openReleases} release
                        </span>
                      )}
                      {row.openFindings === 0 && row.openReleases === 0 && (
                        <span className="rounded-full tone-success px-2 py-0.5 text-[10px] font-medium">
                          Clear
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={row.institution.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Counts reconcile to the demo store. Demo clock: {fmtDate(DEMO_TODAY)}. Institution accounts
        see only their own record.
      </p>
    </AppShell>
  );
}
