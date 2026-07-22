-- =====================================================================
--  Coffee Kingdom — Loyalty App database schema
--  Run this in your Supabase project: SQL Editor → New query → paste → Run
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

-- One profile row per signed-up customer (mirrors auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  phone       text,
  created_at  timestamptz not null default now()
);

-- Current coffee balance per customer
create table if not exists public.credits (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  balance     int  not null default 0 check (balance >= 0),
  updated_at  timestamptz not null default now()
);

-- Immutable log of every purchase and redemption
create table if not exists public.transactions (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references auth.users (id) on delete cascade,
  kind              text not null check (kind in ('purchase', 'redeem', 'adjust')),
  coffees           int  not null,          -- +7 on purchase, -1 on redeem
  amount_cents      int,                    -- money paid (purchases only)
  external_ref      text,                   -- payment id from Square (idempotency)
  staff_note        text,
  created_at        timestamptz not null default now()
);

create index if not exists transactions_user_idx on public.transactions (user_id, created_at desc);

-- ---------- New-user trigger ----------------------------------------
-- When someone signs up, create their profile + a zero-balance credits row.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
    values (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'phone')
    on conflict (id) do nothing;
  insert into public.credits (user_id, balance)
    values (new.id, 0)
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security --------------------------------------
-- Customers can READ only their own rows. All WRITES to credits/transactions
-- happen server-side via the service-role key (webhook + redeem function),
-- which bypasses RLS — so there are deliberately no client write policies.

alter table public.profiles     enable row level security;
alter table public.credits      enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "read own profile"    on public.profiles;
drop policy if exists "update own profile"  on public.profiles;
drop policy if exists "insert own profile"  on public.profiles;
drop policy if exists "read own credits"    on public.credits;
drop policy if exists "read own transactions" on public.transactions;

create policy "read own profile"      on public.profiles     for select using (auth.uid() = id);
create policy "update own profile"    on public.profiles     for update using (auth.uid() = id);
create policy "insert own profile"    on public.profiles     for insert with check (auth.uid() = id);
create policy "read own credits"      on public.credits      for select using (auth.uid() = user_id);
create policy "read own transactions" on public.transactions for select using (auth.uid() = user_id);

-- ---------- Atomic redeem helper ------------------------------------
-- Decrements one coffee only if the balance is > 0. Called by the server
-- (service role) after the staff PIN has been verified.

create or replace function public.redeem_one(p_user uuid, p_note text default null)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  new_balance int;
begin
  update public.credits
     set balance = balance - 1,
         updated_at = now()
   where user_id = p_user
     and balance > 0
  returning balance into new_balance;

  if new_balance is null then
    raise exception 'no_coffees_left';
  end if;

  insert into public.transactions (user_id, kind, coffees, staff_note)
    values (p_user, 'redeem', -1, p_note);

  return new_balance;
end;
$$;

-- ---------- Atomic credit helper ------------------------------------
-- Adds a purchased bundle. Called by the Square payment webhook (service role).

create or replace function public.add_credit(
  p_user uuid, p_coffees int, p_amount_cents int, p_session text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  new_balance int;
begin
  -- Idempotency: ignore a payment we've already processed
  if exists (select 1 from public.transactions where external_ref = p_session) then
    select balance into new_balance from public.credits where user_id = p_user;
    return new_balance;
  end if;

  insert into public.credits (user_id, balance)
    values (p_user, p_coffees)
  on conflict (user_id)
    do update set balance = public.credits.balance + p_coffees, updated_at = now()
  returning balance into new_balance;

  insert into public.transactions (user_id, kind, coffees, amount_cents, external_ref)
    values (p_user, 'purchase', p_coffees, p_amount_cents, p_session);

  return new_balance;
end;
$$;
