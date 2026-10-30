# Agent Notes

This repository is a standalone TanStack Start frontend prototype. There is no
external editor, hosting integration or generated-branding pipeline. Treat the
working tree as the source of truth.

## Ground rules

- Keep the PRD guardrails intact: synthetic data only, maturity is not release
  eligibility, documentary review is not bank confirmation, no money movement,
  no automatic approval, tenant scoping, append-only audit.
- Do not introduce live bank, payment, notification or identity integrations.
  Adapters stay simulated and labelled.
- Domain changes belong in `src/lib/types.ts`, `src/lib/seed.ts`,
  `src/lib/selectors.ts` and `src/lib/store.tsx`. Keep selectors pure and keep
  all mutations audited in the store.
- Use the fixed demo clock (`DEMO_TODAY` in `src/lib/format.ts`) for date math.
- Never hand-edit `src/routeTree.gen.ts`; run `bun run dev` or `bun run build` to
  regenerate it.
- Read `memory.md` before starting and update it after meaningful changes.
- Keep `docs/` aligned when behaviour, routes or acceptance coverage changes.

## Verification before finishing

```sh
bunx tsc --noEmit
bun run lint
bun run test
bun run build
```

Then smoke-test the personas and the AC-01 to AC-12 walkthrough described in
`docs/TEST_PLAN.md`.
