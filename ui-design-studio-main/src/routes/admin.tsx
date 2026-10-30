import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  KeyRound,
  Landmark,
  Link2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDate, fmtDateTime, INR } from "@/lib/format";
import { can, isReadOnly, roleLabel, scopeLabel } from "@/lib/selectors";
import { usePortal } from "@/lib/store";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration · AICTE Smart FDR Portal" },
      {
        name: "description",
        content:
          "Demo personas, scoped roles, versioned policy rules, integration status and guarded demo reset.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, users, signIn } = useSession();
  const { state, resetDemo } = usePortal();
  const navigate = useNavigate();

  if (!user) return null;
  if (!can(user, "view_admin")) {
    return (
      <AppShell>
        <ScopeDenied message="Administration is limited to system administrators and read-only auditors." />
      </AppShell>
    );
  }

  const readOnly = isReadOnly(user);
  const manage = can(user, "manage_admin");

  const counts = [
    ["Institutions", state.institutions.length],
    ["Obligations", state.obligations.length],
    ["Instruments", state.instruments.length],
    ["Documents", state.documents.length],
    ["Findings", state.findings.length],
    ["Release cases", state.releases.length],
    ["Work items", state.workItems.length],
    ["Alerts", state.alerts.length],
    ["Audit events", state.audit.length],
    ["Policy versions", state.policies.length],
  ] as const;

  const switchPersona = (id: string) => {
    const found = signIn(id);
    if (!found) {
      toast.error("Persona not found.");
      return;
    }
    toast(`Signed in as ${found.name}`, { description: roleLabel[found.role] });
    navigate({ to: "/" });
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="System"
        title="Administration"
        sub="Demo identity directory, versioned policy rules and integration boundaries. No real users, secrets, or external systems are connected."
        action={
          manage ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <RefreshCw className="h-4 w-4" /> Reset demo data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset all demo data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This discards every local change — submissions, checklist progress, clearances,
                    decisions, alerts and audit events — and restores the seeded synthetic snapshot.
                    Your signed-in persona is kept. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      resetDemo();
                      toast.success("Demo data reset to the seeded snapshot.");
                    }}
                  >
                    Reset demo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : undefined
        }
      />

      {readOnly && (
        <ReadOnlyBanner text="Auditor session: administration is visible for inspection only. Persona switching, policy changes and demo reset are unavailable." />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Demo personas"
          value={String(users.length)}
          hint="Seeded directory only"
          icon={Users}
        />
        <StatCard
          label="Policy versions"
          value={String(state.policies.length)}
          hint={`${state.policies.filter((policy) => policy.status === "ACTIVE").length} active`}
          icon={Landmark}
        />
        <StatCard
          label="Audit events"
          value={String(state.audit.length)}
          hint="Append-only in the browser store"
          icon={ShieldCheck}
        />
        <StatCard
          label="External integrations"
          value="0 live"
          hint="All adapters simulated or disabled"
          icon={Link2}
        />
      </div>

      <Tabs defaultValue="users" className="mt-5">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1">
          <TabsTrigger value="users">Users & roles</TabsTrigger>
          <TabsTrigger value="policies">Policy versions</TabsTrigger>
          <TabsTrigger value="demo">Demo & integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 space-y-4">
          <Panel
            title="Demo identity directory"
            description="These are synthetic personas, not real accounts. Production uses verified identity, MFA for privileged roles, and administrator approval."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-muted/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {["Persona", "Role", "Scope", "Current", ""].map((heading) => (
                      <th key={heading} className="px-3 py-2.5 font-medium">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((persona) => (
                    <tr key={persona.id} className="border-t">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                            {persona.initials}
                          </span>
                          <div>
                            <p className="text-xs font-medium">{persona.name}</p>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              {persona.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {roleLabel[persona.role]}
                        <p className="text-[10px] text-muted-foreground">{persona.title}</p>
                      </td>
                      <td className="px-3 py-3 text-[11px] text-muted-foreground">
                        {scopeLabel(persona, state)}
                      </td>
                      <td className="px-3 py-3">
                        {persona.id === user.id ? (
                          <span className="rounded tone-success px-2 py-0.5 text-[10px] font-medium">
                            Signed in
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Available</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {manage && persona.id !== user.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => switchPersona(persona.id)}
                          >
                            Use persona
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Scope rules are enforced in selectors for this demo and must be enforced server-side
              with row-level security in production. An institution administrator never sees another
              tenant.
            </p>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Role guardrails">
              <ul className="space-y-2 text-xs">
                {[
                  [
                    "Institution administrator",
                    "Own institution only; may file submissions, replacements and release requests.",
                  ],
                  [
                    "Case officer",
                    "Scrutiny, findings, documentary review and simulated checks; no final decision.",
                  ],
                  ["Clearance reviewer", "Assigned bureau clearances only; cannot decide release."],
                  [
                    "Decision authority",
                    "Delegated release decisions; cannot edit checklist evidence or clearances.",
                  ],
                  [
                    "Administrator",
                    "Directory, policy versions and demo reset; no silent self-approval.",
                  ],
                  ["Auditor", "Read-only across permitted scope; cannot mutate any record."],
                ].map(([role, scope]) => (
                  <li key={role} className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">{role}</p>
                      <p className="text-[11px] text-muted-foreground">{scope}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Access principles" description="Why UI hiding is not enough.">
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>
                  Tenant identity is derived from the authenticated session, never from a URL
                  parameter.
                </li>
                <li>
                  Every mutation re-checks actor, role, state, evidence and policy on the server.
                </li>
                <li>
                  Privileged decisions require explicit delegation with an expiry and audit trail.
                </li>
                <li>
                  Auditors retain read-only access to evidence and history, not to mutation APIs.
                </li>
              </ul>
              <div className="mt-3 rounded-md border tone-warning p-2.5 text-[11px]">
                <p className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" /> Prototype limitation
                </p>
                <p className="mt-1">
                  Client-side role checks are demonstrative. AC-09 remains a backend acceptance item
                  for Phase 2.
                </p>
              </div>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="policies" className="mt-4 space-y-4">
          <div className="rounded-md border tone-info px-4 py-2.5 text-xs">
            <p className="font-semibold">Policy pinning — AC-12</p>
            <p className="mt-0.5">
              Each obligation stores the policy version used at evaluation time. Changing the active
              policy must not silently re-evaluate old cases. Rule amounts and holding periods are
              not hardcoded into UI copy.
            </p>
          </div>

          {state.policies.map((policy) => {
            const pinned = state.obligations.filter(
              (obligation) => obligation.policyVersionId === policy.id,
            );
            return (
              <Panel
                key={policy.id}
                title={`${policy.label} · ${policy.id}`}
                description={`Effective ${fmtDate(policy.effectiveFrom)}${
                  policy.effectiveTo ? ` to ${fmtDate(policy.effectiveTo)}` : " · current edition"
                } · source ${policy.sourceClause}`}
                action={<StatusPill status={policy.status} />}
              >
                <div className="space-y-3">
                  {policy.rules.map((rule) => (
                    <div key={rule.code} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold">
                          <span className="mr-2 font-mono text-[10px] text-muted-foreground">
                            {rule.code}
                          </span>
                          {rule.title}
                        </p>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                          clause {rule.clause}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">{rule.requirement}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                        {rule.amount !== undefined && (
                          <span>Illustrative amount {INR(rule.amount)}</span>
                        )}
                        {rule.holdYears !== undefined && (
                          <span>Illustrative hold {rule.holdYears} years</span>
                        )}
                        {rule.checklist && (
                          <span>{rule.checklist.length} checklist expectations</span>
                        )}
                      </div>
                      {rule.checklist && (
                        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                          {rule.checklist.map((item) => (
                            <li
                              key={item}
                              className="flex items-start gap-1.5 text-[10px] text-muted-foreground"
                            >
                              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success" />{" "}
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-md border bg-muted/40 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Cases pinned to this version ({pinned.length})
                  </p>
                  {pinned.length === 0 ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      No obligations currently reference this edition.
                    </p>
                  ) : (
                    <ul className="mt-1.5 space-y-1 text-[11px]">
                      {pinned.map((obligation) => {
                        const institution = state.institutions.find(
                          (entry) => entry.id === obligation.institutionId,
                        );
                        return (
                          <li
                            key={obligation.id}
                            className="flex flex-wrap items-center justify-between gap-2"
                          >
                            <span>
                              {institution?.name} · {obligation.purpose}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {obligation.id}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </Panel>
            );
          })}

          <Panel title="Versioning rules">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [
                  "New edition",
                  "Creates a new version; existing cases keep their pinned evaluation.",
                ],
                [
                  "Correction",
                  "Requires a new version and a recorded reason; published rules are immutable.",
                ],
                [
                  "Effective dates",
                  "The policy applicable on the evaluation date is recorded on the case.",
                ],
                [
                  "Withdrawal",
                  "Never silently re-evaluates; a reviewer must reassess with a new decision.",
                ],
              ].map(([title, detail]) => (
                <div key={title} className="rounded-md border p-3">
                  <p className="text-xs font-medium">{title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
            {!manage && (
              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <LockKeyhole className="h-3 w-3" /> Policy editing is disabled in this prototype and
                hidden from read-only sessions.
              </p>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="demo" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Store snapshot"
              description="Counts from the browser-local synthetic store."
            >
              <div className="grid grid-cols-2 gap-2">
                {counts.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded border px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-semibold tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-md border tone-demo p-2.5 text-[11px]">
                <Database className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  Persistence: localStorage key{" "}
                  <span className="font-mono">aicte-fdr-portal-v1</span>. Clearing browser storage
                  restores the seed. This is not a security boundary.
                </p>
              </div>
            </Panel>

            <Panel title="Integration status" description="No live external service is connected.">
              <ul className="space-y-2 text-xs">
                {[
                  [
                    "Bank verification",
                    "SIMULATED",
                    "Deterministic demo adapter; never promoted to authorized confirmation.",
                    "warning",
                  ],
                  [
                    "AICTE registry",
                    "SYNTHETIC",
                    "Permanent IDs and institution data are fixtures.",
                    "neutral",
                  ],
                  [
                    "Document storage",
                    "METADATA ONLY",
                    "Name, size, MIME, SHA-256; no object storage in this build.",
                    "neutral",
                  ],
                  [
                    "Notifications",
                    "IN-APP ONLY",
                    "No email/SMS delivery; simulated labels shown.",
                    "warning",
                  ],
                  [
                    "Money movement",
                    "DISABLED",
                    "No payment, encashment, NOC issue or sanction order.",
                    "danger",
                  ],
                ].map(([name, status, detail]) => (
                  <li key={name} className="rounded-md border p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <p className="font-medium">{name}</p>
                      <span className="font-mono text-[10px] text-muted-foreground">{status}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">{detail}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <Panel
            title="Demo guardrails"
            description="What the prototype intentionally does not do."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  [
                    "No real data",
                    "All institutions, FDRs, clearances and people are synthetic. Never enter real data.",
                  ],
                  [
                    "No auto-approval",
                    "No decision is created by a date, a checklist, a simulation or an OCR guess.",
                  ],
                  [
                    "No bank confirmation",
                    "Documentary review and simulated adapter results are labelled as such.",
                  ],
                  [
                    "No tenant bypass",
                    "Cross-institution URLs render a scope-denied panel; production adds RLS.",
                  ],
                  [
                    "No deleted audit",
                    "Events are append-only in the UI; production denies update/delete grants.",
                  ],
                  [
                    "No money movement",
                    "Approval creates a proposed record only, not an issued instruction.",
                  ],
                ] as const
              ).map(([title, detail]) => (
                <div key={title} className="rounded-md border p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    {title.startsWith("No") ? (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    )}
                    {title}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Demo clock & reset"
            description="Deterministic judging relies on a fixed date."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3 text-xs">
                <p className="flex items-center gap-1.5 font-medium">
                  <KeyRound className="h-3.5 w-3.5 text-primary" /> Fixed demo date
                </p>
                <p className="mt-1 text-muted-foreground">
                  Today is <span className="font-mono">2026-10-30</span> for all maturity and SLA
                  calculations. The backend will use the server clock in Asia/Kolkata.
                </p>
              </div>
              <div className="rounded-md border p-3 text-xs">
                <p className="flex items-center gap-1.5 font-medium">
                  <RefreshCw className="h-3.5 w-3.5 text-primary" /> Reset behavior
                </p>
                <p className="mt-1 text-muted-foreground">
                  Reset restores the seeded snapshot and removes local changes. Signed-in persona is
                  preserved. A real system would never expose this control to end users.
                </p>
              </div>
            </div>
            {manage ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="mt-3">
                    <RefreshCw className="h-4 w-4" /> Reset seeded demo data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset every demo change?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All local submissions, clearances, decisions, alerts and audit events will be
                      replaced by the original synthetic fixture set. This is irreversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep my changes</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        resetDemo();
                        toast.success("Seeded demo snapshot restored.");
                      }}
                    >
                      Reset demo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <LockKeyhole className="h-3.5 w-3.5" /> Reset requires system administrator rights.
              </p>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <p className="mt-4 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <LockKeyhole className="h-3.5 w-3.5" /> No secrets, service-role keys, or real institution
        documents are present in this build. Administration is demonstrative only.
      </p>
    </AppShell>
  );
}
