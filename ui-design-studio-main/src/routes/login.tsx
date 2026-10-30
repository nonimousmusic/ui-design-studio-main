import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Gavel,
  Landmark,
  LockKeyhole,
  ScrollText,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { demoUsers } from "@/lib/seed";
import { useSession } from "@/lib/session";
import { roleLabel } from "@/lib/selectors";
import type { Role } from "@/lib/types";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in · AICTE Smart FDR Portal" },
      {
        name: "description",
        content:
          "Sign in to the synthetic SIH26265 AICTE security deposit and FDR lifecycle prototype.",
      },
    ],
  }),
  component: LoginPage,
});

const PERSONA_ICONS: Record<Role, typeof UserRound> = {
  INSTITUTION_ADMIN: Building2,
  CASE_OFFICER: ShieldCheck,
  CLEARANCE_REVIEWER: CheckCircle2,
  DECISION_AUTHORITY: Gavel,
  ADMIN: Users,
  AUDITOR: ScrollText,
};

const PERSONA_BLURB: Record<string, string> = {
  "u-inst-a": "Own deposits · submit & renew",
  "u-inst-c": "Release request · own scope",
  "u-officer": "Scrutiny · findings · verification",
  "u-clearance": "PGRC / Vigilance clearances",
  "u-authority": "Delegated release decisions",
  "u-admin": "Policies · users · demo reset",
  "u-auditor": "Read-only audit history",
};

function LoginPage() {
  const { user, ready, signIn } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("a.mehta@aicte.demo");
  const [password, setPassword] = useState("demo-password");
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  if (ready && user) return <Navigate to="/" />;

  const signInAs = (userId: string) => {
    const found = signIn(userId);
    if (!found) {
      toast.error("Demo persona not found.");
      return;
    }
    toast(`Signed in as ${found.name}`, { description: roleLabel[found.role] });
    navigate({ to: "/" });
  };

  const submitCredentials = (event: React.FormEvent) => {
    event.preventDefault();
    const found = demoUsers.find(
      (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!found) {
      toast.error("Unknown demo email", {
        description: "Use one of the persona shortcuts or a seeded @aicte.demo address.",
      });
      return;
    }
    if (!password) {
      toast.error("Enter any password — this is a synthetic demo.");
      return;
    }
    signInAs(found.id);
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar px-10 py-12 text-sidebar-foreground lg:flex">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,var(--sidebar-primary)_0,transparent_45%),radial-gradient(circle_at_80%_10%,var(--chart-4)_0,transparent_35%)]" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">AICTE Smart FDR Portal</p>
              <p className="text-xs opacity-70">Regulation Bureau · SIH26265</p>
            </div>
          </div>

          <h1 className="mt-12 max-w-lg text-3xl font-semibold leading-tight tracking-tight">
            One explainable case file for every security deposit.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed opacity-80">
            Track obligations separately from FDR instruments. Verify evidence with explicit
            provenance, monitor independent dates, preserve renewal history, and gate release on
            clearances and a delegated human decision.
          </p>

          <div className="mt-10 grid max-w-md gap-3 text-sm">
            {[
              "Obligation first, instrument second",
              "Maturity ≠ release eligibility",
              "Documentary review ≠ bank confirmation",
              "Release requires clearances & authority",
            ].map((line) => (
              <div key={line} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-sidebar-primary" />
                <span className="opacity-90">{line}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative max-w-md rounded-md border border-sidebar-border bg-sidebar-accent/60 p-4 text-xs leading-relaxed opacity-90">
          <p className="flex items-center gap-2 font-semibold">
            <LockKeyhole className="h-3.5 w-3.5" /> Synthetic demo, honest labels
          </p>
          <p className="mt-2 opacity-80">
            All institutions, instruments, clearances, and bank responses are synthetic. No money
            movement, automatic approval, NOC issuance, or real bank verification occurs. Simulated
            results are labelled SIMULATED.
          </p>
        </div>
      </section>

      <section className="flex flex-col px-5 py-8 sm:px-10 lg:px-14">
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar text-sidebar-foreground">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">AICTE Smart FDR Portal</p>
            <p className="text-[11px] text-muted-foreground">SIH26265 · synthetic demo</p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            Secure access
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-heading">
            Sign in to the demo workspace
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a seeded persona to explore a role-scoped view. No real credentials are used.
          </p>

          <Tabs defaultValue="personas" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personas">Demo personas</TabsTrigger>
              <TabsTrigger value="request">Request access</TabsTrigger>
            </TabsList>

            <TabsContent value="personas" className="mt-4 space-y-5">
              <div className="grid gap-2 sm:grid-cols-2">
                {demoUsers.map((persona) => {
                  const Icon = PERSONA_ICONS[persona.role];
                  return (
                    <button
                      key={persona.id}
                      type="button"
                      onClick={() => signInAs(persona.id)}
                      className="group flex items-start gap-3 rounded-md border bg-card p-3 text-left transition hover:border-primary/50 hover:bg-muted/40"
                    >
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{persona.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {PERSONA_BLURB[persona.id] ?? roleLabel[persona.role]}
                        </span>
                      </span>
                      <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or use demo credentials
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={submitCredentials} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Any non-empty password works in this synthetic demo.
                  </p>
                </div>
                <Button type="submit" className="w-full">
                  Sign in <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="request" className="mt-4">
              {requestSubmitted ? (
                <div className="rounded-md border tone-success p-4 text-sm">
                  <p className="font-semibold">Request recorded in the demo</p>
                  <p className="mt-1 text-xs">
                    A real deployment would queue this as a pending request for administrator
                    verification. Self-registration must never self-approve access.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setRequestSubmitted(false)}
                  >
                    Submit another request
                  </Button>
                </div>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setRequestSubmitted(true);
                    toast.success("Account request recorded (demo only)");
                  }}
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="req-name">Full name</Label>
                      <Input id="req-name" required placeholder="Officer name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="req-email">Official email</Label>
                      <Input
                        id="req-email"
                        required
                        type="email"
                        placeholder="name@institution.ac.in"
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="req-institution">Institution</Label>
                      <Input id="req-institution" required placeholder="Institution name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="req-id">AICTE Permanent ID</Label>
                      <Input id="req-id" required placeholder="1-XXXXXXX" className="font-mono" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="req-reason">Purpose</Label>
                    <Textarea
                      id="req-reason"
                      rows={3}
                      placeholder="Describe the deposit records you need to access."
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Submit access request
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Demo only. Real onboarding requires verified organization data and administrator
                    approval — never self-approval.
                  </p>
                </form>
              )}
            </TabsContent>
          </Tabs>

          <p className="mt-8 text-[11px] leading-relaxed text-muted-foreground">
            SIH26265 prototype · synthetic fixtures · no real AICTE, bank, or payment integration.
            Regulatory applicability must be confirmed by the competent authority.
          </p>
        </div>
      </section>
    </div>
  );
}
