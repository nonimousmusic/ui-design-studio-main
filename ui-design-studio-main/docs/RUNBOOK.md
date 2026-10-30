# Runbook

## Requirements

- Bun 1.3+ (preferred) or Node 22+ with npm
- A modern browser

## Setup

```sh
cd ui-design-studio-main
bun install
bun run dev
```

Open `http://localhost:8080`.

### Scripts

| Command           | Purpose                  |
| ----------------- | ------------------------ |
| `bun run dev`     | Vite dev server with HMR |
| `bun run build`   | Production build         |
| `bun run preview` | Preview the build        |
| `bun run test`    | Vitest suite             |
| `bun run lint`    | ESLint                   |
| `bun run format`  | Prettier                 |

## Demo personas

Any password works; this is a synthetic demo. Use the quick-select buttons on `/login`.

| Persona                        | Scope          | Use for                                        |
| ------------------------------ | -------------- | ---------------------------------------------- |
| A. Mehta — Case officer        | All regions    | Scrutiny, clarifications, simulated bank check |
| R. Iyer — Clearance reviewer   | Assigned cases | PGRC/Vigilance clearance actions               |
| S. Rao — Decision authority    | All regions    | Final release decision                         |
| Shri Ram admin — Institution A | Institution A  | Submit, replacement, upload, own dashboard     |
| Kaveri admin — Institution C   | Institution C  | Release request/status                         |
| Admin — System                 | All            | Policy versions, users, demo reset             |
| Auditor — Read-only            | All            | Audit trail, read-only verification            |

## Reset

- **In-app:** Administration → Demo & integrations → Reset demo data (requires admin).
- **Manual:** DevTools → Application → Local Storage → remove keys beginning
  `aicte-fdr-` and reload.

## Demo clock

The app fixes “today” at **30 Oct 2026** (`DEMO_TODAY` in `src/lib/format.ts`) so SLA
and maturity scenarios stay deterministic. The banner states this. The Phase 5 backend
will use the real server clock and timezone `Asia/Kolkata`.

## Six-minute walkthrough

| Time | Action                          | What to show                                |
| ---- | ------------------------------- | ------------------------------------------- |
| 0:00 | Login as Institution A          | Scope, own deposit, next action             |
| 0:45 | Submit replacement FDR          | Checks, document hash, queue entry          |
| 1:35 | Switch to Case officer          | Scrutiny, clarification, event history      |
| 2:20 | Run date monitor twice          | Dedupe, threshold alert, owner              |
| 3:10 | Open renewal chain              | Old record immutable, new linked            |
| 4:00 | Release workspace as authority  | PGRC blocker, decision locked               |
| 4:45 | Clearance reviewer clears PGRC  | Gate opens                                  |
| 5:10 | Authority approves              | Decision, conditions, audit, PROPOSED label |
| 5:35 | Cross-tenant URL + auditor view | Denied access, read-only history            |

## Environment variables

None required for the frontend demo. Do not add real secrets. Future backend keys
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, server-only service key) belong in `.env.local`
and must never be committed.

## Deployment

The app is a standard TanStack Start/Vite build. `bun run build` emits the server and
client bundles. Host on any Node-capable platform. For the judged demo, a static-ish
hosted URL is sufficient; the whole workflow is client-side. Add an explicit
“synthetic data” banner and do not expose real records.

## Troubleshooting

| Symptom            | Fix                                                               |
| ------------------ | ----------------------------------------------------------------- |
| Port in use        | Change `server.port` in `vite.config.ts`                          |
| Hydration warning  | Clear `aicte-fdr-*` storage and reload                            |
| Stale route types  | Restart dev; `routeTree.gen.ts` regenerates                       |
| Empty dashboard    | Reset demo data from admin or clear storage                       |
| Build plugin error | Ensure TanStack Start plugin precedes React plugin in Vite config |
