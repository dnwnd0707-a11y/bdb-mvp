create extension if not exists "pgcrypto";

drop table if exists public.reports cascade;
drop table if exists public.contract_settlements cascade;
drop table if exists public.viewing_appointments cascade;
drop table if exists public.messages cascade;
drop table if exists public.chat_rooms cascade;
drop table if exists public.proposal_items cascade;
drop table if exists public.proposals cascade;
drop table if exists public.properties cascade;
drop table if exists public.request_regions cascade;
drop table if exists public.buyer_requests cascade;
drop table if exists public.agent_affiliation_requests cascade;
drop table if exists public.agent_profiles cascade;
drop table if exists public.profiles cascade;
drop table if exists public.brokerage_rate_rules cascade;

drop function if exists private.current_user_role() cascade;
drop function if exists private.is_approved_agent() cascade;
drop schema if exists private cascade;
create schema private;

drop type if exists public.contract_status cascade;
drop type if exists public.payment_status cascade;
drop type if exists public.viewing_status cascade;
drop type if exists public.report_target_type cascade;
drop type if exists public.report_status cascade;
drop type if exists public.proposal_status cascade;
drop type if exists public.request_status cascade;
drop type if exists public.verification_status cascade;
drop type if exists public.affiliation_status cascade;
drop type if exists public.agent_kind cascade;
drop type if exists public.user_role cascade;

create type public.user_role as enum ('buyer', 'agent', 'admin');
create type public.agent_kind as enum ('representative', 'affiliated');
create type public.affiliation_status as enum ('none', 'pending', 'approved', 'rejected');
create type public.verification_status as enum ('pending', 'approved', 'rejected');
create type public.request_status as enum ('open', 'matched', 'closed');
create type public.proposal_status as enum ('new', 'chatting', 'hidden');
create type public.report_status as enum ('open', 'reviewing', 'resolved');
create type public.report_target_type as enum ('request', 'proposal', 'message');
create type public.viewing_status as enum ('requested', 'confirmed', 'completed', 'credited', 'forfeited', 'cancelled');
create type public.payment_status as enum ('pending', 'paid', 'refunded', 'settled');
create type public.contract_status as enum ('reported', 'confirmed', 'commission_due', 'paid', 'disputed');

create table public.brokerage_rate_rules (
  id text primary key,
  region text not null,
  property_type text not null,
  transaction_type text not null,
  min_amount integer not null check (min_amount >= 0),
  max_amount integer check (max_amount is null or max_amount > min_amount),
  rate numeric(7, 6) not null check (rate >= 0),
  limit_amount integer check (limit_amount is null or limit_amount >= 0),
  label text not null,
  source_url text not null,
  effective_from date not null,
  effective_to date
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null,
  display_name text not null,
  phone text,
  kakao_subject text,
  kakao_email text,
  kakao_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  agent_kind public.agent_kind not null default 'representative',
  representative_profile_id uuid references public.profiles(id) on delete set null,
  affiliation_status public.affiliation_status not null default 'none',
  office_name text not null,
  representative_name text not null,
  license_number text not null unique,
  service_regions text[] not null default '{}',
  verification_status public.verification_status not null default 'pending',
  document_file_path text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_affiliation_requests (
  id uuid primary key default gen_random_uuid(),
  affiliated_profile_id uuid not null references public.profiles(id) on delete cascade,
  representative_profile_id uuid not null references public.profiles(id) on delete cascade,
  office_name text not null,
  affiliated_license_number text not null,
  status public.affiliation_status not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (affiliated_profile_id, representative_profile_id)
);

create table public.buyer_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  transaction_type text not null check (transaction_type in ('jeonse', 'monthly_rent')),
  housing_type text not null,
  deposit_min integer not null default 0,
  deposit_max integer not null,
  rent_min integer not null default 0,
  rent_max integer not null default 0,
  move_in_date date,
  rooms text,
  area text,
  floor_preference text,
  direction_preference text,
  parking_required boolean not null default false,
  pets_allowed boolean not null default false,
  loan_required boolean not null default false,
  maintenance_fee_max integer,
  must_haves text[] not null default '{}',
  memo text,
  status public.request_status not null default 'open',
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.request_regions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.buyer_requests(id) on delete cascade,
  sido text not null,
  sigungu text not null,
  dong text not null,
  created_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  transaction_type text not null check (transaction_type in ('jeonse', 'monthly_rent')),
  housing_type text not null,
  deposit integer not null,
  rent integer not null default 0,
  maintenance_fee integer,
  area text,
  floor text,
  rough_lat numeric(9, 6) not null,
  rough_lng numeric(9, 6) not null,
  address_label text not null,
  private_address text,
  photo_paths text[] not null default '{}',
  features text[] not null default '{}',
  legal_max_brokerage_fee integer not null default 0 check (legal_max_brokerage_fee >= 0),
  suggested_brokerage_fee integer not null default 0 check (suggested_brokerage_fee >= 0),
  brokerage_rule_id text references public.brokerage_rate_rules(id),
  brokerage_rate_label text,
  brokerage_formula_label text,
  disclosure_level text not null default 'rough' check (disclosure_level in ('rough', 'exact_after_chat')),
  feed_visible boolean not null default true,
  listing_fee integer not null default 0 check (listing_fee = 0),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.buyer_requests(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  status public.proposal_status not null default 'new',
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (request_id, agent_id)
);

create table public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  recommendation_note text,
  legal_max_brokerage_fee integer not null default 0 check (legal_max_brokerage_fee >= 0),
  proposed_brokerage_fee integer not null default 0 check (proposed_brokerage_fee >= 0),
  brokerage_rule_id text references public.brokerage_rate_rules(id),
  brokerage_rate_label text,
  brokerage_formula_label text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (proposed_brokerage_fee <= legal_max_brokerage_fee),
  unique (proposal_id, property_id)
);

