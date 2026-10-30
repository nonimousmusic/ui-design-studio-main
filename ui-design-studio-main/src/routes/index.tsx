import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FilePlus2,
  FileStack,
  Gavel,
  Landmark,
  Scale,
  ShieldAlert,
} from "lucide-react";
import { PortfolioBarChart, StatusDonut } from "@/components/charts";
import {
  AppShell,
  EmptyState,
  Panel,
  ProvenanceTag,
  StatCard,
  StatusPill,
} from "@/components/portal";
import { Button } from "@/components/ui/button";
import { daysFromToday, DEMO_TODAY, fmtDate, INR, INRshort, relativeDays } from "@/lib/format";
import {
  nextActionFor,
  releaseBlockers,
  statusMix,
  holdingsByRegion,
  kpis,
  scopeLabel,
  visibleInstruments,
  visibleReleases,
  visibleWorkItems,
} from "@/lib/selectors";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview · AICTE Smart FDR Portal" },
      {
        name: "description",
        content:
          "Role-scoped security deposit, FDR maturity, scrutiny, renewal and release overview.",
      },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { user } = useSession();
  const { state } = usePortal();
  if (!user) return null;

  const instruments = visibleInstruments(state, user);
  const work = visibleWorkItems(state, user)
    .filter((item) => item.status !== "DONE")
    .sort((a, b) => {
      const aOverdue = daysFromToday(a.dueDate) < 0 ? 0 : 1;
      const bOverdue = daysFromToday(b.dueDate) < 0 ? 0 : 1;
      const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (
        aOverdue - bOverdue ||
        priority[a.priority] - priority[b.priority] ||
        a.dueDate.localeCompare(b.dueDate)
      );
    });
  const releases = visibleReleases(state, user);
  const numbers = kpis(state, user);
  const activeReleases = releases.filter(
    (release) => !["APPROVED", "REJECTED", "CLOSED"].includes(release.status),
  );
  const regionData = holdingsByRegion(state, user);
  const statusData = statusMix(state, user);
  const institutionRole = user.role === "INSTITUTION_ADMIN";

  const upcoming = [
    ...instruments
      .filter((instrument) => {
        const days = daysFromToday(instrument.maturityDate);
        return (
          !["RELEASED", "SUPERSEDED"].includes(instrument.instrumentStatus) &&
          days >= 0 &&
          days <= 365
        );
      })
      .map((instrument) => ({
        date: instrument.maturityDate,
        title: `${instrument.fdrNo} matures`,
        who: state.institutions.find((institution) => institution.id === instrument.institutionId)
          ?.name,
        type: "Bank maturity",
        icon: CalendarClock,
        link: `/registry/${instrument.id}`,
      })),
    ...work
      .filter((item) => item.dueDate >= DEMO_TODAY)
      .map((item) => ({
        date: item.dueDate,
        title: item.title,
        who: item.assigneeName,
        type: "Workflow SLA",
        icon: ClipboardCheck,
        link:
          item.entityType === "RELEASE"
            ? `/release/${item.entityId}`
            : `/registry/${item.entityId}`,
      })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const primaryAction = institutionRole ? (
    <Button asChild>
      <Link to="/submissions/new">
        <FilePlus2 className="h-4 w-4" /> New submission
      </Link>
    </Button>
  ) : user.role === "DECISION_AUTHORITY" ? (
    <Button asChild>
      <Link to="/release">
        <Gavel className="h-4 w-4" /> Release cases
      </Link>
    </Button>
  ) : (
    <Button asChild>
      <Link to="/scrutiny">
        <ClipboardCheck className="h-4 w-4" /> Open scrutiny queue
      </Link>
    </Button>
  );

  return (
    <AppShell>
      <section className="relative isolate mb-5 overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-primary/10 p-5 shadow-sm sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 -z-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Role-scoped overview
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-heading sm:text-3xl">
              Good day, {user.name}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              {scopeLabel(user, state)} <span className="px-1">·</span> Here’s what needs your
              attention today.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background/70 px-3 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" /> {fmtDate(DEMO_TODAY)}
            </span>
            {primaryAction}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label={institutionRole ? "My deposits held" : "Deposits held"}
          value={INRshort(numbers.totalHeld)}
          hint={`${numbers.instrumentCount} instruments · ${INR(numbers.totalHeld)}`}
          icon={Landmark}
        />
        <StatCard
          label="Awaiting scrutiny"
          value={String(numbers.awaitingScrutiny)}
          hint={numbers.awaitingScrutiny > 0 ? "Submitted or under scrutiny" : "Queue clear"}
          icon={ClipboardCheck}
          tone={numbers.awaitingScrutiny > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Maturing ≤ 60 days"
          value={String(numbers.maturing)}
          hint="Renewal may be required; hold continues"
          icon={CalendarClock}
          tone={numbers.maturing > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Open discrepancies"
          value={String(numbers.openDiscrepancies)}
          hint="Deterministic findings, not fraud scores"
          icon={AlertTriangle}
          tone={numbers.openDiscrepancies > 0 ? "danger" : "success"}
        />
        <StatCard
          label="Release cases held"
          value={String(numbers.releaseHeld)}
          hint={activeReleases.length ? "Blocked by prerequisites" : "No open release cases"}
          icon={Scale}
          tone={numbers.releaseHeld > 0 ? "warning" : "success"}
        />
      </div>

      {numbers.overdueActions > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border tone-danger px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2">
            <BellRing className="h-4 w-4" />
            {numbers.overdueActions} overdue action{numbers.overdueActions > 1 ? "s" : ""} in your
            queue.
          </span>
          <Link to="/alerts" className="text-xs font-semibold underline underline-offset-2">
            Review alerts
          </Link>
        </div>
      )}

      <div className="mt-5 grid items-start gap-4 xl:grid-cols-12">
        <Panel
          title="Needs your attention"
          description={`${work.length} open item${work.length === 1 ? "" : "s"} · sorted by urgency and due date`}
          className="xl:col-span-7"
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={institutionRole ? "/registry" : "/scrutiny"}>
                View queue <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          {work.length === 0 ? (
            <EmptyState
              title="No open actions"
              hint="There are no open work items in your scope. Check the upcoming dates and alerts for monitored events."
              icon={ClipboardCheck}
            />
          ) : (
            <div className="divide-y">
              {work.slice(0, 5).map((item) => {
                const href =
                  item.entityType === "RELEASE"
                    ? `/release/${item.entityId}`
                    : `/registry/${item.entityId}`;
                const dueIn = daysFromToday(item.dueDate);
                const institution = state.institutions.find(
                  (entry) => entry.id === item.institutionId,
                );
                const relatedRelease =
                  item.entityType === "RELEASE"
                    ? state.releases.find((release) => release.id === item.entityId)
                    : undefined;
                const instrument = state.instruments.find((entry) => entry.id === item.entityId);
                const context =
                  item.entityType === "RELEASE"
                    ? relatedRelease
                      ? (releaseBlockers(state, relatedRelease)[0]?.label ?? "Release case review")
                      : "Release case unavailable"
                    : (instrument?.fdrNo ?? "Open case details");
                return (
                  <Link
                    key={item.id}
                    to={href}
                    className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span
                      className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                        dueIn < 0
                          ? "bg-destructive/10 text-destructive"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {dueIn < 0 ? (
                        <ShieldAlert className="h-4 w-4" />
                      ) : (
                        <ClipboardCheck className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-heading transition group-hover:text-primary">
                          {item.title}
                        </p>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <StatusPill status={item.priority} />
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                              dueIn < 0
                                ? "text-destructive"
                                : dueIn <= 3
                                  ? "text-warning"
                                  : "text-muted-foreground"
                            }`}
                          >
                            <Clock3 className="h-3 w-3" />{" "}
                            {dueIn < 0 ? `${Math.abs(dueIn)}d overdue` : relativeDays(item.dueDate)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {institution?.name ?? item.assigneeName} <span className="px-1">·</span>{" "}
                        {item.reasonCode.replace(/_/g, " ")}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{context}</p>
                    </div>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100" />
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-5 xl:grid-cols-1">
          <Panel
            title="Coming up"
            description="Deadlines and bank dates · tracked separately"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/alerts">
                  Calendar <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          >
            {upcoming.length === 0 ? (
              <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" /> No upcoming dates in scope.
              </div>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((entry) => (
                  <li key={`${entry.type}-${entry.title}-${entry.date}`}>
                    <Link to={entry.link} className="group flex items-start gap-3">
                      <span className="grid h-9 w-11 shrink-0 place-items-center rounded-lg border bg-muted/40 font-mono text-[10px] font-semibold text-heading">
                        {entry.date.slice(5).replace("-", "/")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold transition group-hover:text-primary">
                          {entry.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                          {entry.type} · {entry.who} · {relativeDays(entry.date)}
                        </span>
                      </span>
                      <entry.icon className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Release cases"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/release">All</Link>
              </Button>
            }
          >
            {activeReleases.length === 0 ? (
              <p className="text-xs text-muted-foreground">No open release cases.</p>
            ) : (
              <div className="space-y-4">
                {activeReleases.slice(0, 2).map((release) => {
                  const blockers = releaseBlockers(state, release);
                  return (
                    <Link
                      key={release.id}
                      to="/release/$id"
                      params={{ id: release.id }}
                      className="block rounded-lg border p-3 transition hover:border-primary/40 hover:bg-muted/20"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px]">{release.id}</span>
                        <StatusPill status={release.status} />
                      </div>
                      <p className="mt-1.5 truncate text-sm font-medium">
                        {
                          state.institutions.find(
                            (institution) => institution.id === release.institutionId,
                          )?.name
                        }
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {INR(
                          instruments.find((instrument) => instrument.id === release.instrumentId)
                            ?.amount ?? 0,
                        )}
                        {" · "}
                        {blockers.length} blocker{blockers.length === 1 ? "" : "s"}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Holdings by region"
          description="Accepted and monitored instruments, from the demo store."
        >
          <PortfolioBarChart data={regionData} />
        </Panel>
        <Panel
          title="Submission status mix"
          description="No AI risk score — deterministic case state."
        >
          {statusData.length === 0 ? (
            <p className="text-xs text-muted-foreground">No instruments in scope.</p>
          ) : (
            <div className="grid items-center gap-2 sm:grid-cols-2">
              <StatusDonut data={statusData} />
              <ul className="space-y-2 text-xs">
                {statusData.map((entry) => (
                  <li key={entry.status} className="flex items-center justify-between gap-2">
                    <StatusPill status={entry.status} />
                    <span className="font-medium tabular-nums">{entry.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      {institutionRole && (
        <Panel
          title="My obligations & instruments"
          className="mt-4"
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/registry">
                <FileStack className="h-3.5 w-3.5" /> Registry
              </Link>
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Instrument</th>
                  <th className="pb-2 pr-4 font-medium">Bank / branch</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 pr-4 font-medium">Maturity</th>
                  <th className="pb-2 pr-4 font-medium">Provenance</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {instruments.map((instrument) => (
                  <tr key={instrument.id} className="border-t">
                    <td className="py-2.5 pr-4">
                      <Link
                        to="/registry/$id"
                        params={{ id: instrument.id }}
                        className="font-mono text-xs hover:underline"
                      >
                        {instrument.fdrNo}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-xs">
                      {instrument.bank}
                      <span className="block text-[10px] text-muted-foreground">
                        {instrument.branch}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">{INR(instrument.amount)}</td>
                    <td className="py-2.5 pr-4 text-xs">{fmtDate(instrument.maturityDate)}</td>
                    <td className="py-2.5 pr-4">
                      <ProvenanceTag provenance={instrument.provenance} />
                    </td>
                    <td className="py-2.5">
                      <StatusPill status={instrument.submissionStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="mt-4 rounded-lg border bg-muted/30 p-4 text-[11px] leading-relaxed text-muted-foreground">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <Landmark className="h-3.5 w-3.5" /> Prototype guardrails
        </p>
        <p className="mt-1">
          Maturity is an instrument event; the regulatory hold end is a separate obligation date.
          Documentary review is not bank confirmation. Release requires mandatory clearances and a
          delegated human decision. Counts reflect the synthetic store and update after each action.
        </p>
      </div>
    </AppShell>
  );
}
