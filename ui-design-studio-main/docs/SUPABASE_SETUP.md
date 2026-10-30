# Supabase Setup

## Current status

- Supabase CLI scaffold exists in `/supabase`.
- `202610300001_initial_schema.sql` defines the initial schema and tenant-scoped
  read policies. Client-side writes are intentionally denied.
- No project is linked and no hosted project was changed.
- The migration has **not** been applied or linted: local validation requires Docker
  Desktop or Podman, neither of which is currently available in this environment.
- The existing prototype still uses browser `localStorage`; Supabase is not yet its
  data source.

## Before connecting a hosted project

1. Create or identify a dedicated Supabase project for this portal. Do not reuse
   unrelated projects.
2. Confirm the owning organization and region against data residency/security
   requirements.
3. Enable MFA for project owners and use least-privilege access for collaborators.
4. Never provide or commit a database password, access token, or `service_role` key.

Once the project is explicitly selected, link and push only after local review:

```sh
supabase login
supabase link --project-ref <confirmed-project-ref>
supabase migration list
supabase db push --dry-run
```

Review the dry run and target project before removing `--dry-run` to apply.
Do not run these commands against an existing unrelated project.

## Local validation

Install and start Docker Desktop or Podman, then run:

```sh
supabase start
supabase db reset
supabase db lint --local
```

Local seed data is disabled until test-user/profile provisioning and a synthetic-only
seed strategy have been defined. The production schema uses UUIDs; adapter mapping
from the current demo's prefixed IDs is still to be implemented.

## Security boundaries in the initial migration

- Every institution-owned operational row carries an `institution_id`.
- Composite foreign keys prevent linking an instrument, obligation, document, or
  release record across institution boundaries.
- RLS permits tenant-scoped reads; official roles currently have broad read scope.
  Region/case assignment scopes must be added before production use.
- Authenticated browser roles receive `SELECT` only. No direct inserts, updates, or
  deletes are granted.
- `audit_events` has a database trigger rejecting updates and deletes.
- Subsequent work must add audited server-side RPCs, authorize each role and state
  transition, and add executable RLS isolation tests before connecting the UI.

## Secrets and application integration

When Auth integration begins, use only the project URL and publishable/anon key in
browser configuration. Keep the service-role key exclusively in trusted server
runtime secrets; it must never enter client bundles. Document storage must use a
private bucket and server-authorized short-lived signed URLs.
