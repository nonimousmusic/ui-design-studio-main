-- AICTE Smart FDR Portal: tenant-safe initial schema.
-- Mutations are server-only until audited RPCs are implemented.
begin;

create type public.app_role as enum ('INSTITUTION_ADMIN','CASE_OFFICER','CLEARANCE_REVIEWER','DECISION_AUTHORITY','ADMIN','AUDITOR');
create type public.region_code as enum ('Northern','Western','Southern','Central','Eastern');
create type public.institution_status as enum ('VERIFIED','PENDING');
create type public.obligation_status as enum ('OPEN','REVIEW_REQUIRED','SATISFIED','RELEASE_PENDING','CLOSED');
create type public.instrument_type as enum ('FDR','RTGS','RPGF','OTHER');
create type public.instrument_status as enum ('ACTIVE','APPROACHING_MATURITY','MATURED','SUPERSEDED','RELEASED');
create type public.submission_status as enum ('DRAFT','SUBMITTED','UNDER_SCRUTINY','RETURNED','ACCEPTED','REJECTED');
create type public.verification_status as enum ('NOT_CHECKED','DOC_REVIEWED','BANK_PENDING','BANK_CONFIRMED','DISCREPANCY');
create type public.provenance as enum ('INSTITUTION_DECLARED','OFFICIAL_DOCUMENT_REVIEW','BANK_CONFIRMED_AUTHORIZED','SIMULATED_BANK_RESPONSE');
create type public.document_status as enum ('NOT_REVIEWED','ACCEPTED','NEEDS_CLARIFICATION');
create type public.finding_status as enum ('OPEN','RESOLVED','ACCEPTED_RISK');
create type public.finding_severity as enum ('HIGH','MEDIUM','LOW');
create type public.release_status as enum ('DRAFT','SUBMITTED','CLEARANCES_PENDING','DECISION_PENDING','APPROVED','REJECTED','CLOSED');
create type public.clearance_status as enum ('NOT_REQUESTED','PENDING','CLEARED','OBJECTED','NOT_APPLICABLE');
create type public.decision_outcome as enum ('APPROVED','REJECTED');
create type public.work_status as enum ('OPEN','IN_PROGRESS','DONE','OVERDUE');
create type public.alert_type as enum ('BANK_MATURITY','REGULATORY_HOLD','WORKFLOW_SLA','RENEWAL','RELEASE','DOCUMENT');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  display_name text not null,
  app_role public.app_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.institutions (
  id uuid primary key default gen_random_uuid(), permanent_id text not null unique,
  name text not null, short_name text not null, region public.region_code not null,
  institution_type text not null, city text not null, state text not null,
  owner_name text, owner_email text, approved_since date,
  status public.institution_status not null default 'PENDING',
  created_at timestamptz not null default now(), unique (id, permanent_id)
);

create table public.institution_memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  institution_id uuid not null references public.institutions(id) on delete restrict,
  membership_role public.app_role not null check (membership_role = 'INSTITUTION_ADMIN'),
  active boolean not null default true, created_at timestamptz not null default now(),
  unique (profile_id, institution_id)
);

