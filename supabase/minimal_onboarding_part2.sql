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
