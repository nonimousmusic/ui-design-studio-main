import { Link, Navigate, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BellRing,
  Building2,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  FileStack,
  FilePlus2,
  Gauge,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";
import {
  can,
  roleLabel,
  scopeLabel,
  visibleAlerts,
  visibleWorkItems,
  type NextAction,
} from "@/lib/selectors";
import type { Provenance } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, ready, users, signIn, signOut } = useSession();
  const { state, runDateMonitor } = usePortal();
  const pathname = useRouterState({ select: (router) => router.location.pathname });
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const counts = useMemo(() => {
    const work = visibleWorkItems(state, user).filter((item) => item.status !== "DONE");
    const alerts = visibleAlerts(state, user).filter((alert) => !alert.acknowledged);
    return { work: work.length, alerts: alerts.length };
  }, [state, user]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" /> Restoring demo session…
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  const navGroups: NavGroup[] = [
    {
      label: "Workspace",
      items: [
        { to: "/", label: "Overview", icon: LayoutDashboard, exact: true },
        { to: "/registry", label: "FDR registry", icon: FileStack },
        ...(can(user, "create_submission")
          ? [{ to: "/submissions/new", label: "New submission", icon: FilePlus2 }]
          : []),
        { to: "/renewals", label: "Renewals", icon: RefreshCw },
        { to: "/release", label: "Release workspace", icon: Scale },
      ],
    },
    {
      label: "Oversight",
      items: [
        ...(can(user, "view_institutions")
          ? [{ to: "/institutions", label: "Institutions", icon: Building2 }]
          : []),
        ...(can(user, "scrutinise")
          ? [{ to: "/scrutiny", label: "Scrutiny queue", icon: ClipboardCheck, badge: counts.work }]
          : []),
        { to: "/alerts", label: "Calendar & alerts", icon: BellRing, badge: counts.alerts },
        ...(can(user, "view_reports") ? [{ to: "/reports", label: "Reports", icon: Gauge }] : []),
      ],
    },
    {
      label: "System",
      items: [
        { to: "/audit", label: "Audit trail", icon: ShieldCheck },
        ...(can(user, "view_admin")
          ? [{ to: "/admin", label: "Administration", icon: Users }]
          : []),
      ],
    },
  ];

  const onSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate({ to: "/registry", search: { q: trimmed } });
  };

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Landmark className="h-5 w-5" />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold">AICTE FDR Portal</p>
          <p className="text-xs opacity-70">Regulation Bureau</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto p-3" aria-label="Primary">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-50">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.exact ?? false }}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm opacity-75 transition duration-150 hover:translate-x-0.5 hover:bg-sidebar-accent hover:opacity-100"
                  activeProps={{
                    className:
                      "!translate-x-0 bg-sidebar-accent !opacity-100 font-medium text-sidebar-accent-foreground shadow-sm",
                  }}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-primary-foreground">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-sidebar-accent text-xs font-semibold">
            {user.initials}
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-medium">{user.name}</p>
            <p className="truncate opacity-70">{roleLabel[user.role]}</p>
          </div>
        </div>
        <p className="mt-2 truncate text-[10px] opacity-60">{scopeLabel(user, state)}</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        {nav}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {nav}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="bg-demo px-4 py-1.5 text-center text-[11px] font-medium text-demo-foreground">
          SIH26265 prototype · synthetic data · responses marked SIMULATED are not real
          confirmations
        </div>

        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <form onSubmit={onSearch} className="relative hidden max-w-md flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search permanent ID, institution, FDR number…"
                aria-label="Search registry"
                className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </form>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const result = runDateMonitor();
                  toast(result.message);
                }}
                className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:text-foreground sm:flex"
                title="Run the demo date monitor"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                Demo clock · 30 Oct 2026
              </button>
              <Link
                to="/alerts"
                className="relative grid h-9 w-9 place-items-center rounded-md border bg-card text-muted-foreground transition hover:text-foreground"
                aria-label={`Alerts (${counts.alerts} unacknowledged)`}
              >
                <BellRing className="h-4 w-4" />
                {counts.alerts > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                    {counts.alerts}
                  </span>
                )}
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 items-center gap-2 rounded-md border bg-card px-2.5 text-sm transition hover:bg-muted"
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {user.initials}
                    </span>
                    <span className="hidden max-w-32 truncate sm:block">{user.name}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>
                    <span className="block text-sm">{user.name}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {roleLabel[user.role]}
                    </span>
                    <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                      {scopeLabel(user, state)}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Switch demo persona
                  </DropdownMenuLabel>
                  {users
                    .filter((candidate) => candidate.id !== user.id)
                    .map((candidate) => (
                      <DropdownMenuItem
                        key={candidate.id}
                        onSelect={() => {
                          signIn(candidate.id);
                          toast(`Signed in as ${candidate.name}`, {
                            description: roleLabel[candidate.role],
                          });
                          navigate({ to: "/" });
                        }}
                      >
                        <UserRound className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="flex-1">{candidate.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {candidate.role.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      signOut();
                      navigate({ to: "/login" });
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>

        <footer className="border-t px-4 py-4 text-[11px] text-muted-foreground lg:px-8">
          Synthetic SIH26265 prototype · no money movement · no automatic approval · not an official
          AICTE or bank record
        </footer>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  sub,
  action,
  eyebrow,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-heading">{title}</h1>
        {sub && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

const statusTone: Record<string, string> = {
  DRAFT: "tone-neutral",
  SUBMITTED: "tone-info",
  UNDER_SCRUTINY: "tone-warning",
  RETURNED: "tone-warning",
  ACCEPTED: "tone-success",
  REJECTED: "tone-danger",
  NOT_CHECKED: "tone-neutral",
  DOC_REVIEWED: "tone-info",
  BANK_PENDING: "tone-warning",
  BANK_CONFIRMED: "tone-success",
  DISCREPANCY: "tone-danger",
  ACTIVE: "tone-success",
  APPROACHING_MATURITY: "tone-warning",
  MATURED: "tone-warning",
  SUPERSEDED: "tone-neutral",
  RELEASED: "tone-success",
  OPEN: "tone-info",
  REVIEW_REQUIRED: "tone-warning",
  SATISFIED: "tone-success",
  RELEASE_PENDING: "tone-warning",
  CLOSED: "tone-neutral",
  CLEARED: "tone-success",
  PENDING: "tone-warning",
  OBJECTED: "tone-danger",
  OBJECTION: "tone-danger",
  NOT_REQUESTED: "tone-neutral",
  NOT_APPLICABLE: "tone-neutral",
  CLEARANCES_PENDING: "tone-warning",
  DECISION_PENDING: "tone-warning",
  APPROVED: "tone-success",
  OVERDUE: "tone-danger",
  IN_PROGRESS: "tone-warning",
  DONE: "tone-success",
  HIGH: "tone-danger",
  MEDIUM: "tone-warning",
  LOW: "tone-neutral",
  SIMULATED: "tone-demo",
  VERIFIED: "tone-success",
  PENDING_APPROVAL: "tone-warning",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide",
        statusTone[status] ?? "tone-neutral",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

const provenanceLabel: Record<Provenance, [string, string]> = {
  INSTITUTION_DECLARED: ["Institution declared", "tone-neutral"],
  OFFICIAL_DOCUMENT_REVIEW: ["Official doc review", "tone-info"],
  BANK_CONFIRMED_AUTHORIZED: ["Bank confirmed (authorized)", "tone-success"],
  SIMULATED_BANK_RESPONSE: ["SIMULATED", "tone-demo"],
};

export function ProvenanceTag({ provenance }: { provenance: Provenance }) {
  const [label, tone] = provenanceLabel[provenance];
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold",
        tone,
      )}
    >
      {label}
    </span>
  );
}

export function NextActionStrip({ action }: { action: NextAction }) {
  const cells: [string, string][] = [
    ["Action", action.action],
    ["Owner", action.owner],
    ["Due", action.due],
    ["Reason", action.reason],
    ["Evidence", action.evidence],
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-primary/30 bg-primary/20 sm:grid-cols-5">
      {cells.map(([key, value], index) => (
        <div
          key={key}
          className={cn(
            "min-w-0 bg-card px-3 py-2",
            index === 0 && "bg-primary text-primary-foreground",
          )}
        >
          <p
            className={cn(
              "text-[9px] font-semibold uppercase tracking-wider",
              index === 0 ? "opacity-80" : "text-muted-foreground",
            )}
          >
            {key}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
  action,
  description,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  description?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-lg border bg-card p-4 sm:p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-sm font-semibold text-heading">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
  icon?: typeof Gauge;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              "grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary",
              tone === "danger" && "bg-destructive/10 text-destructive",
              tone === "warning" && "bg-warning/15 text-warning",
              tone === "success" && "bg-success/10 text-success",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-3 text-2xl font-semibold tracking-tight tabular-nums text-heading sm:text-3xl",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon: Icon = FileStack,
  action,
}: {
  title: string;
  hint?: string;
  icon?: typeof FileStack;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-card px-6 py-10 text-center">
      <Icon className="mx-auto h-7 w-7 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium text-heading">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ScopeDenied({ message }: { message?: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border tone-danger p-6">
      <div className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Access denied by tenant scope</p>
          <p className="mt-1 text-sm">
            {message ??
              "This record belongs to another institution. Institution accounts can only access their own deposits, documents, and cases."}
          </p>
          <p className="mt-3 font-mono text-[10px] opacity-80">
            Security event expected to be recorded server-side · AC-01
          </p>
          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <Link to="/registry">Back to my registry</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReadOnlyBanner({ text }: { text?: string }) {
  return (
    <div className="mb-5 flex items-start gap-2 rounded-md border tone-info px-3 py-2 text-xs">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        {text ??
          "Read-only session. You can inspect records, evidence, and audit history but cannot change state."}
      </p>
    </div>
  );
}

export function GuardrailNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

export function DemoBadge({ label = "SIMULATED — not bank verified" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-dashed border-demo-foreground/50 bg-demo px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-demo-foreground">
      <AlertTriangle className="h-3 w-3" />
      {label}
    </span>
  );
}

export function MiniFact({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-sm font-medium", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}
