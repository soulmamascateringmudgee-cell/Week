-- What things cost, in one place.
--
-- Prices belong here rather than on each recipe line. Bacon goes up once and
-- every menu that uses it should follow; copies scattered through twenty
-- recipes would mean twenty edits and nineteen of them forgotten.
--
-- Matched to order lines by name, so "Bacon" priced here covers the bacon in
-- the sausage rolls and the bacon in the quiche alike.
create table public.ingredient_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Stored lowercase so "Bacon" and "bacon" are the same line item.
  item text not null check (item = lower(item) and char_length(item) between 1 and 200),
  -- The unit the price is per: kg, L, ea, bunches.
  unit text not null check (char_length(unit) between 1 and 20),
  -- Dollars per unit. Numeric, not float — money should not drift.
  price numeric(10, 2) not null check (price >= 0),
  supplier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, item)
);

create trigger ingredient_prices_touch_updated_at
  before update on public.ingredient_prices
  for each row execute function public.touch_updated_at();

alter table public.ingredient_prices enable row level security;

create policy "own prices are readable"
  on public.ingredient_prices for select
  to authenticated
  using ((select auth.uid()) = user_id and (select public.is_invited()));

create policy "own prices are insertable"
  on public.ingredient_prices for insert
  to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_invited()));

create policy "own prices are updatable"
  on public.ingredient_prices for update
  to authenticated
  using ((select auth.uid()) = user_id and (select public.is_invited()))
  with check ((select auth.uid()) = user_id and (select public.is_invited()));

create policy "own prices are deletable"
  on public.ingredient_prices for delete
  to authenticated
  using ((select auth.uid()) = user_id and (select public.is_invited()));
