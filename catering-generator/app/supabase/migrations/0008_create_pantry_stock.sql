-- What's already on the shelf.
--
-- The order sheet has always ended with "what's already in the pantry, freezer
-- and packaging store? Shop that first — it comes straight off this order."
-- That was a note asking a person to do arithmetic in their head at the shops.
-- This table is what lets the page do it instead.
--
-- Counts go stale, and this one is honest about that: `counted_on` is the day
-- the shelf was actually looked at, not the day the row was written, and the
-- app shows it. A count from three weeks ago is worth something, but not the
-- same something as one from this morning — so the number never silently
-- reduces an order line. See lib/pantry.ts.
create table public.pantry_stock (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Lowercase, matching ingredient_prices, so names line up across the app.
  item text not null check (item = lower(item) and char_length(item) between 1 and 200),
  -- How much is there, in whatever unit it was counted in. A cook counting a
  -- coolroom says "two boxes" or "half a bag", and forcing that into kilos at
  -- the point of counting would invent a number.
  qty numeric(12, 3) not null check (qty >= 0),
  unit text not null check (char_length(unit) between 1 and 20),
  -- Where it is, when that matters: "chest freezer", "dry store", "van".
  place text not null default '',
  -- The day the shelf was looked at. Defaults to today, editable, because a
  -- stocktake typed up on Sunday night may have happened on Friday.
  counted_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One row per thing per place. The same flour in the dry store and in the
  -- van are two counts, not one overwriting the other — the same lesson
  -- migration 0007 learned about prices and shops.
  unique (user_id, item, place)
);

create index pantry_stock_user_item_idx on public.pantry_stock (user_id, item);

create trigger pantry_stock_touch_updated_at
  before update on public.pantry_stock
  for each row execute function public.touch_updated_at();

alter table public.pantry_stock enable row level security;

create policy "own stock is readable"
  on public.pantry_stock for select
  to authenticated
  using ((select auth.uid()) = user_id and (select public.is_invited()));

create policy "own stock is insertable"
  on public.pantry_stock for insert
  to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_invited()));

create policy "own stock is updatable"
  on public.pantry_stock for update
  to authenticated
  using ((select auth.uid()) = user_id and (select public.is_invited()))
  with check ((select auth.uid()) = user_id and (select public.is_invited()));

create policy "own stock is deletable"
  on public.pantry_stock for delete
  to authenticated
  using ((select auth.uid()) = user_id and (select public.is_invited()));
