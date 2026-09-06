create extension if not exists "pgcrypto";

drop table if exists public.agent_affiliation_requests cascade;
drop table if exists public.agent_profiles cascade;
drop table if exists public.profiles cascade;
drop function if exists private.current_user_role() cascade;
drop schema if exists private cascade;
create schema private;

drop type if exists public.verification_status cascade;
drop type if exists public.affiliation_status cascade;
drop type if exists public.agent_kind cascade;
drop type if exists public.user_role cascade;

create type public.user_role as enum ('buyer', 'agent', 'admin');
create type public.agent_kind as enum ('representative', 'affiliated');
create type public.affiliation_status as enum ('none', 'pending', 'approved', 'rejected');
create type public.verification_status as enum ('pending', 'approved', 'rejected');

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

create or replace function private.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

alter table public.profiles enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.agent_affiliation_requests enable row level security;

grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.agent_profiles to authenticated;
grant select, insert, update, delete on public.agent_affiliation_requests to authenticated;
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
