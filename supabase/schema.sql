-- TripCost multi-tenant schema
--
-- Run this once in the Supabase SQL editor.
--
-- The security model in one sentence: every table carries a company_id, and
-- Row-Level Security makes it impossible to read a row belonging to another
-- company — enforced by Postgres, not by remembering a WHERE clause.
--
-- That distinction is the whole point. App-level filtering fails open: one
-- forgotten condition in one query and a carrier sees a competitor's rates.
-- Database-level filtering fails closed: a query missing its filter returns
-- nothing rather than everything.
--
-- Two roles:
--   owner   the carrier. Full fleet, costs, rates, margins, driver management.
--   driver  sees their own assigned truck, their own loads, their own
--           compliance dates. Never costs, rates or another driver's data.

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------

create table if not exists companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 0),
  dot_number    text not null default '',
  mc_number     text not null default '',
  contact_name  text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Membership — the join between an auth user and a company
-- ---------------------------------------------------------------------------

create type member_role as enum ('owner', 'driver');

create table if not exists memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  company_id  uuid not null references companies(id) on delete cascade,
  role        member_role not null default 'driver',
  created_at  timestamptz not null default now(),
  -- A user belongs to exactly one company. Multi-company users would need a
  -- current-company selector everywhere; not worth the complexity yet.
  unique (user_id)
);

create index if not exists memberships_company_idx on memberships(company_id);

-- ---------------------------------------------------------------------------
-- Helper functions
--
-- SECURITY DEFINER so they can read memberships regardless of the caller's own
-- policies. Without this the membership policy would have to query memberships
-- to decide whether you can read memberships — infinite recursion, and Postgres
-- rejects it at query time rather than at policy-creation time, so it surfaces
-- as a confusing runtime error rather than a clear one.
-- ---------------------------------------------------------------------------

create or replace function auth_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from memberships where user_id = auth.uid() limit 1
$$;

create or replace function auth_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships where user_id = auth.uid() and role = 'owner'
  )
$$;

-- ---------------------------------------------------------------------------
-- Fleet
-- ---------------------------------------------------------------------------

create table if not exists trucks (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references companies(id) on delete cascade,
  unit_number          text not null,
  nickname             text not null default '',
  year                 int,
  make                 text not null default '',
  model                text not null default '',
  vin                  text not null default '',
  plate                text not null default '',
  active               boolean not null default true,
  -- The cost basis. Stored as JSONB because it is read and written whole, and
  -- the shape evolves with the app faster than a migration per field is worth.
  profile              jsonb not null,
  planned_miles_per_day int not null default 500,
  target_rate_per_mile  numeric(6,3) not null default 2.6,
  in_service_since     timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  unique (company_id, unit_number)
);

create index if not exists trucks_company_idx on trucks(company_id);

create table if not exists drivers (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  -- Null until the driver accepts their invite and creates a login.
  user_id               uuid references auth.users(id) on delete set null,
  first_name            text not null default '',
  last_name             text not null default '',
  phone                 text not null default '',
  email                 text not null default '',
  cdl_number            text not null default '',
  cdl_state             text not null default '',
  cdl_class             text not null default 'A',
  cdl_expires           date,
  endorsements          text[] not null default '{}',
  medical_card_expires  date,
  hire_date             date,
  status                text not null default 'active',
  assigned_truck_id     uuid references trucks(id) on delete set null,
  pay_mode              text not null default 'per-mile',
  pay_rate              numeric(8,3) not null default 0.65,
  hos_cycle             int not null default 70,
  notes                 text not null default '',
  created_at            timestamptz not null default now()
);

create index if not exists drivers_company_idx on drivers(company_id);
create index if not exists drivers_user_idx on drivers(user_id);

