-- Every price ever recorded, kept.
--
-- `ingredient_prices` holds what a thing costs now — one row per ingredient,
-- overwritten each time. That's the right shape for costing a job, and the
-- wrong shape for the question a caterer actually asks: "has this gone up?"
--
-- So each price also lands here, append-only. The current price is what the
-- order sheet uses; this is what tells you the chicken is dearer than it was
-- in March, and by how much.
--
-- Prices are per canonical unit — per kg, per L, or per whatever it's counted
-- in — normalised before they get here, so a delivery billed in grams and one
-- billed in kilos compare directly. See lib/price-change.ts.
create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Lowercase, matching ingredient_prices, so the two join on name.
  item text not null check (item = lower(item) and char_length(item) between 1 and 200),
  unit text not null check (char_length(unit) between 1 and 20),
  price numeric(10, 2) not null check (price >= 0),
  supplier text,
  -- Where the number came from. An invoice-read price and a typed one are
  -- both valid, but only one of them was checked against a docket.
  source text not null default 'manual' check (source in ('manual', 'invoice')),
  -- The invoice's own date, which is not the day it got photographed. A
  -- docket entered a fortnight late still belongs at its own date.
  priced_on date,
  created_at timestamptz not null default now()
);

-- The query this table exists for: one ingredient's prices, newest first.
create index price_history_user_item_idx
  on public.price_history (user_id, item, created_at desc);

alter table public.price_history enable row level security;

create policy "own price history is readable"
  on public.price_history for select
  to authenticated
  using ((select auth.uid()) = user_id and (select public.is_invited()));

create policy "own price history is insertable"
  on public.price_history for insert
  to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_invited()));

-- Deletable but not updatable: a docket read wrongly should be removable, but
-- a recorded price should never be quietly rewritten to a different number.
create policy "own price history is deletable"
  on public.price_history for delete
  to authenticated
  using ((select auth.uid()) = user_id and (select public.is_invited()));