create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null unique references public.proposals(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.viewing_appointments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  scheduled_for timestamptz,
  viewing_fee integer not null default 15000 check (viewing_fee between 10000 and 20000),
  status public.viewing_status not null default 'requested',
  payment_status public.payment_status not null default 'pending',
  contract_signed boolean not null default false,
  credited_to_brokerage_fee boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contract_settlements (
  id uuid primary key default gen_random_uuid(),
  viewing_appointment_id uuid references public.viewing_appointments(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  property_id uuid not null references public.properties(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  brokerage_fee integer not null check (brokerage_fee > 0),
  platform_fee_rate numeric(4, 2) not null default 3.00 check (platform_fee_rate between 1.00 and 5.00),
  platform_fee_amount integer generated always as ((brokerage_fee * platform_fee_rate / 100.0)::integer) stored,
  viewing_fee_credit integer not null default 0,
  status public.contract_status not null default 'reported',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason text not null,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create or replace function private.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function private.is_approved_agent()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    join public.agent_profiles a on a.profile_id = p.id
    where p.id = auth.uid()
      and p.role = 'agent'
      and a.verification_status = 'approved'
  )
$$;

alter table public.profiles enable row level security;
alter table public.brokerage_rate_rules enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.agent_affiliation_requests enable row level security;
alter table public.buyer_requests enable row level security;
alter table public.request_regions enable row level security;
alter table public.properties enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.messages enable row level security;
alter table public.viewing_appointments enable row level security;
alter table public.contract_settlements enable row level security;
alter table public.reports enable row level security;

grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;
grant select on public.brokerage_rate_rules to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles for insert
with check (id = auth.uid() and role in ('buyer', 'agent'));

create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and role in ('buyer', 'agent'));

create policy "brokerage_rate_rules_select_all"
on public.brokerage_rate_rules for select
using (true);

create policy "agent_profiles_select_owner_or_approved"
on public.agent_profiles for select
using (profile_id = auth.uid() or verification_status = 'approved');

create policy "agent_profiles_insert_owner"
on public.agent_profiles for insert
with check (profile_id = auth.uid() and private.current_user_role() = 'agent');

create policy "agent_profiles_update_owner_pending"
on public.agent_profiles for update
using (profile_id = auth.uid())
with check (profile_id = auth.uid() and verification_status = 'pending');

create policy "agent_affiliation_requests_select_participants"
on public.agent_affiliation_requests for select
using (affiliated_profile_id = auth.uid() or representative_profile_id = auth.uid());

create policy "agent_affiliation_requests_insert_affiliated"
on public.agent_affiliation_requests for insert
with check (affiliated_profile_id = auth.uid() and private.current_user_role() = 'agent');

create policy "agent_affiliation_requests_update_representative"
on public.agent_affiliation_requests for update
using (representative_profile_id = auth.uid())
with check (representative_profile_id = auth.uid());

create policy "buyer_requests_select_owner_or_approved_agent"
on public.buyer_requests for select
using (buyer_id = auth.uid() or (hidden = false and private.is_approved_agent()));

create policy "buyer_requests_insert_owner"
on public.buyer_requests for insert
with check (buyer_id = auth.uid() and private.current_user_role() = 'buyer');

create policy "buyer_requests_update_owner"
on public.buyer_requests for update
using (buyer_id = auth.uid())
with check (buyer_id = auth.uid());

create policy "request_regions_select_via_request"
on public.request_regions for select
using (
  exists (
    select 1 from public.buyer_requests br
    where br.id = request_id
      and (br.buyer_id = auth.uid() or private.is_approved_agent())
  )
);

create policy "request_regions_insert_owner"
on public.request_regions for insert
with check (
  exists (
    select 1 from public.buyer_requests br
    where br.id = request_id and br.buyer_id = auth.uid()
  )
);

create policy "properties_select_feed_or_owner"
on public.properties for select
using (agent_id = auth.uid() or (feed_visible = true and hidden = false));

create policy "properties_insert_approved_agent"
on public.properties for insert
with check (agent_id = auth.uid() and private.is_approved_agent());

create policy "properties_update_owner"
on public.properties for update
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

create policy "proposals_select_agent"
on public.proposals for select
using (agent_id = auth.uid());

create policy "proposals_select_buyer"
on public.proposals for select
using (
  exists (
    select 1 from public.buyer_requests br
    where br.id = request_id and br.buyer_id = auth.uid()
  )
);

create policy "proposals_insert_approved_agent"
on public.proposals for insert
with check (agent_id = auth.uid() and private.is_approved_agent());

create policy "proposals_update_agent"
on public.proposals for update
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

create policy "proposal_items_select_via_proposal"
on public.proposal_items for select
using (
  exists (
    select 1
    from public.proposals pr
    left join public.buyer_requests br on br.id = pr.request_id
    where pr.id = proposal_id
      and (pr.agent_id = auth.uid() or br.buyer_id = auth.uid())
  )
);

create policy "proposal_items_insert_agent"
on public.proposal_items for insert
with check (
  private.is_approved_agent()
  and exists (
    select 1 from public.proposals pr
    where pr.id = proposal_id and pr.agent_id = auth.uid()
  )
);

create policy "chat_rooms_select_participants"
on public.chat_rooms for select
using (buyer_id = auth.uid() or agent_id = auth.uid());

create policy "chat_rooms_insert_participant"
on public.chat_rooms for insert
with check (buyer_id = auth.uid() or agent_id = auth.uid());

create policy "messages_select_room_participants"
on public.messages for select
using (
  exists (
    select 1 from public.chat_rooms cr
    where cr.id = room_id
      and (cr.buyer_id = auth.uid() or cr.agent_id = auth.uid())
  )
);

create policy "messages_insert_room_participant"
on public.messages for insert
with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.chat_rooms cr
    where cr.id = room_id and (cr.buyer_id = auth.uid() or cr.agent_id = auth.uid())
  )
);

