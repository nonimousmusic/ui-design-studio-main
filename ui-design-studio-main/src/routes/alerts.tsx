import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  FileWarning,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  AppShell,
  EmptyState,
  PageHeader,
  Panel,
  ReadOnlyBanner,
  StatCard,
} from "@/components/portal";
import { Button } from "@/components/ui/button";
import { DEMO_TODAY, fmtDate, fmtMonthYear, relativeDays } from "@/lib/format";
import { can, isReadOnly, visibleAlerts, visibleInstitutions } from "@/lib/selectors";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";
import type { Alert, AlertType } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts & dates · AICTE Smart FDR Portal" },
      {
        name: "description",
        content:
          "Maturity, regulatory hold, workflow SLA, renewal and release alerts with acknowledgement, escalation and dedupe rules.",
      },
    ],
  }),
  component: AlertsPage,
});

const TYPE_META: Record<
  AlertType,
  { label: string; tone: string; icon: typeof BellRing; hint: string }
> = {
  BANK_MATURITY: {
    label: "Bank maturity",
    tone: "tone-info",
    icon: CalendarClock,
    hint: "Instrument event. Never a release date.",
  },
  REGULATORY_HOLD: {
    label: "Regulatory hold",
    tone: "tone-warning",
    icon: ShieldAlert,
    hint: "Obligation event. Confirmed separately from maturity.",
  },
  WORKFLOW_SLA: {
    label: "Workflow SLA",
    tone: "tone-danger",
    icon: Clock,
    hint: "Review or clearance due date.",
  },
  RENEWAL: {
    label: "Renewal",
    tone: "tone-info",
    icon: RefreshCw,
    hint: "Replacement chain activity.",
  },
  RELEASE: {
    label: "Release",
    tone: "tone-warning",
    icon: TrendingUp,
    hint: "Release gate or clearance status.",
  },
  DOCUMENT: {
    label: "Document",
    tone: "tone-neutral",
    icon: FileWarning,
    hint: "Correction, clarification or version event.",
  },
};

