import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Fingerprint,
  History,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AppShell, DemoBadge, EmptyState, PageHeader, Panel, StatCard } from "@/components/portal";
import { Button } from "@/components/ui/button";
import { downloadCsv, fmtDateTime, DEMO_TODAY } from "@/lib/format";
import { visibleAudit } from "@/lib/selectors";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";
import type { AuditEvent } from "@/lib/types";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit trail · AICTE Smart FDR Portal" },
      {
        name: "description",
        content:
          "Scoped, append-only audit history with actor, role, reason, before/after values and correlation identifiers.",
      },
    ],
  }),
  component: AuditPage,
});

const ENTITY_TYPES = [
  "INSTRUMENT",
  "DOCUMENT",
  "RELEASE",
  "CLEARANCE",
  "DECISION",
  "ALERT",
  "POLICY",
  "USER",
  "OBLIGATION",
] as const;

function AuditPage() {
  const { user } = useSession();
  const { state } = usePortal();
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("ALL");
  const [entityType, setEntityType] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!user) return null;

  const events = visibleAudit(state, user).sort((a, b) => b.at.localeCompare(a.at));
  const actors = [...new Set(events.map((event) => event.actorName))].sort();
  const sources = [...new Set(events.map((event) => event.source))];

  const rows = events.filter((event) => {
    if (actor !== "ALL" && event.actorName !== actor) return false;
    if (entityType !== "ALL" && event.entityType !== entityType) return false;
    if (source !== "ALL" && event.source !== source) return false;
    if (
      q &&
      !`${event.action} ${event.reason ?? ""} ${event.entityId} ${event.actorName} ${event.institutionId ?? ""}`
        .toLowerCase()
        .includes(q.toLowerCase())
    )
      return false;
    return true;
  });

  const institutions = new Set(events.map((event) => event.institutionId).filter(Boolean)).size;
  const simulated = events.filter((event) => event.source === "SIMULATED_ADAPTER").length;
  const systemEvents = events.filter((event) => event.actorRole === "SYSTEM").length;

  const toggle = (id: string) => {
    setExpanded((current) => {
      const nextSet = new Set(current);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });
  };

  const exportAudit = () => {
    downloadCsv("aicte-fdr-audit.csv", [
      [
        "Event ID",
        "Timestamp",
        "Actor",
        "Role",
        "Action",
        "Entity type",
        "Entity ID",
        "Institution",
        "Reason",
        "Source",
        "Correlation ID",
        "Before",
        "After",
      ],
      ...rows.map((event) => [
        event.id,
        event.at,
        event.actorName,
        event.actorRole,
        event.action,
        event.entityType,
        event.entityId,
        event.institutionId ?? "",
        event.reason ?? "",
        event.source,
        event.correlationId,
        event.before ? JSON.stringify(event.before) : "",
        event.after ? JSON.stringify(event.after) : "",
      ]),
    ]);
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="System · trust"
        title="Audit trail"
        sub={`Append-only events in your scope. Audit cannot be edited or deleted through the application. Demo clock ${DEMO_TODAY}.`}
        action={
          <Button variant="outline" onClick={exportAudit}>
            <Download className="h-4 w-4" /> Export scoped audit
          </Button>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-md border tone-info px-4 py-2.5 text-xs">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Audit is append-only. Institution accounts see only events tied to their institution;
          officials see their assigned scope; auditors see all permitted records without mutation
          controls.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Events in scope"
          value={String(events.length)}
          hint={`${rows.length} after filters`}
          icon={History}
        />
        <StatCard
          label="Distinct actors"
          value={String(actors.length)}
          hint={`${institutions} institutions referenced`}
          icon={UserRound}
        />
        <StatCard
          label="Simulated events"
          value={String(simulated)}
          hint="Adapter-sourced, never bank confirmed"
          tone={simulated ? "warning" : "success"}
          icon={Fingerprint}
        />
        <StatCard
          label="System events"
          value={String(systemEvents)}
          hint="Scheduler and rule engine"
          icon={ShieldCheck}
        />
      </div>

      <Panel
        className="mt-4"
        title="Event log"
        description="Newest first. Expand a row for permitted before/after values and correlation identity."
      >
        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-56 flex-1 items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search action, reason, entity or actor"
              aria-label="Search audit events"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <select
            value={actor}
            onChange={(event) => setActor(event.target.value)}
            aria-label="Actor"
            className="rounded-md border bg-card px-3 py-2 text-xs"
          >
            <option value="ALL">All actors</option>
            {actors.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <select
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            aria-label="Entity type"
            className="rounded-md border bg-card px-3 py-2 text-xs"
          >
            <option value="ALL">All entity types</option>
            {ENTITY_TYPES.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            aria-label="Source"
            className="rounded-md border bg-card px-3 py-2 text-xs"
          >
            <option value="ALL">All sources</option>
            {sources.map((entry) => (
              <option key={entry} value={entry}>
                {entry.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          {(q || actor !== "ALL" || entityType !== "ALL" || source !== "ALL") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setActor("ALL");
                setEntityType("ALL");
                setSource("ALL");
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No events match"
              hint="Adjust the filters. Audit events cannot be created manually."
              icon={History}
            />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  {[
                    "",
                    "Timestamp",
                    "Actor / role",
                    "Action",
                    "Entity",
                    "Reason",
                    "Correlation",
                  ].map((heading) => (
                    <th key={heading} className="px-3 py-2.5 font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((event: AuditEvent) => {
                  const isOpen = expanded.has(event.id);
                  const hasDetail = Boolean(event.before || event.after);
                  return (
                    <tr key={event.id} className="border-t align-top">
                      <td className="px-2 py-2.5">
                        {hasDetail ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={isOpen ? "Collapse event detail" : "Expand event detail"}
                            onClick={() => toggle(event.id)}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        ) : (
                          <span className="block w-8" />
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px]">{fmtDateTime(event.at)}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {event.actorName}
                        <p className="text-[10px] text-muted-foreground">
                          {event.actorRole.replace(/_/g, " ")}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-medium">{event.action}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                            {event.source}
                          </span>
                          {event.source === "SIMULATED_ADAPTER" && <DemoBadge label="SIMULATED" />}
                        </div>
                        {isOpen && (
                          <div className="mt-2 grid gap-1.5 font-mono text-[10px]">
                            {event.before && (
                              <pre className="max-w-md overflow-x-auto rounded bg-muted p-2 text-muted-foreground">
                                before {JSON.stringify(event.before, null, 2)}
                              </pre>
                            )}
                            {event.after && (
                              <pre className="max-w-md overflow-x-auto rounded bg-primary/5 p-2">
                                after {JSON.stringify(event.after, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className="font-mono text-[10px]">{event.entityType}</span>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {event.entityId}
                        </p>
                      </td>
                      <td className="max-w-xs px-3 py-2.5 text-[11px]">
                        {event.reason ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[9px] text-muted-foreground">
                          {event.correlationId}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Production enforcement requires database-level
          update/delete denial for application roles; this UI provides no mutation control.
        </p>
      </Panel>
    </AppShell>
  );
}