create policy "viewing_appointments_select_participants"
on public.viewing_appointments for select
using (buyer_id = auth.uid() or agent_id = auth.uid());

create policy "viewing_appointments_insert_buyer"
on public.viewing_appointments for insert
with check (buyer_id = auth.uid() and viewing_fee between 10000 and 20000);

create policy "viewing_appointments_update_participants"
on public.viewing_appointments for update
using (buyer_id = auth.uid() or agent_id = auth.uid())
with check (buyer_id = auth.uid() or agent_id = auth.uid());

create policy "contract_settlements_select_participants"
on public.contract_settlements for select
using (buyer_id = auth.uid() or agent_id = auth.uid());

create policy "contract_settlements_insert_agent"
on public.contract_settlements for insert
with check (agent_id = auth.uid() and private.is_approved_agent());

create policy "reports_select_reporter"
on public.reports for select
using (reporter_id = auth.uid());

create policy "reports_insert_authenticated"
on public.reports for insert
with check (reporter_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('agent-documents', 'agent-documents', false),
       ('property-photos', 'property-photos', false)
on conflict (id) do nothing;

insert into public.brokerage_rate_rules
  (id, region, property_type, transaction_type, min_amount, max_amount, rate, limit_amount, label, source_url, effective_from, effective_to)
values
  ('kr-housing-lease-under-50m', 'KR', 'housing', 'lease', 0, 50000000, 0.005, 200000, 'Under 50M KRW: max 0.5%, cap 200K', 'https://www.bucheon.go.kr/site/homepage/menu/viewMenu?menuid=148006005002003', '2021-10-19', null),
  ('kr-housing-lease-50m-100m', 'KR', 'housing', 'lease', 50000000, 100000000, 0.004, 300000, '50M-100M KRW: max 0.4%, cap 300K', 'https://www.bucheon.go.kr/site/homepage/menu/viewMenu?menuid=148006005002003', '2021-10-19', null),
  ('kr-housing-lease-100m-300m', 'KR', 'housing', 'lease', 100000000, 300000000, 0.003, null, '100M-300M KRW: max 0.3%', 'https://www.bucheon.go.kr/site/homepage/menu/viewMenu?menuid=148006005002003', '2021-10-19', null),
  ('kr-housing-lease-300m-600m', 'KR', 'housing', 'lease', 300000000, 600000000, 0.004, null, '300M-600M KRW: max 0.4%', 'https://www.bucheon.go.kr/site/homepage/menu/viewMenu?menuid=148006005002003', '2021-10-19', null),
  ('kr-housing-lease-600m-plus', 'KR', 'housing', 'lease', 600000000, null, 0.008, null, '600M+ KRW: negotiable within 0.8%', 'https://www.bucheon.go.kr/site/homepage/menu/viewMenu?menuid=148006005002003', '2021-10-19', null);
