import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Filter,
  PlayCircle,
  Search,
  Timer,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  AppShell,
  EmptyState,
  PageHeader,
  Panel,
  ScopeDenied,
  StatCard,
  StatusPill,
} from "@/components/portal";
import { Button } from "@/components/ui/button";
import { daysBetween, DEMO_TODAY, fmtDate, slaLabel } from "@/lib/format";
import { can, visibleInstitutions, visibleWorkItems } from "@/lib/selectors";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scrutiny")({
  head: () => ({
    meta: [
      { title: "Scrutiny queue · AICTE Smart FDR Portal" },
      {
        name: "description",
        content:
          "SLA-sorted scrutiny, clearance and decision work items with deterministic findings and overdue ageing.",
      },
    ],
  }),
  component: ScrutinyPage,
});

type QueueFilter = "ALL" | "OVERDUE" | "TODAY" | "WEEK" | "HIGH";

function ScrutinyPage() {
  const { user } = useSession();
  const { state, runDateMonitor } = usePortal();
  const [priority, setPriority] = useState("ALL");
  const [reason, setReason] = useState("ALL");
  const [filter, setFilter] = useState<QueueFilter>("ALL");
  const [q, setQ] = useState("");
  const [lastRun, setLastRun] = useState<string | null>(null);

  if (!user) return null;
  if (!can(user, "scrutinise")) {
    return (
      <AppShell>
        <ScopeDenied message="The scrutiny queue is limited to AICTE officials. Institution accounts can follow their own cases in the registry; auditors have read-only access to case files." />
      </AppShell>
    );
  }

  const workItems = visibleWorkItems(state, user).filter((item) => item.status !== "DONE");
  const institutions = visibleInstitutions(state, user);

  const counts = {
    overdue: workItems.filter((item) => daysBetween(DEMO_TODAY, item.dueDate) < 0).length,
    today: workItems.filter((item) => item.dueDate === DEMO_TODAY).length,
    week: workItems.filter((item) => {
      const days = daysBetween(DEMO_TODAY, item.dueDate);
      return days > 0 && days <= 7;
    }).length,
    high: workItems.filter((item) => item.priority === "HIGH").length,
  };

  const reasons = [...new Set(workItems.map((item) => item.reasonCode))].sort();

  const rows = workItems
    .filter((item) => {
      if (priority !== "ALL" && item.priority !== priority) return false;
      if (reason !== "ALL" && item.reasonCode !== reason) return false;
      const institution = institutions.find((entry) => entry.id === item.institutionId);
      if (
        q &&
        !`${item.title} ${item.assigneeName} ${institution?.name ?? ""} ${institution?.permanentId ?? ""}`
          .toLowerCase()
          .includes(q.toLowerCase())
      )
        return false;
      const days = daysBetween(DEMO_TODAY, item.dueDate);
      if (filter === "OVERDUE" && days >= 0) return false;
      if (filter === "TODAY" && days !== 0) return false;
      if (filter === "WEEK" && (days < 0 || days > 7)) return false;
      if (filter === "HIGH" && item.priority !== "HIGH") return false;
      return true;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const runMonitor = () => {
    const result = runDateMonitor();
    setLastRun(result.message);
    if (result.created > 0) toast.success(result.message);
    else toast(result.message);
  };

  const ageOf = (createdAt: string): number =>
    Math.max(0, daysBetween(createdAt.slice(0, 10), DEMO_TODAY));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Oversight · Regulation Bureau"
        title="Scrutiny queue"
        sub="Every open action by due date, owner and reason. Ageing is measured against the fixed demo clock."
        action={
          <>
            <Button variant="outline" onClick={runMonitor}>
              <PlayCircle className="h-4 w-4" /> Run date monitor
            </Button>
            <Button asChild>
              <Link to="/registry">
                <ClipboardCheck className="h-4 w-4" /> Open registry
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setFilter("OVERDUE")}
          className={cn("text-left", filter === "OVERDUE" && "ring-2 ring-primary/40 rounded-lg")}
        >
          <StatCard
            label="Overdue"
            value={String(counts.overdue)}
            hint="Past the assigned due date"
            icon={AlertTriangle}
            tone={counts.overdue ? "danger" : "success"}
          />
        </button>
        <button
          type="button"
          onClick={() => setFilter("TODAY")}
          className={cn("text-left", filter === "TODAY" && "ring-2 ring-primary/40 rounded-lg")}
        >
          <StatCard
            label="Due today"
            value={String(counts.today)}
            hint={`${fmtDate(DEMO_TODAY)} demo clock`}
            icon={Timer}
            tone={counts.today ? "warning" : "success"}
          />
        </button>
        <button
          type="button"
          onClick={() => setFilter("WEEK")}
          className={cn("text-left", filter === "WEEK" && "ring-2 ring-primary/40 rounded-lg")}
        >
          <StatCard
            label="Next 7 days"
            value={String(counts.week)}
            hint="Due within the week"
            icon={CalendarClock}
          />
        </button>
        <button
          type="button"
          onClick={() => setFilter("HIGH")}
          className={cn("text-left", filter === "HIGH" && "ring-2 ring-primary/40 rounded-lg")}
        >
          <StatCard
            label="High priority"
            value={String(counts.high)}
            hint="Duplicate refs, holds, release gates"
            icon={Users}
          />
        </button>
      </div>

      {lastRun && (
        <div className="mt-4 flex items-start gap-2 rounded-md border tone-info px-4 py-2.5 text-xs">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Date monitor completed</p>
            <p className="mt-0.5">{lastRun}</p>
            <p className="mt-0.5 text-muted-foreground">
              Dedupe keys are type + entity + threshold + recipient. Re-run to verify stability.
            </p>
          </div>
        </div>
      )}

      <Panel
        className="mt-4"
        title="Work queue"
        description={`${rows.length} open item${rows.length === 1 ? "" : "s"} in scope · sorted by due date`}
      >
        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-56 flex-1 items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search case, institution or owner"
              aria-label="Search work queue"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            aria-label="Priority"
            className="rounded-md border bg-card px-3 py-2 text-xs"
          >
            <option value="ALL">All priorities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-label="Reason"
            className="rounded-md border bg-card px-3 py-2 text-xs"
          >
            <option value="ALL">All reasons</option>
            {reasons.map((entry) => (
              <option key={entry} value={entry}>
                {entry.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as QueueFilter)}
            aria-label="SLA filter"
            className="rounded-md border bg-card px-3 py-2 text-xs"
          >
            <option value="ALL">All SLA states</option>
            <option value="OVERDUE">Overdue</option>
            <option value="TODAY">Due today</option>
            <option value="WEEK">Due this week</option>
            <option value="HIGH">High priority</option>
          </select>
          {(q || priority !== "ALL" || reason !== "ALL" || filter !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setPriority("ALL");
                setReason("ALL");
                setFilter("ALL");
              }}
            >
              <Filter className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No work items match"
              hint="Adjust the filters or run the date monitor to surface missing SLA alerts."
              icon={CheckCircle2}
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  {[
                    "Case & institution",
                    "Reason / finding",
                    "Owner",
                    "Priority",
                    "Due",
                    "Age",
                    "Status",
                    "",
                  ].map((heading) => (
                    <th key={heading} className="px-3 py-2.5 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const institution = institutions.find((entry) => entry.id === item.institutionId);
                  const instrument = state.instruments.find((entry) => entry.id === item.entityId);
                  const release = state.releases.find((entry) => entry.id === item.entityId);
                  const finding = state.findings.find(
                    (entry) => entry.instrumentId === item.entityId && entry.status === "OPEN",
                  );
                  const due = slaLabel(item.dueDate);
                  const href =
                    item.entityType === "RELEASE"
                      ? `/release/${item.entityId}`
                      : `/registry/${item.entityId}`;
                  return (
                    <tr key={item.id} className="border-t align-top transition hover:bg-muted/40">
                      <td className="px-3 py-3">
                        <Link to={href} className="font-medium text-heading hover:underline">
                          {instrument?.fdrNo ?? release?.id ?? item.entityId}
                        </Link>
                        <p className="text-[10px] text-muted-foreground">
                          {institution?.name} · {institution?.permanentId}
                        </p>
                        <p className="mt-0.5 text-[11px]">{item.title}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                          {item.reasonCode}
                        </span>
                        {finding && (
                          <p className="mt-1 text-[10px] text-warning">
                            {finding.code} · {finding.field}
                          </p>
                        )}
                        {!finding && (
                          <p className="mt-1 text-[10px] text-muted-foreground">No open finding</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {item.assigneeName}
                        <p className="text-[10px] text-muted-foreground">
                          {item.ownerRole.replace(/_/g, " ")}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={item.priority} />
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <span
                          className={cn(
                            "font-medium",
                            due.tone === "danger" && "text-destructive",
                            due.tone === "warning" && "text-warning",
                          )}
                        >
                          {due.label}
                        </span>
                        <p className="text-[10px] text-muted-foreground">{fmtDate(item.dueDate)}</p>
                      </td>
                      <td className="px-3 py-3 text-xs tabular-nums">{ageOf(item.createdAt)}d</td>
                      <td className="px-3 py-3">
                        <StatusPill status={item.status} />
                      </td>
                      <td className="px-3 py-3">
                        <Button asChild size="sm" variant="outline">
                          <Link to={href}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-[11px] text-muted-foreground">
          Age is days since the work item was created. SLA labels use the fixed demo date. Counts
          reconcile to open work items in the store.
        </p>
      </Panel>
    </AppShell>
  );
}