create table public.policy_versions (
  id uuid primary key default gen_random_uuid(), version_key text not null unique,
  label text not null, effective_from date not null, effective_to date,
  source_clause text not null, status text not null check (status in ('ACTIVE','SUPERSEDED','DRAFT')),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
create table public.policy_rules (
  id uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references public.policy_versions(id) on delete restrict,
  code text not null, title text not null, clause text not null, requirement text not null,
  amount numeric(18,2), hold_years integer check (hold_years is null or hold_years >= 0),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  unique (policy_version_id, code)
);

create table public.deposit_obligations (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  policy_version_id uuid not null references public.policy_versions(id) on delete restrict,
  purpose text not null, amount numeric(18,2) not null check (amount > 0),
  start_date date not null, hold_end_date date,
  status public.obligation_status not null default 'OPEN', requirement_status text not null,
  notes text, created_at timestamptz not null default now(),
  unique (id, institution_id)
);

create table public.deposit_instruments (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null,
  obligation_id uuid not null, instrument_type public.instrument_type not null,
  reference_number text not null, normalized_reference text not null,
  bank text not null, branch text not null, ifsc text not null,
  amount numeric(18,2) not null check (amount > 0), issue_date date not null,
  maturity_date date not null, hold_end_date date,
  instrument_status public.instrument_status not null default 'ACTIVE',
  submission_status public.submission_status not null default 'DRAFT',
  verification_status public.verification_status not null default 'NOT_CHECKED',
  provenance public.provenance not null default 'INSTITUTION_DECLARED',
  officer_name text not null, previous_instrument_id uuid, replacement_instrument_id uuid,
  replacement_reason text, simulated_check jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (maturity_date > issue_date),
  check (previous_instrument_id is null or previous_instrument_id <> id),
  check (replacement_instrument_id is null or replacement_instrument_id <> id),
  foreign key (obligation_id, institution_id) references public.deposit_obligations(id, institution_id) on delete restrict,
  unique (id, institution_id),
  unique (institution_id, instrument_type, normalized_reference)
);
alter table public.deposit_instruments add constraint instruments_previous_same_tenant_fk
  foreign key (previous_instrument_id, institution_id) references public.deposit_instruments(id, institution_id) on delete restrict;
alter table public.deposit_instruments add constraint instruments_replacement_same_tenant_fk
  foreign key (replacement_instrument_id, institution_id) references public.deposit_instruments(id, institution_id) on delete restrict;

create table public.document_records (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, instrument_id uuid not null,
  name text not null, category text not null, version integer not null check (version > 0),
  storage_path text not null unique, checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  size_bytes bigint not null check (size_bytes > 0),
  mime text not null check (mime in ('application/pdf','image/png','image/jpeg')),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  reviewer_status public.document_status not null default 'NOT_REVIEWED', reviewer_note text,
  created_at timestamptz not null default now(),
  foreign key (instrument_id, institution_id) references public.deposit_instruments(id, institution_id) on delete restrict,
  unique (instrument_id, category, version)
);

create table public.verification_findings (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null, instrument_id uuid not null,
  code text not null, field_name text not null, expected text not null, observed text not null,
  severity public.finding_severity not null, rule_version text not null,
  status public.finding_status not null default 'OPEN', resolution text, next_action text not null,
  created_at timestamptz not null default now(), resolved_at timestamptz,
  foreign key (instrument_id, institution_id) references public.deposit_instruments(id, institution_id) on delete restrict
);

create table public.release_cases (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null,
  obligation_id uuid not null, instrument_id uuid not null,
  status public.release_status not null default 'DRAFT', requested_at timestamptz not null default now(),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reason text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (obligation_id, institution_id) references public.deposit_obligations(id, institution_id) on delete restrict,
  foreign key (instrument_id, institution_id) references public.deposit_instruments(id, institution_id) on delete restrict,
  unique (id, institution_id)
);
create table public.release_checklist_items (
  id uuid primary key default gen_random_uuid(), release_case_id uuid not null, institution_id uuid not null,
  label text not null, required boolean not null default true, done boolean not null default false,
  evidence text, updated_by uuid references public.profiles(id) on delete restrict, updated_at timestamptz,
  foreign key (release_case_id, institution_id) references public.release_cases(id, institution_id) on delete restrict
);
create table public.release_clearances (
  id uuid primary key default gen_random_uuid(), release_case_id uuid not null, institution_id uuid not null,
  bureau text not null, required boolean not null default true,
  status public.clearance_status not null default 'NOT_REQUESTED', note text not null default '',
  reviewer_id uuid references public.profiles(id) on delete restrict, simulated boolean not null default false,
  updated_at timestamptz,
  foreign key (release_case_id, institution_id) references public.release_cases(id, institution_id) on delete restrict,
  unique (release_case_id, bureau)
);
create table public.release_decisions (
  id uuid primary key default gen_random_uuid(), release_case_id uuid not null unique, institution_id uuid not null,
  outcome public.decision_outcome not null, authority_id uuid not null references public.profiles(id) on delete restrict,
  decided_at timestamptz not null default now(), rationale text not null check (length(trim(rationale)) > 0),
  conditions text not null default '', instrument_route text check (instrument_route in ('NOC_RECORD','SANCTION_ORDER')),
  foreign key (release_case_id, institution_id) references public.release_cases(id, institution_id) on delete restrict
);

create table public.work_items (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete restrict,
  title text not null, entity_type text not null check (entity_type in ('INSTRUMENT','RELEASE','OBLIGATION')),
  entity_id uuid not null, assignee_id uuid references public.profiles(id) on delete restrict,
  owner_role public.app_role not null, due_date date not null, priority public.finding_severity not null default 'MEDIUM',
  reason_code text not null, status public.work_status not null default 'OPEN', created_at timestamptz not null default now()
);
create table public.alerts (
  id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete restrict,
  alert_type public.alert_type not null, title text not null, detail text not null,
  entity_type text not null, entity_id uuid not null, recipient_id uuid references public.profiles(id) on delete restrict,
  trigger_date date not null, threshold text not null, acknowledged_at timestamptz, escalated_at timestamptz,
  delivery text not null default 'IN_APP' check (delivery in ('IN_APP','EMAIL_SIMULATED')),
  dedupe_key text not null unique, created_at timestamptz not null default now()
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), occurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete restrict, actor_role public.app_role,
  action text not null, entity_type text not null, entity_id uuid not null,
  institution_id uuid references public.institutions(id) on delete restrict, reason text,
  before_state jsonb, after_state jsonb, correlation_id uuid not null default gen_random_uuid(),
  source text not null default 'WEB_APP' check (source in ('WEB_APP','SCHEDULER','SIMULATED_ADAPTER')),
  metadata jsonb not null default '{}'::jsonb
);

