-- Invite-only access.
--
-- Anyone can ask Supabase for a magic link, so a signed-in account is not by
-- itself permission to use anything. This list is the permission. An operator
-- gets in only if their email is on it, and only an admin can put it there.

create table public.allowed_emails (
  -- Stored lowercase so a capitalised sign-in still matches.
  email text primary key check (email = lower(email) and email like '%_@_%'),
  is_admin boolean not null default false,
  note text,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- The owner. Without this row nobody can reach the admin page and the invite
-- list can never be added to.
insert into public.allowed_emails (email, is_admin, note)
values ('jessmyn.toovey@hotmail.com', true, 'Owner');

-- The email on the current session's token, lowercased. Null when signed out.
create function public.current_email()
returns text
language sql
stable
set search_path = ''
as $$
  select lower(nullif(auth.jwt() ->> 'email', ''));
$$;

-- These two read allowed_emails, and they are used *in the policies on*
-- allowed_emails, so they must be security definer or the policy would recurse
-- into itself.
create function public.is_invited()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_emails a
    where a.email = lower(nullif(auth.jwt() ->> 'email', ''))
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_emails a
    where a.email = lower(nullif(auth.jwt() ->> 'email', ''))
      and a.is_admin
  );
$$;

-- Signed-in code calls these; anonymous callers have no business asking.
revoke execute on function public.current_email() from public, anon;
revoke execute on function public.is_invited() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.current_email() to authenticated;
grant execute on function public.is_invited() to authenticated;
grant execute on function public.is_admin() to authenticated;

alter table public.allowed_emails enable row level security;

-- You can see your own row (so the app can tell you that you're on the list);
-- an admin sees the whole list.
create policy "invite list is readable by admins and by the invitee"
  on public.allowed_emails for select
  to authenticated
  using (public.is_admin() or email = public.current_email());

create policy "only admins invite"
  on public.allowed_emails for insert
  to authenticated
  with check (public.is_admin());

create policy "only admins change invites"
  on public.allowed_emails for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "only admins revoke invites"
  on public.allowed_emails for delete
  to authenticated
  using (public.is_admin());

-- The app checks the invite list on every request, but the app is not the
-- boundary — the database is. An uninvited account reaches no rows at all,
-- including its own.
drop policy "own jobs are readable" on public.jobs;
create policy "own jobs are readable"
  on public.jobs for select
  to authenticated
  using ((select auth.uid()) = user_id and (select public.is_invited()));

drop policy "own jobs are insertable" on public.jobs;
create policy "own jobs are insertable"
  on public.jobs for insert
  to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_invited()));

drop policy "own jobs are updatable" on public.jobs;
create policy "own jobs are updatable"
  on public.jobs for update
  to authenticated
  using ((select auth.uid()) = user_id and (select public.is_invited()))
  with check ((select auth.uid()) = user_id and (select public.is_invited()));

drop policy "own jobs are deletable" on public.jobs;
create policy "own jobs are deletable"
  on public.jobs for delete
  to authenticated
  using ((select auth.uid()) = user_id and (select public.is_invited()));