create table if not exists ledger_entries (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  truck_id    uuid references trucks(id) on delete cascade,
  entry_date  date not null default current_date,
  kind        text not null check (kind in ('expense', 'revenue')),
  category    text not null default 'other',
  label       text not null default '',
  amount      numeric(12,2) not null default 0,
  miles       int not null default 0,
  note        text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists ledger_company_idx on ledger_entries(company_id, entry_date desc);

-- ---------------------------------------------------------------------------
-- Driver invites
--
-- A driver joins by code rather than by the carrier knowing their auth user id.
-- The code is single-use and expires, so a leaked invite does not grant
-- indefinite access to a fleet.
-- ---------------------------------------------------------------------------

create table if not exists invites (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  driver_id   uuid references drivers(id) on delete cascade,
  code        text not null unique,
  expires_at  timestamptz not null default (now() + interval '14 days'),
  claimed_at  timestamptz,
  claimed_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists invites_code_idx on invites(code);

-- ---------------------------------------------------------------------------
-- Row-Level Security
--
-- Enabled on every table. Postgres denies all access to an RLS-enabled table
-- with no matching policy, so the default is closed and each policy below opens
-- exactly one door.
-- ---------------------------------------------------------------------------

alter table companies      enable row level security;
alter table memberships    enable row level security;
alter table trucks         enable row level security;
alter table drivers        enable row level security;
alter table ledger_entries enable row level security;
alter table invites        enable row level security;

-- Companies: read your own; only an owner may change it.
create policy company_read on companies
  for select using (id = auth_company_id());
create policy company_update on companies
  for update using (id = auth_company_id() and auth_is_owner());

-- Memberships: see who is in your company. Only owners may add or remove.
create policy membership_read on memberships
  for select using (company_id = auth_company_id());
create policy membership_write on memberships
  for all using (company_id = auth_company_id() and auth_is_owner())
  with check (company_id = auth_company_id() and auth_is_owner());

-- Trucks: everyone in the company can see the fleet; only owners change it.
-- A driver seeing the truck list is fine — unit numbers are painted on doors.
-- What they must not see is cost data, and that is stripped in the client
-- because `profile` is a single JSONB column. See the note at the bottom.
create policy truck_read on trucks
  for select using (company_id = auth_company_id());
create policy truck_write on trucks
  for all using (company_id = auth_company_id() and auth_is_owner())
  with check (company_id = auth_company_id() and auth_is_owner());

-- Drivers: an owner sees the whole roster. A driver sees only their own record
-- — not colleagues' pay rates, phone numbers or licence details.
create policy driver_read on drivers
  for select using (
    company_id = auth_company_id()
    and (auth_is_owner() or user_id = auth.uid())
  );
create policy driver_write on drivers
  for all using (company_id = auth_company_id() and auth_is_owner())
  with check (company_id = auth_company_id() and auth_is_owner());

-- Ledger: money. Owners only, full stop. A driver has no read path to this
-- table at all, which is what keeps rates and margins out of their reach even
-- if a future screen forgets to filter.
create policy ledger_owner_only on ledger_entries
  for all using (company_id = auth_company_id() and auth_is_owner())
  with check (company_id = auth_company_id() and auth_is_owner());

-- Invites: owners manage them. Claiming is done through a SECURITY DEFINER
-- function below, so an unclaimed code is never readable by the person
-- redeeming it.
create policy invite_owner on invites
  for all using (company_id = auth_company_id() and auth_is_owner())
  with check (company_id = auth_company_id() and auth_is_owner());

-- ---------------------------------------------------------------------------
-- Signup: create a company and become its owner, atomically
--
-- Without this the client would insert a company, then a membership, and a
-- failure between the two leaves an orphaned company nobody can reach — and,
-- worse, the company insert would need a policy permissive enough to allow
-- inserting rows you are not yet a member of.
-- ---------------------------------------------------------------------------

create or replace function create_company(company_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from memberships where user_id = auth.uid()) then
    raise exception 'this account already belongs to a company';
  end if;

  insert into companies (name) values (trim(company_name))
    returning id into new_company_id;

  insert into memberships (user_id, company_id, role)
    values (auth.uid(), new_company_id, 'owner');

  return new_company_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Claiming an invite
--
-- SECURITY DEFINER so the caller never needs read access to `invites` — they
-- present a code and either get in or do not. That prevents enumerating other
-- companies' outstanding codes.
-- ---------------------------------------------------------------------------

create or replace function claim_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from memberships where user_id = auth.uid()) then
    raise exception 'this account already belongs to a company';
  end if;

  select * into inv from invites
    where code = invite_code
      and claimed_at is null
      and expires_at > now()
    for update;

  if not found then
    -- Deliberately vague: distinguishing "wrong code" from "expired code"
    -- would confirm that a code once existed.
    raise exception 'invalid or expired invite';
  end if;

  insert into memberships (user_id, company_id, role)
    values (auth.uid(), inv.company_id, 'driver');

  update invites
    set claimed_at = now(), claimed_by = auth.uid()
    where id = inv.id;

  -- Link the auth user to the driver record the carrier already created.
  if inv.driver_id is not null then
    update drivers set user_id = auth.uid() where id = inv.driver_id;
  end if;

  return inv.company_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Note on truck cost data
--
-- `trucks.profile` holds the cost basis (payment, insurance, maintenance CPM)
-- in one JSONB column, and drivers can read the trucks row. Postgres RLS is
-- row-level, not column-level, so the honest position is: a determined driver
-- with the anon key could read the raw profile even though no screen shows it.
--
-- If cost data must be hidden from drivers at the database level, split it into
-- a `truck_costs` table keyed by truck_id with an owner-only policy. That is a
-- migration, not a rewrite, and worth doing before this is used by a carrier
-- who treats its cost basis as confidential.
-- ---------------------------------------------------------------------------