create index obligations_institution_idx on public.deposit_obligations(institution_id);
create index instruments_obligation_idx on public.deposit_instruments(obligation_id);
create index instruments_maturity_idx on public.deposit_instruments(maturity_date);
create index documents_instrument_idx on public.document_records(instrument_id);
create index findings_instrument_status_idx on public.verification_findings(instrument_id, status);
create index releases_institution_status_idx on public.release_cases(institution_id, status);
create index work_items_assignee_status_due_idx on public.work_items(assignee_id, status, due_date);
create index alerts_recipient_ack_idx on public.alerts(recipient_id, acknowledged_at, trigger_date);
create index audit_institution_time_idx on public.audit_events(institution_id, occurred_at desc);

create function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = ''
as $$
  select p.app_role from public.profiles p
  where p.user_id = (select auth.uid()) and p.active limit 1
$$;

create function public.can_access_institution(target_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    when public.current_app_role() in ('ADMIN','AUDITOR','CASE_OFFICER','CLEARANCE_REVIEWER','DECISION_AUTHORITY') then true
    else exists (
      select 1 from public.profiles p
      join public.institution_memberships m on m.profile_id = p.id
      where p.user_id = (select auth.uid()) and p.active and m.active and m.institution_id = target_id
    )
  end
$$;

create function public.reject_audit_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'audit_events are append-only';
end
$$;
create trigger audit_events_append_only before update or delete on public.audit_events
for each row execute function public.reject_audit_mutation();

alter table public.profiles enable row level security;
alter table public.institutions enable row level security;
alter table public.institution_memberships enable row level security;
alter table public.policy_versions enable row level security;
alter table public.policy_rules enable row level security;
alter table public.deposit_obligations enable row level security;
alter table public.deposit_instruments enable row level security;
alter table public.document_records enable row level security;
alter table public.verification_findings enable row level security;
alter table public.release_cases enable row level security;
alter table public.release_checklist_items enable row level security;
alter table public.release_clearances enable row level security;
alter table public.release_decisions enable row level security;
alter table public.work_items enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_events enable row level security;

create policy profile_read_self_or_admin on public.profiles for select to authenticated
using (user_id = (select auth.uid()) or public.current_app_role() = 'ADMIN');
create policy membership_read_self_or_admin on public.institution_memberships for select to authenticated
using (profile_id = (select id from public.profiles where user_id = (select auth.uid())) or public.current_app_role() = 'ADMIN');
create policy institutions_read_scope on public.institutions for select to authenticated
using (public.can_access_institution(id));
create policy policies_read_authenticated on public.policy_versions for select to authenticated
using (public.current_app_role() is not null);
create policy policy_rules_read_authenticated on public.policy_rules for select to authenticated
using (public.current_app_role() is not null);
create policy obligations_read_scope on public.deposit_obligations for select to authenticated
using (public.can_access_institution(institution_id));
create policy instruments_read_scope on public.deposit_instruments for select to authenticated
using (public.can_access_institution(institution_id));
create policy documents_read_scope on public.document_records for select to authenticated
using (public.can_access_institution(institution_id));
create policy findings_read_scope on public.verification_findings for select to authenticated
using (public.can_access_institution(institution_id));
create policy releases_read_scope on public.release_cases for select to authenticated
using (public.can_access_institution(institution_id));
create policy checklist_read_scope on public.release_checklist_items for select to authenticated
using (public.can_access_institution(institution_id));
create policy clearances_read_scope on public.release_clearances for select to authenticated
using (public.can_access_institution(institution_id));
create policy decisions_read_scope on public.release_decisions for select to authenticated
using (public.can_access_institution(institution_id));
create policy work_items_read_scope on public.work_items for select to authenticated
using (public.can_access_institution(institution_id));
create policy alerts_read_scope on public.alerts for select to authenticated
using (
  public.can_access_institution(institution_id)
  and (
    public.current_app_role() in ('ADMIN','AUDITOR','CASE_OFFICER','CLEARANCE_REVIEWER','DECISION_AUTHORITY')
    or recipient_id = (select id from public.profiles where user_id = (select auth.uid()))
  )
);
create policy audit_read_scope on public.audit_events for select to authenticated
using (
  (institution_id is not null and public.can_access_institution(institution_id))
  or (
    institution_id is null
    and public.current_app_role() in ('ADMIN','AUDITOR','CASE_OFFICER','CLEARANCE_REVIEWER','DECISION_AUTHORITY')
  )
);

revoke all on public.profiles, public.institutions, public.institution_memberships,
  public.policy_versions, public.policy_rules, public.deposit_obligations, public.deposit_instruments,
  public.document_records, public.verification_findings, public.release_cases,
  public.release_checklist_items, public.release_clearances, public.release_decisions,
  public.work_items, public.alerts, public.audit_events from anon, authenticated;
grant select on public.profiles, public.institutions, public.institution_memberships,
  public.policy_versions, public.policy_rules, public.deposit_obligations, public.deposit_instruments,
  public.document_records, public.verification_findings, public.release_cases,
  public.release_checklist_items, public.release_clearances, public.release_decisions,
  public.work_items, public.alerts, public.audit_events to authenticated;
grant all on all tables in schema public to service_role;
revoke all on function public.current_app_role() from public, anon;
revoke all on function public.can_access_institution(uuid) from public, anon;
grant execute on function public.current_app_role() to authenticated, service_role;
grant execute on function public.can_access_institution(uuid) to authenticated, service_role;

commit;
