-- Profiles: one row per signed-in operator.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  business_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Saved jobs. `input` is the form as submitted; the plan itself is always
-- recomputed from it, so a change to the tables reaches old jobs too and we
-- never serve a stale order list.
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('event', 'service')),
  title text not null check (char_length(title) between 1 and 200),
  event_date date,
  input jsonb not null,
  -- "We used 11 kg of brisket, not 12.5." Real numbers beat the tables, so
  -- this is what you scale from next time you run the same menu.
  actuals_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index jobs_user_created_idx on public.jobs (user_id, created_at desc);

-- Keep updated_at honest.
create function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_touch_updated_at
  before update on public.jobs
  for each row execute function public.touch_updated_at();

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Give every new signup a profile row.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row-level security. One operator must never see another's jobs.
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;

create policy "own profile is readable"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "own profile is updatable"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "own jobs are readable"
  on public.jobs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "own jobs are insertable"
  on public.jobs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "own jobs are updatable"
  on public.jobs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own jobs are deletable"
  on public.jobs for delete
  to authenticated
  using ((select auth.uid()) = user_id);