function AlertsPage() {
  const { user } = useSession();
  const { state, acknowledgeAlert, escalateAlert, runDateMonitor } = usePortal();
  const [typeFilter, setTypeFilter] = useState<"ALL" | AlertType>("ALL");
  const [showAcknowledged, setShowAcknowledged] = useState(true);
  const [lastRun, setLastRun] = useState<string | null>(null);

  if (!user) return null;

  const alerts = visibleAlerts(state, user);
  const institutions = visibleInstitutions(state, user);
  const readOnly = isReadOnly(user);

  const filtered = alerts
    .filter((alert) => typeFilter === "ALL" || alert.type === typeFilter)
    .filter((alert) => showAcknowledged || !alert.acknowledged)
    .sort((a, b) => b.triggerDate.localeCompare(a.triggerDate));

  const grouped = (() => {
    const map = new Map<string, Alert[]>();
    for (const alert of filtered) {
      const month = fmtMonthYear(alert.triggerDate);
      map.set(month, [...(map.get(month) ?? []), alert]);
    }
    return [...map.entries()];
  })();

  const unacknowledged = alerts.filter((alert) => !alert.acknowledged);
  const escalated = alerts.filter((alert) => alert.escalated);
  const maturityAlerts = alerts.filter((alert) => alert.type === "BANK_MATURITY").length;
  const holdAlerts = alerts.filter((alert) => alert.type === "REGULATORY_HOLD").length;

  const runMonitor = () => {
    const result = runDateMonitor();
    setLastRun(result.message);
    if (result.created > 0) toast.success(result.message);
    else toast(result.message);
  };

  const linkedHref = (alert: Alert): string => {
    const release = state.releases.find((entry) => entry.id === alert.entityId);
    if (release) return `/release/${release.id}`;
    return `/registry/${alert.entityId}`;
  };

  const acknowledge = (alert: Alert) => {
    const result = acknowledgeAlert(alert.id);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  };

  const escalate = (alert: Alert) => {
    const result = escalateAlert(alert.id);
    if (result.ok) toast.success(result.message);
    else toast.error(result.message);
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Oversight · calendar"
        title="Dates & alerts"
        sub="Bank maturity, regulatory hold, workflow SLA and release events are tracked as separate date types. Alerts are deduplicated, not repeated."
        action={
          <Button variant="outline" onClick={runMonitor}>
            <PlayCircle className="h-4 w-4" /> Run date monitor
          </Button>
        }
      />

      {readOnly && <ReadOnlyBanner />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Unacknowledged"
          value={String(unacknowledged.length)}
          hint={`${alerts.length} total in scope`}
          tone={unacknowledged.length ? "warning" : "success"}
          icon={BellRing}
        />
        <StatCard
          label="Escalated"
          value={String(escalated.length)}
          hint="Moved to a supervisory queue"
          tone={escalated.length ? "danger" : "success"}
          icon={ShieldAlert}
        />
        <StatCard
          label="Maturity events"
          value={String(maturityAlerts)}
          hint="Instrument dates, not release dates"
          icon={CalendarClock}
        />
        <StatCard
          label="Hold events"
          value={String(holdAlerts)}
          hint="Obligation dates, confirmed separately"
          icon={ShieldCheck}
        />
      </div>

      {lastRun && (
        <div className="mt-4 flex items-start gap-2 rounded-md border tone-info px-4 py-2.5 text-xs">
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Date monitor completed</p>
            <p className="mt-0.5">{lastRun}</p>
            <p className="mt-0.5 text-muted-foreground">
              Every alert carries a dedupe key: type + entity + threshold + recipient. Running the
              monitor repeatedly cannot create the same alert twice.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Panel
            title="Alert register"
            description={`${filtered.length} alert${filtered.length === 1 ? "" : "s"} shown · demo clock ${fmtDate(DEMO_TODAY)}`}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as "ALL" | AlertType)}
                  aria-label="Filter alert type"
                  className="rounded-md border bg-card px-2.5 py-1.5 text-xs"
                >
                  <option value="ALL">All types</option>
                  {Object.entries(TYPE_META).map(([type, meta]) => (
                    <option key={type} value={type}>
                      {meta.label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={showAcknowledged}
                    onChange={(event) => setShowAcknowledged(event.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  Show acknowledged
                </label>
              </div>
            }
          >
            {grouped.length === 0 ? (
              <EmptyState
                title="No alerts match"
                hint="Adjust the filters or run the date monitor to evaluate thresholds against current dates."
                icon={BellRing}
              />
            ) : (
              <div className="space-y-5">
                {grouped.map(([month, entries]) => (
                  <div key={month}>
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {month}
                      </h3>
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-[10px] text-muted-foreground">{entries.length}</span>
                    </div>
                    <ul className="space-y-2">
                      {entries.map((alert) => {
                        const meta = TYPE_META[alert.type];
                        const Icon = meta.icon;
                        const institution = institutions.find(
                          (entry) => entry.id === alert.institutionId,
                        );
                        return (
                          <li
                            key={alert.id}
                            className={cn(
                              "rounded-md border p-3",
                              !alert.acknowledged && "border-l-[3px] border-l-warning",
                            )}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                                      meta.tone,
                                    )}
                                  >
                                    <Icon className="h-3 w-3" /> {meta.label}
                                  </span>
                                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                                    {alert.threshold}
                                  </span>
                                  {alert.escalated && (
                                    <span className="rounded tone-danger px-1.5 py-0.5 text-[10px] font-semibold">
                                      ESCALATED
                                    </span>
                                  )}
                                  {alert.acknowledged && (
                                    <span className="rounded tone-success px-1.5 py-0.5 text-[10px] font-medium">
                                      Acknowledged
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1.5 text-xs font-medium">{alert.title}</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {alert.detail}
                                </p>
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  {institution?.name ?? "Cross-institution"} · recipient{" "}
                                  {alert.recipient} · event {fmtDate(alert.triggerDate)} (
                                  {relativeDays(alert.triggerDate)}) ·{" "}
                                  {alert.delivery === "IN_APP" ? "in-app" : "email (simulated)"}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                <Link
                                  to={linkedHref(alert)}
                                  className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
                                >
                                  Linked case <ChevronRight className="h-3 w-3" />
                                </Link>
                                {!readOnly && !alert.acknowledged && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => acknowledge(alert)}
                                  >
                                    <Check className="h-3.5 w-3.5" /> Acknowledge
                                  </Button>
                                )}
                                {!readOnly &&
                                  !alert.escalated &&
                                  (can(user, "scrutinise") || can(user, "manage_admin")) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => escalate(alert)}
                                    >
                                      Escalate
                                    </Button>
                                  )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="Reminder rules"
            description="Illustrative thresholds; production values come from the pinned policy version."
          >
            <ol className="space-y-2 text-xs">
              {[
                ["T-90", "First renewal planning alert to the institution"],
                ["T-60", "Renewal required; case officer notified"],
                ["T-30", "Escalation if no replacement is linked"],
                ["T-15", "Supervisory attention; release still gated separately"],
                ["T-7", "Critical maturity warning; no automatic release"],
              ].map(([threshold, description]) => (
                <li key={threshold} className="flex items-start gap-2">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                    {threshold}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{description}</span>
                </li>
              ))}
            </ol>
            <div className="mt-3 rounded-md border bg-muted/40 p-2.5 font-mono text-[10px] text-muted-foreground">
              dedupeKey = type : entityId : threshold : recipient
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              A repeated monitor run evaluates dates again but inserts only missing keys. This
              prevents alert storms during the demo and in production.
            </p>
          </Panel>

          <Panel title="Date type legend" description="Never conflate these dates.">
            <ul className="space-y-3 text-xs">
              {Object.entries(TYPE_META).map(([type, meta]) => {
                const Icon = meta.icon;
                return (
                  <li key={type} className="flex items-start gap-2">
                    <span className={cn("mt-0.5 rounded p-1", meta.tone)}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <div>
                      <p className="font-medium">{meta.label}</p>
                      <p className="text-[10px] text-muted-foreground">{meta.hint}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <div className="rounded-md border tone-warning p-3 text-[11px]">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" /> Maturity is not eligibility
            </p>
            <p className="mt-1">
              A matured FDR remains MATURED until all release prerequisites and a delegated decision
              are recorded. The date monitor never releases a deposit.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
